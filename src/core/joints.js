// Visual connection details only; hidden fasteners/specifications remain illustrative.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
export function makeCornerGeo(){
  const t=.003, a=.024, w=.016;
  const horizontal=new THREE.BoxGeometry(a,t,w).toNonIndexed(); horizontal.translate(a/2,-t/2,0);
  const vertical=new THREE.BoxGeometry(t,a,w).toNonIndexed(); vertical.translate(t/2,-a/2,0);
  const geo=mergeGeometries([horizontal,vertical]);horizontal.dispose();vertical.dispose();return geo;
}
export function makeSocketBoltGeo(){
  const s=new THREE.Shape();s.absarc(0,0,.004,0,Math.PI*2,false);
  const hole=new THREE.Path();for(let i=0;i<6;i++){const a=-i*Math.PI/3;const x=Math.cos(a)*.0018,y=Math.sin(a)*.0018;i?hole.lineTo(x,y):hole.moveTo(x,y);}hole.closePath();s.holes.push(hole);
  const head=new THREE.ExtrudeGeometry(s,{depth:.0028,bevelEnabled:false,curveSegments:12});head.translate(0,0,.0012);
  const floor=new THREE.CylinderGeometry(.004,.004,.0012,24).toNonIndexed();floor.rotateX(Math.PI/2);floor.translate(0,0,.0006);
  const geo=mergeGeometries([head,floor]);head.dispose();floor.dispose();geo.userData.socketRecess=true;return geo;
}
export function makeWasherGeo(){const s=new THREE.Shape();s.absarc(0,0,.005,0,Math.PI*2,false);const h=new THREE.Path();h.absarc(0,0,.0022,0,Math.PI*2,true);s.holes.push(h);return new THREE.ExtrudeGeometry(s,{depth:.0008,bevelEnabled:false,curveSegments:12});}
