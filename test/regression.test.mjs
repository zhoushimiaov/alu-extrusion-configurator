import test from 'node:test';
import assert from 'node:assert/strict';
import { calcMarketPrice } from '../src/ui/marketPrice.js';
import { loadSaved, encodeCfg, persist } from '../src/ui/persist.js';
import baselines from './baselines.mjs';
test('规格优先：2040命名的2020立柱不能按2040单价',()=>{
 const q=calcMarketPrice({cutList:[{spec:'2040 立柱',section:'20×20',len:1,qty:1}]});
 assert.equal(q.total,9);
});
test('未知规格显式报告，不静默计零',()=>{
 const q=calcMarketPrice({cutList:[{spec:'未知',section:'9999',len:1,qty:1}]});
 assert.equal(q.complete,false); assert.equal(q.unpriced.length,1);
});
test('分享配置不串产品，后台产品变化不覆盖当前URL',()=>{
 globalThis.location={hash:'#rod?c='+encodeCfg({width:0.9,color:'chrome'})};
 globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
 let changed=false; globalThis.history={replaceState:()=>{changed=true;}};
 assert.equal(loadSaved('profile'),null);
 assert.equal(loadSaved('rod').width,0.9);
 persist('profile',{color:'silver'}); assert.equal(changed,false);
});

// 基线锚定：数字集中在 baselines.mjs，改默认配置时更新该文件并在 commit 说明原因
test('基线快照文件结构与量级（文档漂移防线）', () => {
  for (const [kind, b] of Object.entries(baselines)) {
    assert.ok(b.weightKg > 0 && b.weightKg < 500, `${kind}.weightKg 量级异常`);
    assert.ok(b.partCount > 0 && b.partCount < 10000, `${kind}.partCount 量级异常`);
  }
  assert.deepEqual(Object.keys(baselines).sort(), ['cart', 'crates', 'profile', 'rod', 'woodcart']);
});
