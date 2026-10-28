import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import { runDeliverySession, cachedToken, validateSessionCommand } from './github-1password-session.mjs';
import { deliveryEnvironment } from './github-1password-app.mjs';
function harness(requests) {
 let text='';
 return { input: Readable.from(requests.map(request=>JSON.stringify(request)+'\n')), output: new Writable({write(chunk,encoding,done){text+=chunk;done();}}), messages:()=>text.trim().split('\n').filter(Boolean).map(JSON.parse) };
}
test('one in-memory credential serves successive commands, including after a failed child', async () => {
 const h=harness([{id:1,command:'gh',args:['api','repos/memoways/ava-proto1']},{id:2,command:'git',args:['fetch','origin']},{id:3,command:'node',args:['.github/scripts/ship-pr.mjs','--pr','111']},{command:'exit'}]);
 let exchanges=0;const calls=[];
 const result=await runDeliverySession({...h,issuer:async()=>{exchanges++;return 'ghs_synthetic.jwt.signature';},environment:token=>deliveryEnvironment({AVA_GITHUB_APP_PRIVATE_KEY:'must-not-reach-child'},token),checkRemote:()=>{},run:async(command,args,env)=>{calls.push({command,env});return calls.length===2?1:0;}});
 assert.equal(result,0);assert.equal(exchanges,1);assert.equal(calls.length,3);
 assert(calls.every(call=>call.env.GH_TOKEN==='ghs_synthetic.jwt.signature'&&!call.env.AVA_GITHUB_APP_PRIVATE_KEY&&call.env.GIT_SHIP_GITHUB_APP_ACTIVE==='1'));
 assert.deepEqual(h.messages().filter(m=>m.kind==='result').map(m=>m.code),[0,1,0]);
 assert(!JSON.stringify(h.messages()).includes('ghs_synthetic'));
});
test('token renewal uses the existing issuer, while failed renewal ends the session without retry', async () => {
 let time=0;let exchanges=0;const get=cachedToken(async()=>{exchanges++;if(exchanges===3)throw Error('refused');return `token-${exchanges}`;},()=>time);
 assert.equal(await get(),'token-1');time=49*60000;assert.equal(await get(),'token-1');time=50*60000;assert.equal(await get(),'token-2');
 assert.equal(exchanges,2);
 time=71*60000;assert.equal(await get(),'token-2');
 await assert.rejects(get(40*60000),/refused/);assert.equal(exchanges,3);
 const h=harness([{id:1,command:'git',args:['status']},{id:2,command:'gh',args:['api','repos/memoways/ava-proto1']},{id:3,command:'git',args:['status']}]);
 let issued=0;let ran=0;
 assert.equal(await runDeliverySession({...h,issuer:async()=>{if(++issued===2)throw Error('refused');return 'fixture';},environment:()=>({}),now:()=>time,checkRemote:()=>{},run:async()=>{ran++;time+=50*60000;return 0;}}),1);
 assert.equal(issued,2);assert.equal(ran,1);assert.match(h.messages().at(-1).reason,/aucun retry/);
});
test('invalid commands, missing remote and elapsed session fail without additional authentication', async () => {
 for(const [command,args] of [['gh',['auth','login']],['bash',['-c','anything']],['node',['other.mjs']],['git',['credential','fill']]])assert.throws(()=>validateSessionCommand(command,args));
 let exchanges=0;const h=harness([{id:1,command:'gh',args:['auth','status']},{command:'exit'}]);
 await runDeliverySession({...h,issuer:async()=>{exchanges++;return 'fixture';},environment:()=>({}),checkRemote:()=>{},run:async()=>{throw Error('must not run');}});
 assert.equal(exchanges,1);assert(h.messages().some(m=>m.kind==='refused'));
 const missing=harness([]);exchanges=0;
 assert.equal(await runDeliverySession({...missing,issuer:async()=>{exchanges++;return 'fixture';},environment:()=>({}),checkRemote:()=>{throw Error('wrong remote');}}),1);assert.equal(exchanges,0);
 let time=0;const expired=harness([{id:1,command:'git',args:['status']},{id:2,command:'git',args:['status']}]);let ran=0;
 await runDeliverySession({...expired,issuer:async()=> 'fixture',environment:()=>({}),checkRemote:()=>{},now:()=>time,lifetimeMs:1000,run:async()=>{ran++;time=1001;return 0;}});
 assert.equal(ran,1);assert(expired.messages().some(m=>m.kind==='refused'));
});

import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
test('the real launcher reads a fake vault once for a complete multi-command session and cleans up', () => {
 const dir=mkdtempSync(join(tmpdir(),'ava-session-test-'));
 const marker=join(dir,'op-calls'),children=join(dir,'children'),forbidden=join(dir,'forbidden');
 const pem=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs8',format:'pem'}).toString();
 const token=`ghs_123_${'a'.repeat(220)}.${'b'.repeat(220)}.synthetic`;
 const bin=(name,body)=>writeFileSync(join(dir,name),`#!/bin/bash\nset -euo pipefail\n${body}\n`,{mode:0o700});
 try {
  bin('git','case "$*" in remote) printf origin ;; "remote get-url origin"|"remote get-url --all origin"|"remote get-url --push --all origin") printf %s https://github.com/memoways/ava-proto1.git ;; *) exit 99 ;; esac');
  bin('op','[[ "$*" == run\\ --* ]] || exit 98; echo read >> "$TEST_OP_MARKER"; shift 2; export AVA_GITHUB_APP_PRIVATE_KEY="$TEST_PRIVATE_KEY"; unset TEST_PRIVATE_KEY; exec "$@"');
  bin('security','echo forbidden >> "$TEST_FORBIDDEN"; exit 97');
  bin('gh',`'${process.execPath}' -e 'const e=process.env;require("fs").appendFileSync(e.TEST_CHILD_MARKER,JSON.stringify({tokenCorrect:e.GH_TOKEN===e.TEST_EXPECTED_TOKEN,keyAbsent:!e.AVA_GITHUB_APP_PRIVATE_KEY&&!e.TEST_PRIVATE_KEY,appOnly:e.GIT_SHIP_GITHUB_APP_ACTIVE==="1",config:e.GH_CONFIG_DIR,helpersReset:e.GIT_CONFIG_VALUE_0===""})+"\\n");'`);
  bin('git-ship','gh api repos/memoways/ava-proto1\ngh api repos/memoways/ava-proto1/pulls\ngh api repos/memoways/ava-proto1/actions/runs');
  const preload=join(dir,'issuer.mjs');
  writeFileSync(preload,`globalThis.fetch=async()=>({status:201,json:async()=>({token:${JSON.stringify(token)},repositories:[{full_name:'memoways/ava-proto1'}]})});`);
  const requests=[{id:1,command:'gh',args:['api','repos/memoways/ava-proto1']},{id:2,command:'git-ship',args:[]},{id:3,command:'gh',args:['api','repos/memoways/ava-proto1/actions/runs']},{command:'exit'}];
  const result=spawnSync('bash',[resolve('.github/scripts/github-1password.sh'),'session'],{encoding:'utf8',timeout:10000,input:requests.map(r=>JSON.stringify(r)+'\n').join(''),env:{...process.env,PATH:`${dir}:${process.env.PATH}`,NODE_OPTIONS:`--import=${preload}`,AVA_GITHUB_1PASSWORD_CONFIG:join(dir,'no-config'),AVA_GITHUB_APP_KEY_REFERENCE:'op://synthetic/app/key',AVA_GITHUB_APP_ID:'123',AVA_GITHUB_APP_INSTALLATION_ID:'456',TEST_PRIVATE_KEY:pem,TEST_OP_MARKER:marker,TEST_CHILD_MARKER:children,TEST_EXPECTED_TOKEN:token,TEST_FORBIDDEN:forbidden}});
  assert.equal(result.status,0,result.stderr);assert.equal(readFileSync(marker,'utf8').trim().split('\n').length,1);
  const calls=readFileSync(children,'utf8').trim().split('\n').map(JSON.parse);assert.equal(calls.length,5);
  assert.equal(new Set(calls.map(c=>c.config)).size,1);
  assert(calls.every(c=>c.tokenCorrect&&c.keyAbsent&&c.appOnly&&c.helpersReset&&!existsSync(c.config)));
  assert.equal(existsSync(forbidden),false);assert(!result.stdout.includes(token)&&!result.stderr.includes(token)&&!result.stdout.includes(pem));
  assert.equal(result.stdout.trim().split('\n').map(JSON.parse).filter(m=>m.kind==='result').length,3);
 } finally {rmSync(dir,{recursive:true,force:true});}
});
