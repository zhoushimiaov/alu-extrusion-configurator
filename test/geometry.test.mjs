import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeTSlotShape,extrudeAlongX,extrudeAlongZ} from '../src/core/profiles.js';
import {buildShelf} from '../src/core/buildshelf.js';
import {DEFAULT_CONFIG,beamCutLength,JOINT_GAP} from '../src/config/product.js';
// Canvas is only a material texture dependency, not part of geometry under test.
globalThis.document = {createElement:()=>({getContext:()=>new Proxy({}, {get:(o,k)=>o[k] ?? (()=>{}),set:(o,k,v)=>(o[k]=v,true)})})};
export function box(mesh,i=0){const m=new THREE.Matrix4();mesh.getMatrixAt(i,m);mesh.geometry.computeBoundingBox();return mesh.geometry.boundingBox.clone().applyMatrix4(m);}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const cfg={...DEFAULT_CONFIG,bays:2,levels:3,bayWidths:[.57,.8],decks:['rib','acrylic','none'],props:false,sidePanels:false};
test('extrudeAlongX actual vertices are centered and 2040 strong axis remains Y',()=>{const g=extrudeAlongX(makeTSlotShape(.02,.04),.546);g.computeBoundingBox();near(g.boundingBox.min.x,-.273);near(g.boundingBox.max.x,.273);near(g.boundingBox.max.y-g.boundingBox.min.y,.04);near(g.boundingBox.max.z-g.boundingBox.min.z,.02);});
test('2020 end face contains open slots, center bore, enclosed cavities and solid corner',()=>{const s=makeTSlotShape(.02,.02); assert.ok(s.holes.length>=5,'center and four enclosed cavities');const mesh=new THREE.Mesh(extrudeAlongZ(s,.1),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));for(const [x,y,hit] of [[0,0,false],[0,.009,false],[.0075,.0075,false],[.0095,.0095,true],[.003,0,true]]){const ray=new THREE.Raycaster(new THREE.Vector3(x,y,-.01),new THREE.Vector3(0,0,1));assert.equal(ray.intersectObject(mesh).length>0,hit,`${x},${y}`);}});
for(const series of ['2020','2040']) test(`${series} beams stop at post side and strips rest on beam`,()=>{const s=buildShelf({...cfg,series},false);const b=box(s.groups.beamsB);near(b.max.x-b.min.x,beamCutLength(.57));const p=box(s.groups.posts,1);near(b.min.x-p.max.x,JOINT_GAP);const rail=box(s.groups.beamsRail);near(rail.min.x,b.min.x);const side=box(s.groups.beamsSide);near(side.min.z-p.max.z,JOINT_GAP);near(box(s.groups.deck).min.y,b.max.y);s.dispose();});
test('cut and brushed surfaces are separate material groups',()=>{const s=buildShelf(cfg,false);assert.ok(Array.isArray(s.groups.posts.material));assert.notEqual(s.groups.posts.material[0],s.groups.posts.material[1]);assert.equal(s.groups.posts.material[0].roughnessMap,null);s.dispose();});
test('acrylic has four support pads per panel on side beams, with no floating gap',()=>{const s=buildShelf(cfg,false);assert.equal(s.groups.pads?.count,8);const pad=box(s.groups.pads);const pane=box(s.groups.pane);near(pad.max.y,pane.min.y);near(pad.min.y,box(s.groups.beamsSide,3).max.y);assert.ok(pad.max.x>pane.min.x && pad.min.x<pane.max.x);s.dispose();});
test('visual joints contain socket recesses and separate washers; no repeated bay nodes',()=>{const s=buildShelf(cfg,false);assert.ok(s.groups.washers);assert.equal(s.groups.conn.count,(s.groups.beamsB.count+s.groups.beamsRail.count)*2);assert.equal(s.groups.bolts.count,s.groups.conn.count*2);assert.ok(s.groups.bolts.geometry.userData.socketRecess);s.dispose();});
