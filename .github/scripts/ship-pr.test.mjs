import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ship, REPO, WORKFLOW } from './ship-pr.mjs';

const head = 'a'.repeat(40), base = 'b'.repeat(40), tree = 'c'.repeat(40), merged = 'd'.repeat(40);
function fixture() {
  const state = { head, base, tree, status: 'completed', conclusion: 'success', job: 'success', calls: [], paths: 'src/example.ts', runs: true };
  const pr = () => ({ number: 7, state: 'open', draft: false, mergeable: true,
    head: { sha: state.head, ref: 'codex/ct1', repo: { full_name: REPO } }, base: { ref: 'main', repo: { full_name: REPO } } });
  const io = {
    git: (...args) => {
      const command = args.join(' ');
      if (command === 'remote') return 'origin';
      if (args[0] === 'remote') return state.remote ?? `https://github.com/${REPO}.git`;
      if (args[0] === 'status') return state.dirty ?? '';
      if (command === 'rev-parse HEAD') return head;
      if (command === 'branch --show-current') return 'codex/ct1';
      if (command === 'rev-parse origin/main') return state.base;
      if (args[0] === 'merge-base' && state.behind) throw new Error('outdated base');
      if (args[0] === 'diff') return state.paths;
      if (args[0] === 'rev-parse') return tree;
      return '';
    },
    api: (path, fields) => {
      if (fields) { state.calls.push({ path, fields }); return { merged: true, sha: merged }; }
      if (path === 'pulls/7') return pr();
      if (path.startsWith('git/commits/')) return { sha: merged, tree: { sha: state.tree }, parents: [{ sha: base }] };
      if (path === 'git/ref/heads/main') return { object: { sha: state.calls.length ? merged : state.base } };
      throw new Error(`Unexpected API: ${path}`);
    },
    pages: path => path.includes('/jobs') ? [{ jobs: [{ name: 'regression-gates', status: 'completed', conclusion: state.job }] }]
      : [{ workflow_runs: state.runs ? [{ id: 10, head_sha: state.runHead ?? head, event: state.event ?? 'pull_request', path: WORKFLOW,
        status: state.status, conclusion: state.conclusion, run_attempt: 1 }] : [] }],
  };
  return { state, io };
}
const options = { number: 7, head, merge: true };

test('waits through queued and in_progress; merges once with the expected SHA', async () => {
  const { state, io } = fixture();
  state.status = 'queued';
  let waits = 0;
  const receipt = await ship(options, io, async () => {
    assert.equal(state.calls.length, 0);
    state.status = ++waits === 1 ? 'in_progress' : 'completed';
  }, () => {});
  assert.equal(waits, 2);
  assert.deepEqual(state.calls, [{ path: 'pulls/7/merge', fields: { sha: head, merge_method: 'squash' } }]);
  assert.equal(receipt.main, merged);
  assert.equal(receipt.mergedTreeVerified, true);
});

for (const [name, change] of [
  ['failed run', { conclusion: 'failure' }], ['cancelled run', { conclusion: 'cancelled' }],
  ['skipped job', { job: 'skipped' }], ['old PR HEAD', { head: base }],
  ['base not in HEAD', { behind: true }], ['wrong remote', { remote: 'https://github.com/other/repo' }],
  ['uncommitted work', { dirty: ' M AGENTS.md' }],
]) test(`refuses ${name} before mutation`, async () => {
  const { state, io } = fixture(); Object.assign(state, change);
  await assert.rejects(ship(options, io)); assert.equal(state.calls.length, 0);
});

for (const [name, change] of [
  ['missing run', { runs: false }], ['run for another HEAD', { runHead: base }], ['push run', { event: 'push' }],
]) test(`never merges for ${name}`, async () => {
  const { state, io } = fixture(); Object.assign(state, change);
  await assert.rejects(ship(options, io, async () => { throw new Error('still waiting'); }, () => {}), /still waiting/);
  assert.equal(state.calls.length, 0);
});

test('pure Markdown/docs lot uses the documented exception', async () => {
  const { state, io } = fixture(); state.paths = 'AGENTS.md\ndocs/etat_courant.md'; state.runs = false;
  const result = await ship(options, io); assert.equal(result.docsOnly, true); assert.equal(result.run, null);
});
test('a workflow change cannot use the docs exception', async () => {
  const { state, io } = fixture(); state.paths = WORKFLOW; state.conclusion = 'failure';
  await assert.rejects(ship(options, io)); assert.equal(state.calls.length, 0);
});
test('refuses a base race immediately before merge', async () => {
  const { state, io } = fixture(); const api = io.api; let reads = 0;
  io.api = (path, fields) => path === 'git/ref/heads/main' && ++reads === 2 ? { object: { sha: head } } : api(path, fields);
  await assert.rejects(ship(options, io), /main moved before merge/); assert.equal(state.calls.length, 0);
});
test('detects a base race during merge even when the tree stays equal', async () => {
  const { io } = fixture(); const api = io.api;
  io.api = (path, fields) => path.startsWith('git/commits/') ? { sha: merged, tree: { sha: tree }, parents: [{ sha: head }] } : api(path, fields);
  await assert.rejects(ship(options, io), /Base changed during merge/);
});
test('never reports success for a different merged tree', async () => {
  const { state, io } = fixture(); state.tree = base;
  await assert.rejects(ship(options, io), /Merged tree differs/);
});
test('check mode does not mutate GitHub', async () => {
  const { state, io } = fixture(); const result = await ship({ ...options, merge: false }, io);
  assert.equal(result.head, head); assert.equal(state.calls.length, 0);
});

for (const [name, update] of [
  ['foreign repository', pr => { pr.head.repo.full_name = 'other/repo'; }],
  ['wrong base branch', pr => { pr.base.ref = 'develop'; }],
  ['draft PR', pr => { pr.draft = true; }],
  ['closed PR', pr => { pr.state = 'closed'; }],
]) test(`refuses ${name}`, async () => {
  const { state, io } = fixture(); const api = io.api;
  io.api = (path, fields) => { const value = api(path, fields); if (path === 'pulls/7') update(value); return value; };
  await assert.rejects(ship(options, io)); assert.equal(state.calls.length, 0);
});
test('a later failed quality run supersedes an earlier green run', async () => {
  const { state, io } = fixture(); const pages = io.pages;
  io.pages = path => {
    const result = pages(path);
    if (!path.includes('/jobs')) result.push({ workflow_runs: [{ ...result[0].workflow_runs[0], id: 11, conclusion: 'failure' }] });
    return result;
  };
  await assert.rejects(ship(options, io), /Run 11: failure/); assert.equal(state.calls.length, 0);
});

test('real Git: an updated branch squashes to its HEAD tree; a moved base is rejected', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ava-ct1-git-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    git('init', '-b', 'main'); git('config', 'user.email', 'test@example.invalid'); git('config', 'user.name', 'CT1 Test');
    writeFileSync(join(dir, 'base'), 'base'); git('add', '.'); git('commit', '-m', 'base'); const original = git('rev-parse', 'HEAD');
    git('checkout', '-b', 'feature'); writeFileSync(join(dir, 'feature'), 'feature'); git('add', '.'); git('commit', '-m', 'feature');
    const feature = git('rev-parse', 'HEAD'); git('merge-base', '--is-ancestor', original, feature);
    const expectedTree = git('rev-parse', 'HEAD^{tree}'); git('checkout', 'main'); git('merge', '--squash', 'feature'); git('commit', '-m', 'squash');
    assert.equal(git('rev-parse', 'HEAD^{tree}'), expectedTree);
    writeFileSync(join(dir, 'changed-base'), 'concurrent'); git('add', '.'); git('commit', '-m', 'base moved');
    assert.throws(() => git('merge-base', '--is-ancestor', 'main', feature));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
