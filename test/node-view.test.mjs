import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
globalThis.window={matchMedia:()=>({matches:false})};
const {createAnims}=await import('../src/core/anims.js');
const controls=()=>({target:new THREE.Vector3(),addEventListener(){}});
test('node closeup uses selected real joint target rather than arbitrary height',()=>{const a=createAnims(new THREE.PerspectiveCamera(40,1.6,.01,100),controls());const target=new THREE.Vector3(-.285,.47,.19);const v=a.viewPos('node',{W:1.14,H:1.4,D:.4,nodeTarget:target});assert.ok(v.tgt.distanceTo(target)<1e-9);assert.ok(v.pos.distanceTo(v.tgt)<.7);});
test('reveal handles cap/side material arrays and restores acrylic original opacity',()=>{const a=createAnims(new THREE.PerspectiveCamera(),controls());const cut=new THREE.MeshStandardMaterial();const brushed=new THREE.MeshStandardMaterial();const paneMat=new THREE.MeshStandardMaterial({transparent:true,opacity:.55});const p=new THREE.Mesh(new THREE.BoxGeometry(),[cut,brushed]);const pane=new THREE.Mesh(new THREE.BoxGeometry(),paneMat);a.reveal({p,pane});assert.equal(cut.opacity,0);assert.equal(brushed.opacity,0);const saved=globalThis.performance;globalThis.performance={now:()=>saved.now()+10000};a.update();globalThis.performance=saved;assert.equal(cut.opacity,1);assert.equal(cut.transparent,false);assert.equal(paneMat.opacity,.55);assert.equal(paneMat.transparent,true);});

test('orbit limits allow closeup and below-beam inspection',async()=>{const {readFile}=await import('node:fs/promises');const source=await readFile(new URL('../src/core/scene.js',import.meta.url),'utf8');assert.match(source,/controls.minDistance = 0.12/);assert.match(source,/controls.maxPolarAngle = 2.8/);});
