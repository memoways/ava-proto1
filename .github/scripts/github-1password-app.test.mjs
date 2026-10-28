import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import { installationToken, deliveryEnvironment } from './github-1password-app.mjs';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const config = { appId: '123', installationId: '456', privateKey: pem };
test('App key from memory requests exactly Ava, minimal write rights and Actions read', async () => {
 const token = await installationToken(config, async (url, options) => {
  assert.equal(url, 'https://api.github.com/app/installations/456/access_tokens');
  assert.deepEqual(JSON.parse(options.body), { repositories: ['ava-proto1'], permissions: { contents: 'write', pull_requests: 'write', actions: 'read' } });
  const [header, payload, signature] = options.headers.Authorization.slice(7).split('.');
  assert.equal(verify('RSA-SHA256', Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, 'base64url')), true);
  assert.deepEqual(JSON.parse(Buffer.from(payload, 'base64url')), { iat: 940, exp: 1480, iss: '123' });
  return { status: 201, json: async () => ({ token: 'ghs_synthetic', repositories: [{ full_name: 'memoways/ava-proto1' }] }) };
 }, 1000000);
 assert.equal(token, 'ghs_synthetic');
});
test('invalid config, key, refused API and broader repository sets fail explicitly', async () => {
 await assert.rejects(installationToken({ ...config, appId: '' }), /Configuration/);
 await assert.rejects(installationToken({ ...config, privateKey: 'PRIVATE KEY invalid' }), /Clé GitHub/);
 await assert.rejects(installationToken(config, async () => ({ status: 403 })), /refusé \(403\)/);
 await assert.rejects(installationToken(config, async () => ({ status: 201, json: async () => ({ token: 'ghs_synthetic', repositories: [{ full_name: 'other/repo' }] }) })), /hors du dépôt/);
 await assert.rejects(installationToken(config, async () => ({ status: 201, json: async () => ({ token: 'ghs_synthetic', repositories: [{ full_name: 'memoways/ava-proto1' }, { full_name: 'other/repo' }] }) })), /hors du dépôt/);
});

test('delivery child cannot inherit the App private key and cannot trigger personal auth fallback', () => {
 const env = deliveryEnvironment({ AVA_GITHUB_APP_PRIVATE_KEY: 'synthetic-key', AVA_GITHUB_APP_KEY_REFERENCE: 'op://fixture' }, 'ghs_synthetic');
 assert.equal(env.AVA_GITHUB_APP_PRIVATE_KEY, undefined); assert.equal(env.AVA_GITHUB_APP_KEY_REFERENCE, undefined);
 assert.equal(env.GIT_SHIP_GITHUB_APP_ACTIVE, '1'); assert.equal(env.GIT_SHIP_1PASSWORD_ACTIVE, '1');
 assert.equal(env.GIT_SHIP_GITHUB_APP_REPOSITORY, 'memoways/ava-proto1');
});
