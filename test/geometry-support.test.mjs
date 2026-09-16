import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {makeTSlotShape,extrudeAlongZ,extrudeAlongX,extrudeUp} from '../src/core/profiles.js';
import {buildShelf} from '../src/core/buildShelf.js';
import {DEFAULT_CONFIG} from '../src/config/product.js';
globalThis.document={createElement:()=>({getContext:()=>new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)})})};
// Scan transformed position vertices rather than trusting transform comments or cached bounds.
function bounds(mesh,i=0){const m=new THREE.Matrix4();mesh.getMatrixAt(i,m);const out=new THREE.Box3();const v=new THREE.Vector3();const p=mesh.geometry.attributes.position;for(let j=0;j<p.count;j++)out.expandByPoint(v.fromBufferAttribute(p,j).applyMatrix4(m));return out;}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function overlaps(a,b,axes=['x','y','z']){return axes.every(k=>Math.min(a.max[k],b.max[k])-Math.max(a.min[k],b.min[k])>1e-6);}
function hit(w,h,x,y){const g=extrudeAlongZ(makeTSlotShape(w,h),.1);const mat=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});const mesh=new THREE.Mesh(g,mat);const result=new THREE.Raycaster(new THREE.Vector3(x,y,-.01),new THREE.Vector3(0,0,1)).intersectObject(mesh).length>0;g.dispose();mat.dispose();return result;}
test('2040 enclosed middle chamber is open through the real end triangles',()=>{assert.equal(hit(.02,.04,0,0),false);assert.equal(hit(.02,.04,.008,0),true);});
test('4020 uses two longitudinal-cell bores, not one central bore',()=>{assert.equal(hit(.04,.02,-.01,0),false);assert.equal(hit(.04,.02,.01,0),false);});
for(const series of ['2020','2040'])test(`${series}: narrow unequal bays have real tongue bearing and noninterpenetrating beams/posts`,()=>{
 const s=buildShelf({...DEFAULT_CONFIG,bays:2,levels:3,series,bayWidths:[.3,.55],decks:['rib','acrylic','none'],sidePanels:false},false);
 const strips=Array.from({length:s.groups.deck.count},(_,i)=>bounds(s.groups.deck,i));
 for(let i=0;i<s.groups.brkH.count;i++){const b=bounds(s.groups.brkH,i);assert.ok(strips.some(d=>overlaps(b,d,['x','z'])&&Math.abs(b.max.y-d.min.y)<1e-6),`tongue ${i} must bear on an actual strip`);}
 const posts=Array.from({length:s.groups.posts.count},(_,i)=>bounds(s.groups.posts,i));
 const beams=['beamsB','beamsRail','beamsSide'].flatMap(k=>Array.from({length:s.groups[k].count},(_,i)=>bounds(s.groups[k],i)));
 for(const b of beams)for(const p of posts)assert.equal(overlaps(b,p),false,'beam must not penetrate continuous post');
 for(let i=0;i<beams.length;i++)for(let j=i+1;j<beams.length;j++)assert.equal(overlaps(beams[i],beams[j]),false,'beams must not intersect one another');
 for(const d of strips)assert.ok(beams.filter(b=>overlaps(b,d,['x','z'])&&Math.abs(b.max.y-d.min.y)<1e-6).length>=2,'each strip bears on front and back beams');
 for(const p of posts){near(p.min.y,0);near(p.max.y,s.bounds.H);}
 s.dispose();
});
test('all extrusion directions preserve measured cross-section and length',()=>{for(const [factory,axis,size] of [[extrudeAlongZ,'z',[.02,.04,.6]],[extrudeAlongX,'x',[.6,.04,.02]],[extrudeUp,'y',[.02,.6,.04]]]){const g=factory(makeTSlotShape(.02,.04),.6);g.computeBoundingBox();const measured=g.boundingBox.getSize(new THREE.Vector3());['x','y','z'].forEach((k,i)=>near(measured[k],size[i]));g.dispose();}});
test('procurement and mixed layer stats remain byte-for-byte equivalent',()=>{const cases=JSON.parse(fs.readFileSync(new URL('./procurement-before-geometry.json',import.meta.url)));for(const {config,stats} of cases){const s=buildShelf(config,false);assert.deepEqual(s.stats,stats);s.dispose();}});
test('#node direct URL is supported alongside #profile/node',()=>{const source=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');assert.match(source,/location.hash.startsWith\('#node'\)/);});
