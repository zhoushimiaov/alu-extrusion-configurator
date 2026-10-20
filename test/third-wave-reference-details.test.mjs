// MEKIT P2 第三轮：参考模型构造对位验证（不仅凭截图判断）。
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildRodRack } from '../src/core/buildRodRack.js';
import { buildBookshelf } from '../src/core/buildBookshelf.js';
import { buildSheetCabinet } from '../src/core/buildSheetCabinet.js';
import { buildPurchaseRows } from '../src/ui/purchaseList.js';

const noCanvasGradient={addColorStop(){}};
const noCanvasContext=new Proxy({},{
  get(_t,key){return key==='createLinearGradient'||key==='createRadialGradient'?()=>noCanvasGradient:()=>{};},
  set(){return true;},
});
globalThis.document={createElement:()=>({width:256,height:256,getContext:()=>noCanvasContext})};
const { buildWoodCart } = await import('../src/core/buildWoodCart.js');

const near=(a,b,msg,eps=1e-5)=>assert.ok(Math.abs(a-b)<=eps,`${msg}: ${a} vs ${b}`);
function inst(mesh,i){
  const mat=new THREE.Matrix4();
  mesh.getMatrixAt(i,mat);
  const p=new THREE.Vector3(),q=new THREE.Quaternion(),sc=new THREE.Vector3();
  mat.decompose(p,q,sc);
  return {p,sc};
}

test('WUDA 双联展板：三根独立落地光轴、两块同面长幅板、12只板边夹和6个着地点',()=>{
  const p=buildRodRack({style:'panel',width:0.9,height:1.0,backPanel:'none',shelf:'none'});
  try{
    assert.equal(p.groups.posts.count,2);
    assert.equal(p.groups.panelCenterPost.count,1);
    assert.equal(p.groups.panelCenterFork.count,1);
    assert.equal(p.groups.panelCenterBraces.count,2);
    assert.equal(p.groups.panels.count,2);
    assert.equal(p.groups.clips.count,12);
    assert.equal(p.groups.panelCenterAxleLinks.count,2);
    assert.equal(p.groups.panelCenterTopCollars.count,2);
    assert.equal(p.groups.panelOuterAxleSleeves.count,4);
    for(let i=0;i<p.groups.forks.count;i++)
      near(inst(p.groups.forks,i).sc.z,0.4,'outer fork rod must reach wheel-end blocks');
    near(inst(p.groups.panelCenterFork,0).sc.z,0.4,'middle fork rod reaches both wheels');
    assert.equal(p.stats.supports.points.length,6);
    const a=inst(p.groups.panels,0),b=inst(p.groups.panels,1);
    near(a.p.y,b.p.y,'board centers level');
    near(a.p.z,b.p.z,'both panels aligned on one face');
    assert.ok(a.sc.y>0.55,'WUDA panel is tall and readable, not a half-height top strip');
    assert.ok(a.p.x<0&&b.p.x>0);
    const poles=p.stats.cutList.find(x=>x.spec==='光轴立柱');
    assert.equal(poles.qty,3);
    const panelBom=p.stats.cutList.find(x=>x.spec==='双联白色展板 12mm');
    assert.equal(panelBom.qty,2);
    near(panelBom.thickness,0.012,'board physical thickness');
  }finally{p.dispose();}
});

test('阅读长桌：玻璃副层板所有支座完整创建，2mm垫片严格接触玻璃，台面双杆承托且采购不重复',()=>{
  for(const n of [1,3]){
    const p=buildBookshelf({style:'table',tBays:n,tBayW:0.7,glassTop:true});
    try{
      const {tableGlass,tableGlassStandoffs,tableGlassPads,tableUnderRails,tableTop,tableTopJoints}=p.groups;
      const W=n*0.7;
      assert.equal(tableGlassStandoffs.count,2*(n+1));
      assert.equal(tableGlassPads.count,2*(n+1));
      assert.equal(tableUnderRails.count,2);
      assert.equal(tableTopJoints.count,2*(n+1));
      const bottom=tableGlass.position.y-tableGlass.geometry.parameters.height/2;
      for(let i=0;i<tableGlassPads.count;i++){
        const pad=inst(tableGlassPads,i),stand=inst(tableGlassStandoffs,i);
        near(stand.p.y+0.094/2,pad.p.y-0.002/2,'standoff touches pad bottom');
        near(pad.p.y+0.002/2,bottom,'pad touches glass underside');
        assert.ok(Math.abs(stand.p.x)<=W/2,'stand lies inside glass envelope');
      }
      const boardBottom=tableTop.position.y-tableTop.geometry.parameters.height/2;
      for(let i=0;i<2;i++){
        const under=inst(tableUnderRails,i);
        near(under.p.y+0.006,boardBottom,'underrail bears on board underside');
      }
      // 两档横杆必须贯穿长桌全宽，每条立柱线都具有真实Z向连接及三标高抱箍。
      assert.equal(p.groups.tableContinuousRails.count,4);
      assert.equal(p.groups.tableDepthTies.count,(n+1)*2);
      assert.equal(p.groups.tableJointCollars.count,(n+1)*2*3);
      assert.equal(p.groups.tableLevelFeet.count,(n+1)*2);
      for(let i=0;i<4;i++){
        const rail=inst(p.groups.tableContinuousRails,i);
        near(rail.sc.x,W+0.026,'full length rail crosses all intermediate table legs');
      }
      const plank=p.stats.cutList.find(x=>x.spec.includes('长桌台面'));
      assert.equal(plank.qty,1,'one continuous tabletop, not one full-length piece per bay');
      near(plank.width,p.config.depth+0.34,'top full depth');
      const glassRows=buildPurchaseRows(p.stats,'books',p.config).detail
        .filter(x=>(x[0]==='板件'||x[0]==='板材/面材')&&x[1].includes('玻璃副层板'));
      assert.equal(glassRows.length,1,'one glass purchasing entry; panes must not duplicate it');
    }finally{p.dispose();}
  }
});

test('镀锌板书架：原模型不改网格，右侧真实薄金属收口；折边从18mm减到8mm',async()=>{
  const a=await buildSheetCabinet({thicknessMm:1.5,finish:'zinc',folds:true});
  const b=await buildSheetCabinet({thicknessMm:1,finish:'satin',folds:false});
  try{
    for(const p of [a,b]){
      const cap=p.groups.rightEndClosure;
      assert.ok(cap);
      assert.equal(cap.children[0].name,'RightEndCapThinSheet');
      near(cap.children[0].geometry.parameters.width,p.stats.displayDetails.thicknessMm/1000,'actual thin edge cap');
      near(cap.children[0].position.x,p.bounds.W/2-0.008,'right-edge termination');
      assert.equal(p.stats.meshCount,44,'same Rhino original meshes');
      assert.equal(p.stats.prototypeOnly,true);
      assert.equal(p.stats.cutList.length,0,'do not pretend display shell is verified cut list');
    }
    assert.equal(a.groups.rightEndClosure.children.length,2,'zinc finish has folded right rim');
    assert.equal(b.groups.rightEndClosure.children.length,1,'fold switch controls return rim');
    assert.equal(a.stats.displayDetails.rightEndClosure,true);
    const trim=[];
    a.group.traverse(o=>{if(o.name==='FrontHem')trim.push(o);});
    assert.ok(trim.length>0);
    near(trim[0].geometry.parameters.height,0.008,'fold lip is 8mm tall');
  }finally{a.dispose();b.dispose();}
});

test('木展车：夹块顶面紧贴对应板底，底板夹块不能悬在板面上；封边与层板同位',()=>{
  const p=buildWoodCart({shelves:2,cabinetH:1.18});
  try{
    const c=p.groups.shelfClamps;
    assert.equal(c.geometry.parameters.width,0.028);
    assert.equal(c.geometry.parameters.height,0.018);
    assert.equal(c.count,16);
    const layers=[p.groups.shelfBoards,p.groups.top,p.groups.bottom];
    const allBoardUndersides=[];
    for(const mesh of layers)for(let i=0;i<mesh.count;i++){
      const v=inst(mesh,i);
      allBoardUndersides.push(v.p.y-mesh.geometry.parameters.height*v.sc.y/2);
    }
    for(let i=0;i<c.count;i++){
      const v=inst(c,i);
      const clampTop=v.p.y+0.009;
      assert.ok(allBoardUndersides.some(y=>Math.abs(y-clampTop)<1e-5),
        'all clamp tops must meet a structural plywood underside');
    }
    assert.equal(p.groups.frontEdgeBands.count,3);
    assert.ok(p.groups.frontEdgeBands.userData.displayOnly);
    assert.equal(p.stats.supports.points.length,4);
  }finally{p.dispose();}
});
