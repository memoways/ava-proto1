import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const wrapper = resolve('.github/scripts/github-1password.sh');
const helper = resolve('.github/scripts/github-1password-credential.sh');
function fixture() {
 const dir = mkdtempSync(join(tmpdir(), 'ava-op-test-'));
 const marker = join(dir, 'child.json');
 const bin = (name, body) => writeFileSync(join(dir, name), `#!/bin/bash\n${body}\n`, { mode: 0o700 });
 bin('git', 'case "$*" in remote) printf origin ;; "remote get-url origin"|"remote get-url --all origin"|"remote get-url --push --all origin") printf "%s" "${TEST_REMOTE:-https://github.com/memoways/ava-proto1.git}" ;; *) exit 99 ;; esac');
 bin('op', '[[ "$*" == run\\ --* ]] || exit 98; [[ "${TEST_LOCKED:-}" != 1 ]] || exit 51; shift 2; export GH_TOKEN="${TEST_TOKEN:-ghp_synthetic_test_only}"; exec "$@"');
 bin('security', 'exit 97');
 bin('gh', `"${process.execPath}" -e 'const fs=require("fs"); const e=process.env; fs.writeFileSync(e.TEST_MARKER,JSON.stringify({tokenInjected:e.GH_TOKEN==="ghp_synthetic_test_only",config:e.GH_CONFIG_DIR,keys:[e.GIT_CONFIG_KEY_0,e.GIT_CONFIG_VALUE_0,e.GIT_CONFIG_KEY_1,e.GIT_CONFIG_VALUE_1,e.GIT_CONFIG_KEY_2,e.GIT_CONFIG_VALUE_2],prompt:e.GIT_TERMINAL_PROMPT,askpass:e.GIT_ASKPASS,ssh:e.GIT_SSH_COMMAND,askpassConfig:e.GIT_CONFIG_VALUE_3,interactive:e.GIT_CONFIG_VALUE_4,otherToken:e.GITHUB_TOKEN??null}));'`);
 const env = { ...process.env, PATH: `${dir}:${process.env.PATH}`, TEST_MARKER: marker, AVA_GITHUB_1PASSWORD_CONFIG: join(dir, 'no-real-config'), AVA_GITHUB_TOKEN_REFERENCE: 'op://fixture/github/token', GH_TOKEN: 'must_not_use_personal', GITHUB_TOKEN: 'must_not_use_personal', GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'credential.helper', GIT_CONFIG_VALUE_0: 'osxkeychain' };
 return { dir, marker, env, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}
test('1Password launcher refuses absent references and foreign remotes before consulting any secret', () => {
 const f = fixture(); try {
  let r = spawnSync('bash', [wrapper, 'gh', 'api', 'user'], { env: { ...f.env, AVA_GITHUB_TOKEN_REFERENCE: '' }, encoding: 'utf8' });
  assert.equal(r.status, 1); assert.match(r.stderr, /aucun repli personnel/); assert.equal(existsSync(f.marker), false);
  r = spawnSync('bash', [wrapper, 'gh', 'api', 'user'], { env: { ...f.env, TEST_REMOTE: 'https://github.com/other/repo' }, encoding: 'utf8' });
  assert.equal(r.status, 1); assert.match(r.stderr, /Remote Ava incorrect/); assert.equal(existsSync(f.marker), false);
 } finally { f.cleanup(); }
});
test('locked 1Password or invalid credential stops without gh, Git auth fallback or Keychain', () => {
 const f = fixture(); try {
  const locked = spawnSync('bash', [wrapper, 'gh', 'api', 'user'], { env: { ...f.env, TEST_LOCKED: '1' }, encoding: 'utf8' });
  assert.equal(locked.status, 51); assert.equal(existsSync(f.marker), false);
  const invalid = spawnSync('bash', [wrapper, 'gh', 'api', 'user'], { env: { ...f.env, TEST_TOKEN: 'password-not-a-token' }, encoding: 'utf8' });
  assert.equal(invalid.status, 1); assert.equal(existsSync(f.marker), false); assert.doesNotMatch(invalid.stderr + invalid.stdout, /password-not-a-token|must_not_use_personal/);
 } finally { f.cleanup(); }
});
test('injects only process-scoped credentials, resets old Git helpers and cleans isolated gh state', () => {
 const f = fixture(); try {
  const r = spawnSync('bash', [wrapper, 'gh', 'api', 'user'], { env: f.env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const child = JSON.parse(readFileSync(f.marker, 'utf8'));
  assert.equal(child.tokenInjected, true); assert.equal(child.otherToken, null); assert.equal(child.prompt, '0'); assert.equal(child.askpass, '/usr/bin/false'); assert.equal(child.ssh, '/usr/bin/false'); assert.equal(child.askpassConfig, '/usr/bin/false'); assert.equal(child.interactive, 'false');
  assert.deepEqual(child.keys.slice(0, 3), ['credential.helper', '', 'credential.helper']); assert.match(child.keys[3], /github-1password-credential.sh/);
  assert.deepEqual(child.keys.slice(4), ['credential.useHttpPath', 'true']); assert.equal(existsSync(child.config), false);
  assert.doesNotMatch(r.stdout + r.stderr, /ghp_synthetic|must_not_use_personal/);
 } finally { f.cleanup(); }
});
test('credential helper only supplies an in-memory token for the exact Ava HTTPS path; store is a no-op', () => {
 const env = { ...process.env, GH_TOKEN: 'ghp_synthetic_test_only' };
 const ask = (host, path, action = 'get') => spawnSync('bash', [helper, action], { env, input: `protocol=https\nhost=${host}\npath=${path}\n\n`, encoding: 'utf8' });
 assert.equal(ask('github.com', 'memoways/ava-proto1.git').stdout, 'username=x-access-token\npassword=ghp_synthetic_test_only\n');
 assert.equal(ask('github.com', 'other/repo').stdout, ''); assert.equal(ask('evil.test', 'memoways/ava-proto1').stdout, '');
 assert.equal(ask('github.com', 'memoways/ava-proto1', 'store').stdout, '');
});
