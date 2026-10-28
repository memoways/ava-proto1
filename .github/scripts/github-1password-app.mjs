import { sign } from 'node:crypto';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** Exchange an in-memory 1Password App key for one Ava-scoped installation token. */
export async function installationToken({ appId, installationId, privateKey }, fetcher = fetch, now = Date.now()) {
 if (!/^\d+$/.test(appId ?? '') || !/^\d+$/.test(installationId ?? '') || !privateKey?.includes('PRIVATE KEY')) throw new Error('Configuration GitHub App 1Password absente ou invalide.');
 const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
 const issued = Math.floor(now / 1000);
 const message = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iat: issued - 60, exp: issued + 480, iss: appId })}`;
 let signature;
 try { signature = sign('RSA-SHA256', Buffer.from(message), privateKey).toString('base64url'); }
 catch { throw new Error('Clé GitHub App 1Password invalide ; aucun repli personnel.'); }
 const response = await fetcher(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
  method: 'POST', signal: AbortSignal.timeout(12000),
  headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${message}.${signature}`, 'X-GitHub-Api-Version': '2026-03-10' },
  body: JSON.stringify({ repositories: ['ava-proto1'], permissions: { contents: 'write', pull_requests: 'write', actions: 'read' } }),
 });
 if (response.status !== 201) throw new Error(`Accès GitHub App refusé (${response.status}) ; aucun repli personnel.`);
 const data = await response.json();
 if (!/^ghs_[A-Za-z0-9_]+$/.test(data.token ?? '') || !Array.isArray(data.repositories) || data.repositories.length !== 1 || data.repositories[0].full_name !== 'memoways/ava-proto1') throw new Error('Jeton GitHub App hors du dépôt Ava ; exécution refusée.');
 return data.token;
}
export function deliveryEnvironment(source, token) {
 const env = { ...source, GH_TOKEN: token, GIT_SHIP_1PASSWORD_ACTIVE: '1', GIT_SHIP_GITHUB_APP_ACTIVE: '1', GIT_SHIP_GITHUB_APP_REPOSITORY: 'memoways/ava-proto1' };
 delete env.AVA_GITHUB_APP_PRIVATE_KEY;
 delete env.AVA_GITHUB_APP_KEY_REFERENCE;
 return env;
}
async function main() {
 const privateKey = process.env.AVA_GITHUB_APP_PRIVATE_KEY;
 delete process.env.AVA_GITHUB_APP_PRIVATE_KEY;
 delete process.env.AVA_GITHUB_APP_KEY_REFERENCE;
 try {
  const token = await installationToken({ appId: process.env.AVA_GITHUB_APP_ID, installationId: process.env.AVA_GITHUB_APP_INSTALLATION_ID, privateKey });
  const [command, ...args] = process.argv.slice(2);
  if (!command) throw new Error('Commande Ava manquante.');
  const child = spawn(command, args, { stdio: 'inherit', env: deliveryEnvironment(process.env, token) });
  child.on('error', () => { process.stderr.write('Impossible de lancer la commande Ava.\n'); process.exitCode = 1; });
  child.on('exit', (code, signal) => { process.exitCode = signal ? 1 : code ?? 1; });
 } catch (error) {
  process.stderr.write(error instanceof Error && /^(Configuration|Clé GitHub|Accès GitHub|Jeton GitHub|Commande Ava)/.test(error.message) ? `${error.message}\n` : 'Échange GitHub App indisponible ; aucun repli personnel.\n');
  process.exitCode = 1;
 }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
