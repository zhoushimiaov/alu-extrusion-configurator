import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { buildPurchaseRows, purchaseCsv, purchaseXlsx } from '../src/ui/purchaseList.js';
import { buildHanger } from '../src/core/buildHanger.js';
import { buildBookshelf } from '../src/core/buildBookshelf.js';
import { bookshelfStore } from '../src/ui/bookshelfPanel.js';
import { calcMarketPrice } from '../src/ui/marketPrice.js';

test('真实OOXML XLSX：包含采购汇总和逐件明细、头部和ZIP目录，板材未知尺寸不假造', () => {
  const stats = {
    cutList: [
      {spec:'20×20 工业型材',section:'20×20',len:0.8,qty:2},
      {spec:'20×20 工业型材',section:'20×20',len:0.8,qty:3},
      {spec:'层板',section:'板',len:0.7,qty:2,pricedViaPane:true},
    ],
    hardware:[{name:'螺钉M4',qty:12}],
    panes:[{label:'层板',kind:'zinc',areaM2:0.42}],
  };
  const rows=buildPurchaseRows(stats,'profile',{});
  assert.equal(rows.detail.length,4);
  assert.equal(rows.summary.length,3);
  assert.equal(rows.summary.find(r=>r[1]==='20×20 工业型材')[7],5);
  assert.equal(rows.summary.find(r=>r[1]==='层板')[5],'', 'unknown panel thickness must not be invented');
  assert.equal(rows.detail.filter(r=>r[1]==='层板').length,1,'pane must not double-count a board');
  const xlsx=purchaseXlsx(stats,'profile',{});
  assert.ok(xlsx instanceof Uint8Array);
  assert.deepEqual([...xlsx.slice(0,4)],[0x50,0x4b,0x03,0x04],'actual ZIP/XLSX signature');
  const bytes=new TextDecoder();
  const xml=bytes.decode(xlsx);
  assert.ok(xml.includes('[Content_Types].xml'));
  assert.ok(xml.includes('xl/workbook.xml'));
  assert.ok(xml.includes('xl/worksheets/sheet1.xml'));
  assert.ok(xml.includes('xl/worksheets/sheet2.xml'));
  assert.ok(xml.includes('采购汇总') && xml.includes('逐件明细'));
  assert.ok(xlsx.length>1200);
  const csv=purchaseCsv(stats,'profile',{});
  assert.ok(csv.startsWith('\ufeff'));
  assert.ok(csv.includes('"数量"'));
  assert.ok(csv.includes('"5"') || csv.includes('"5"'));
  const malicious=purchaseCsv({cutList:[],hardware:[{name:'=HYPERLINK("http://bad")',qty:1}],panes:[]},'rod',{});
  assert.ok(malicious.includes("'=HYPERLINK"),'CSV formulas never execute on opening');
});

test('展示杂志架放宽到4跨8层但禁止无限超界，拉索每根与端件同时计量', () => {
  bookshelfStore.set({style:'tower',bays:100,levels:100});
  assert.equal(bookshelfStore.get().bays,4);
  assert.equal(bookshelfStore.get().levels,8);
  bookshelfStore.set({style:'tower',bays:2,levels:4});
  const c={style:'tower',bays:3,levels:6,base:false,books:false,acrylic:false};
  const no=buildBookshelf({...c,wires:false}),yes=buildBookshelf({...c,wires:true});
  try {
    const wires=6*(3+1)*2;
    assert.equal(yes.groups.wires.count,wires);
    assert.equal(yes.groups.wireEnds.count,wires*2);
    assert.ok(yes.stats.cutList.some(x=>x.section==='钢索Ø2.4'&&x.qty===wires&&x.len>0));
    assert.ok(yes.stats.hardware.some(x=>x.name.startsWith('X拉索张紧端件')&&x.qty===wires*2));
    assert.equal(yes.stats.partCount-no.stats.partCount,wires*3,'one cable plus two real endpoints');
    assert.ok(yes.stats.weightKg>no.stats.weightKg);
    const quoteNo=calcMarketPrice(no.stats),quoteYes=calcMarketPrice(yes.stats);
    assert.ok(quoteYes.total>quoteNo.total,'option must change price even with remote market table missing wire rules');
  }finally{no.dispose();yes.dispose();}
});

test('经典挂衣架双侧X钢索切换与实际模型端件/报价一致',()=>{
  const c={style:'classic',width:1.4,depth:0.5,height:2.4,sideWires:false};
  const no=buildHanger(c),yes=buildHanger({...c,sideWires:true});
  try {
    assert.equal(no.groups.sideWires,undefined);
    assert.equal(yes.groups.sideWires.children.length,4);
    assert.equal(yes.groups.sideWireEnds.children.length,8);
    assert.equal(yes.stats.partCount-no.stats.partCount,12);
    assert.ok(yes.stats.cutList.some(x=>x.section==='钢索Ø2.4'&&x.qty===4));
    assert.ok(yes.stats.hardware.some(x=>x.name.includes('X拉索张紧端件')&&x.qty===8));
    assert.ok(calcMarketPrice(yes.stats).total>calcMarketPrice(no.stats).total);
  }finally{no.dispose();yes.dispose();}
});

test('铝型材架无书挡默认不产生孤立站立杂志',()=>{
  const source=readFileSync(new URL('../src/core/buildGlbFrame.js',import.meta.url),'utf8');
  const kinds=source.match(/const kinds = \[([^\]]+)\]/)?.[1]||'';
  assert.ok(kinds);
  assert.ok(!kinds.includes('elMagStanding'),'random prop generator must never choose unsupported standing magazines');
});
