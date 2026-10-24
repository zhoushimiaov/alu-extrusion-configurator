import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('CI import-case check accepts cache-busting queries on relative modules',()=>{
  const result=spawnSync(process.execPath,['tools/check-import-case.mjs'],{
    cwd:process.cwd(),
    encoding:'utf8',
  });
  assert.equal(result.status,0,result.stdout+result.stderr);
  assert.match(result.stdout,/未发现大小写不匹配的导入路径/);
});
