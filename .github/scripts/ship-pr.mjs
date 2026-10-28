#!/usr/bin/env node
// Ava delivery gate: no credentials, build, deployment or automatic CI retries.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

export const REPO = 'memoways/ava-proto1';
export const WORKFLOW = '.github/workflows/core-experience-quality.yml';
const requireThat = (value, message) => { if (!value) throw new Error(message); };
const shaPattern = /^[a-f0-9]{40}$/;

export function transport() {
  const run = (command, args) => execFileSync(command, args, { encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  return {
    git: (...args) => run('git', args),
    api: (path, fields) => JSON.parse(run('gh', ['api', `repos/${REPO}/${path}`, ...(fields
      ? ['--method', 'PUT', ...Object.entries(fields).flatMap(([key, value]) => ['-f', `${key}=${value}`])]
      : [])])),
    pages: path => JSON.parse(run('gh', ['api', '--paginate', '--slurp', `repos/${REPO}/${path}`])),
  };
}

export function verifyRemote(io) {
  requireThat(io.git('remote') === 'origin', 'Ava requires the single origin remote');
  for (const mode of [[], ['--push']]) {
    const urls = io.git('remote', 'get-url', ...mode, '--all', 'origin').split('\n');
    requireThat(urls.length === 1 && /^https:\/\/github\.com\/memoways\/ava-proto1(?:\.git)?$/.test(urls[0]), 'Wrong Ava remote');
  }
}

export function isDocsOnly(paths) {
  return paths.length > 0 && paths.every(path => path.endsWith('.md') || path.startsWith('docs/'));
}

export function verifyPr(pr, number, head, branch) {
  requireThat(pr.number === number && pr.state === 'open' && !pr.draft, 'PR must be open and ready');
  requireThat(pr.base?.repo?.full_name === REPO && pr.head?.repo?.full_name === REPO && pr.base.ref === 'main', 'Wrong PR repository/base');
  requireThat(pr.head.sha === head && pr.head.ref === branch && branch !== 'main', 'PR HEAD/branch changed');
  requireThat(pr.mergeable !== false, 'PR has merge conflicts');
}

export function qualityState(runs, jobs, head) {
  const run = runs.filter(run => run.head_sha === head && run.event === 'pull_request' && run.path === WORKFLOW)
    .sort((a, b) => b.id - a.id)[0];
  if (!run) return { ready: false, reason: 'Waiting for the PR quality run' };
  if (run.status !== 'completed') return { ready: false, reason: `Run ${run.id}: ${run.status}`, run };
  requireThat(run.conclusion === 'success', `Run ${run.id}: ${run.conclusion}; merge refused`);
  const gate = jobs.filter(job => job.name === 'regression-gates');
  requireThat(gate.length === 1 && gate[0].status === 'completed' && gate[0].conclusion === 'success', 'regression-gates must succeed (not skipped)');
  return { ready: true, run };
}

export function verifyMerge(commit, mainSha, expectedTree, base) {
  requireThat(commit.sha === mainSha, 'main moved after merge; inspect before closing the lot');
  requireThat(commit.tree?.sha === expectedTree, 'Merged tree differs from tested HEAD; lot remains open');
  requireThat(commit.parents?.length === 1 && commit.parents[0].sha === base, 'Base changed during merge; lot remains open');
}

// Dependencies are injectable so refusal paths are exercised without touching GitHub.
export async function ship({ number, head, merge = false, timeoutMs = 35 * 60_000 }, io = transport(), wait = delay, log = console.log) {
  requireThat(Number.isSafeInteger(number) && number > 0 && shaPattern.test(head), 'Expected PR number and full HEAD SHA');
  verifyRemote(io);
  requireThat(io.git('status', '--porcelain') === '', 'Commit all changes before delivery');
  requireThat(io.git('rev-parse', 'HEAD') === head, 'Local HEAD differs from expected HEAD');
  const branch = io.git('branch', '--show-current');
  const deadline = Date.now() + timeoutMs;
  let receipt;
  while (Date.now() <= deadline) {
    const pr = io.api(`pulls/${number}`);
    verifyPr(pr, number, head, branch);
    io.git('fetch', '--prune', 'origin');
    const base = io.api('git/ref/heads/main').object.sha;
    requireThat(base === io.git('rev-parse', 'origin/main'), 'main moved during fetch; rerun the gate');
    // Throws for an outdated branch; the caller must update it and obtain a new green run.
    io.git('merge-base', '--is-ancestor', base, head);
    const paths = io.git('diff', '--no-renames', '--name-only', `${base}..${head}`).split('\n').filter(Boolean);
    const docsOnly = isDocsOnly(paths);
    let quality = { ready: true };
    if (!docsOnly) {
      const runs = io.pages(`actions/workflows/core-experience-quality.yml/runs?event=pull_request&head_sha=${head}&per_page=100`)
        .flatMap(page => page.workflow_runs);
      const latest = runs.filter(run => run.head_sha === head && run.event === 'pull_request' && run.path === WORKFLOW)
        .sort((a, b) => b.id - a.id)[0];
      const jobs = latest?.status === 'completed' && latest.conclusion === 'success'
        ? io.pages(`actions/runs/${latest.id}/attempts/${latest.run_attempt}/jobs?per_page=100`).flatMap(page => page.jobs) : [];
      quality = qualityState(runs, jobs, head);
    }
    if (!quality.ready || pr.mergeable === null) {
      log(quality.reason ?? 'Waiting for GitHub mergeability');
      await wait(20_000);
      continue;
    }
    const tree = io.git('rev-parse', `${head}^{tree}`);
    receipt = { repository: REPO, number, head, base, tree, docsOnly, run: quality.run?.id ?? null };
    break;
  }
  requireThat(receipt, 'Timed out waiting for CI; PR remains open');
  if (!merge) return receipt;
  // Re-read both refs immediately before the mutation. GitHub's sha parameter
  // protects HEAD atomically; the postcondition detects a concurrent base change.
  const currentPr = io.api(`pulls/${number}`);
  verifyPr(currentPr, number, head, branch);
  requireThat(currentPr.mergeable === true, 'Mergeability changed; rerun the gate');
  requireThat(io.api('git/ref/heads/main').object.sha === receipt.base, 'main moved before merge; obtain fresh CI');
  const result = io.api(`pulls/${number}/merge`, { sha: head, merge_method: 'squash' });
  requireThat(result.merged && shaPattern.test(result.sha), 'GitHub refused the merge');
  const commit = io.api(`git/commits/${result.sha}`);
  verifyMerge(commit, io.api('git/ref/heads/main').object.sha, receipt.tree, receipt.base);
  return { ...receipt, main: result.sha, mergedTreeVerified: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    const options = { merge: false };
    while (args.length) {
      const arg = args.shift();
      if (arg === '--pr') options.number = Number(args.shift());
      else if (arg === '--head') options.head = args.shift();
      else if (arg === '--merge') options.merge = true;
      else throw new Error('Usage: node .github/scripts/ship-pr.mjs --pr N --head FULL_SHA [--merge]');
    }
    console.log(JSON.stringify(await ship(options), null, 2));
  } catch (error) {
    console.error(`Ava delivery refused: ${error.message}`);
    process.exitCode = 1;
  }
}
