import test from 'node:test';
import assert from 'node:assert/strict';
import { bookshelfStore, tableStore } from '../src/ui/bookshelfPanel.js';
import { buildBookshelf } from '../src/core/buildBookshelf.js';
import { pickPersisted } from '../src/ui/persist.js';
import { buildPurchaseRows } from '../src/ui/purchaseList.js';

test('阅读长桌是独立tab与配置域：修改长桌不改变光轴杂志架；样式由Tab锁定',()=>{
  const beforeBook={...bookshelfStore.get()},beforeTable={...tableStore.get()};
  try{
    assert.equal(bookshelfStore.get().kind,'books');
    assert.equal(tableStore.get().kind,'table');
    assert.equal(tableStore.get().style,'table');
    bookshelfStore.set({bays:2,levels:6,style:'table'});
    assert.equal(bookshelfStore.get().style,'tower','书架不能经隐藏旧STYLE开关误变为桌子');
    tableStore.set({tBays:2,tBayW:0.85,glassTop:false,style:'tower'});
    assert.equal(tableStore.get().style,'table','阅读长桌不能回退为展示杂志架');
    assert.equal(tableStore.get().tBays,2);
    assert.equal(tableStore.get().tBayW,0.85);
    assert.equal(bookshelfStore.get().levels,6);
    assert.notEqual(bookshelfStore.get().tBayW,tableStore.get().tBayW);
    const saved=pickPersisted('table',tableStore.get());
    assert.equal(saved.kind,'table');
    assert.equal(saved.tBays,2);
    const table=buildBookshelf(tableStore.get());
    try{
      assert.equal(table.config.style,'table');
      assert.ok(table.groups.tableTop);
      assert.equal(table.groups.tableGlass,undefined);
      const rows=buildPurchaseRows(table.stats,'table',table.config);
      assert.ok(rows.summary.every(row=>row[8]==='阅读长桌'));
      assert.equal(table.groups.tableContinuousRails.count,4);
      assert.equal(table.groups.tableDepthTies.count,6);
      assert.equal(table.groups.tableJointCollars.count,18);
      assert.equal(table.groups.tableLevelFeet.count,6);
    } finally{table.dispose();}
  } finally {bookshelfStore.set(beforeBook);tableStore.set(beforeTable);}
});
