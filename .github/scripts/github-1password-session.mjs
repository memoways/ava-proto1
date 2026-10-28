import { createInterface } from 'node:readline';
import { spawn, execFileSync } from 'node:child_process';

const remotePattern = /^https:\/\/github\.com\/memoways\/ava-proto1(?:\.git)?$/;
export function validateSessionCommand(command, args) {
 if (!Array.isArray(args) || args.length > 100 || args.some(arg => typeof arg !== 'string' || arg.includes('\0'))) throw new Error('Arguments de session invalides.');
 if (command === 'gh' && ['api', 'pr', 'run', 'repo'].includes(args[0])) return;
 if (command === 'git' && ['status', 'log', 'diff', 'show', 'fetch', 'push', 'pull', 'switch', 'checkout', 'branch', 'merge-base', 'rev-parse', 'remote', 'ls-remote'].includes(args[0])) return;
 if (command === 'node' && args[0] === '.github/scripts/ship-pr.mjs') return;
 if (command === 'git-ship') return;
 throw new Error('Session limitée à Git/gh Ava et à la garde ; aucune commande d’authentification.');
}
export function cachedToken(issuer, now = Date.now) {
 let value; let issued = 0;
 return async (minimumRemainingMs = 10 * 60_000) => {
  if (!value || now() - issued >= 60 * 60_000 - minimumRemainingMs) { value = await issuer(); issued = now(); }
  return value;
 };
}
function verifyRemote() {
 const read = args => execFileSync('git', args, { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
 if (read(['remote']) !== 'origin') throw new Error('Remote Ava incorrect ; session arrêtée.');
 for (const mode of [[], ['--push']]) {
  const urls = read(['remote', 'get-url', ...mode, '--all', 'origin']).split('\n');
  if (urls.length !== 1 || !remotePattern.test(urls[0])) throw new Error('Remote Ava incorrect ; session arrêtée.');
 }
}
export async function runDeliverySession({ issuer, environment, input = process.stdin, output = process.stdout, now = Date.now, run, checkRemote = verifyRemote, lifetimeMs = 2 * 60 * 60_000 }) {
 const emit = value => output.write(`${JSON.stringify(value)}\n`);
 const token = cachedToken(issuer, now);
 const started = now();
 let lines; let timer;
 try {
  checkRemote(); await token();
  lines = createInterface({ input, crlfDelay: Infinity });
  timer = setTimeout(() => { emit({ kind: 'closed', reason: 'Session expirée ; aucune réouverture automatique du coffre.' }); lines.close(); }, lifetimeMs);
  timer.unref?.();
  emit({ kind: 'ready', repository: 'memoways/ava-proto1', vaultReads: 1, lifetimeMs });
  for await (const line of lines) {
   if (!line.trim()) continue;
   let request;
   try {
    if (line.length > 65536) throw new Error('Commande trop longue.');
    request = JSON.parse(line);
    if (request.command === 'exit') { emit({ id: request.id, kind: 'closed' }); break; }
    validateSessionCommand(request.command, request.args);
    if (now() - started >= lifetimeMs) throw new Error('Session expirée.');
    checkRemote();
   } catch { emit({ id: request?.id, kind: 'refused', message: 'Commande ou contexte Ava invalide ; aucun nouvel accès au coffre.' }); continue; }
   // Refresh from the key already held by this process, never by invoking op again.
   // A guard may wait 35 minutes: keep enough lifetime for the whole command.
   const current = await token(['node', 'git-ship'].includes(request.command) ? 40 * 60_000 : 10 * 60_000);
   const env = environment(current);
   const execute = run ?? ((command, args, childEnv) => new Promise(resolve => {
    const child = spawn(command, args, { env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
    for (const stream of ['stdout', 'stderr']) child[stream].on('data', data => emit({ id: request.id, kind: stream, data: data.toString().replaceAll(current, '<redacted>') }));
    child.on('error', () => resolve(1));
    child.on('close', code => resolve(code ?? 1));
   }));
   const code = await execute(request.command, request.args, env);
   emit({ id: request.id, kind: 'result', code });
  }
 } catch {
  emit({ kind: 'closed', reason: 'Accès App indisponible ; session arrêtée, aucun retry du coffre ni repli personnel.' });
  return 1;
 } finally { clearTimeout(timer); lines?.close(); }
 return 0;
}
