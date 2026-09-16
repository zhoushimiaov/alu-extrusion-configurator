// T-slot 型材截面工厂：THREE.Shape + ExtrudeGeometry
// 所有尺寸单位为米。槽口参数按 20 系国标近似：开口 6.2 / 腔宽 8.2 / 深 6.8
import * as THREE from 'three';

const SLOT_OPEN = 0.0031;   // 槽口半开 6.2/2
const SLOT_CAVITY = 0.0041; // T 腔半宽 8.2/2
const SLOT_THROAT = 0.0025; // 喉部深度
const SLOT_DEPTH = 0.0068;  // 槽全深
const HOLE_R = 0.0021;      // 中心孔 ⌀4.2

/**
 * 生成带四面 T 槽 + 中心孔的型材截面（XY 平面，中心在原点）
 * @param {number} w 截面宽（X）
 * @param {number} h 截面高（Y）
 * @param {boolean} centerHoles 是否打中心孔（2040 双孔，2020 单孔）
 */
export function makeTSlotShape(w, h, centerHoles = true) {
  const hw = w / 2, hh = h / 2;
  const shape = new THREE.Shape();
  /* Ordered edges */
  const corners = [[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]];
  shape.moveTo(-hw,-hh);
  for (let e=0;e<4;e++) {
    const a=corners[e], b=corners[(e+1)%4];
    const len=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const tx=(b[0]-a[0])/len, ty=(b[1]-a[1])/len;
    const thickness=e%2 ? w : h;
    const depth=Math.min(SLOT_DEPTH, thickness/2-.0034);
    const centers=len>=.036 ? [len/4,3*len/4] : [len/2];
    for (const c of centers) {
  
   for (const [u,v] of [[-SLOT_OPEN,0],[-SLOT_OPEN,.0015],[-SLOT_CAVITY,.0026],[-SLOT_CAVITY,depth],[SLOT_CAVITY,depth],[SLOT_CAVITY,.0026],[SLOT_OPEN,.0015],[SLOT_OPEN,0]]) {
  
  
  shape.lineTo(a[0]+tx*(c+u)-ty*v,a[1]+ty*(c+u)+tx*v);
  
   }
    }
    shape.lineTo(...b);
  }
  shape.closePath();
  if (centerHoles) {
    // Illustrative hollow extrusion, not a supplier-certified manufacturing section.
    const tall = h >= w * 1.8, wide = w >= h * 1.8;
    const bores = tall ? [[0,-h/4],[0,h/4]] : wide ? [[-w/4,0],[w/4,0]] : [[0,0]];
    for (const [x,y] of bores) {
      const hole = new THREE.Path();
      hole.absarc(x,y,HOLE_R,0,Math.PI*2,true);
      shape.holes.push(hole);
    }
    // Diamond chamber between the two cells, leaving webs around bore and slot roots.
    if (tall || wide) {
      const across = Math.min(w,h) / 2 - .003;
      const along = Math.max(w,h) / 4 - HOLE_R - .0015;
      const hole = new THREE.Path();
      const points = [[-across,0],[0,along],[across,0],[0,-along]];
      points.forEach(([x,y],i) => {
        const p = tall ? [x,y] : [y,x];
        if (i) hole.lineTo(...p); else hole.moveTo(...p);
      });
      hole.closePath();
      shape.holes.push(hole);
    }
    /* Approximate enclosed chambers */
    for(const sx of [-1,1]) for(const sy of [-1,1]) {
  
   const x1=hw-.0048,x2=hw-.0012,y1=hh-.0038,y2=hh-.0012;
  
   const hole=new THREE.Path();hole.moveTo(sx*x1,sy*y1);hole.lineTo(sx*x2,sy*y1);hole.lineTo(sx*x2,sy*y2);hole.lineTo(sx*x1,sy*y2);hole.closePath();shape.holes.push(hole);
    }
  }
  return shape; }  
/** Exact 30×30 depth-beam section from alu-frame.glb mesh 10 end cap. */
export function makeGlbJointShape() {
  const outer=[[-0.009605,0.010873],[-0.009605,0.0132],[-0.004105,0.0132],[-0.004105,0.0141],[-0.005005,0.0141],[-0.005005,0.015],[-0.014999,0.015],[-0.014999,0.005],[-0.014107,0.005],[-0.014107,0.0041],[-0.013206,0.0041],[-0.013206,0.0096],[-0.010879,0.0096],[-0.005798,0.004527],[-0.005798,-0.004527],[-0.010879,-0.0096],[-0.013206,-0.0096],[-0.013206,-0.0041],[-0.014107,-0.0041],[-0.014107,-0.005],[-0.014999,-0.005],[-0.014999,-0.015],[-0.005005,-0.015],[-0.005005,-0.0141],[-0.004105,-0.0141],[-0.004105,-0.0132],[-0.009605,-0.0132],[-0.009605,-0.010873],[-0.004524,-0.0058],[0.004524,-0.0058],[0.009598,-0.010873],[0.009598,-0.0132],[0.004097,-0.0132],[0.004097,-0.0141],[0.004997,-0.0141],[0.004997,-0.015],[0.014999,-0.015],[0.014999,-0.005],[0.014099,-0.005],[0.014099,-0.0041],[0.013199,-0.0041],[0.013199,-0.0096],[0.010872,-0.0096],[0.005798,-0.004527],[0.005798,0.004527],[0.010872,0.0096],[0.013199,0.0096],[0.013199,0.0041],[0.014099,0.0041],[0.014099,0.005],[0.014999,0.005],[0.014999,0.015],[0.004997,0.015],[0.004997,0.0141],[0.004097,0.0141],[0.004097,0.0132],[0.009598,0.0132],[0.009598,0.010873],[0.004524,0.0058],[-0.004524,0.0058]];
  const holes=[[[0.000939,0.003269],[0.001251,0.003161],[0.001564,0.00302],[0.001862,0.002846],[0.002136,0.00264],[0.002403,0.002404],[0.00264,0.002143],[0.002846,0.001861],[0.003021,0.001562],[0.003166,0.001252],[0.003265,0.000936],[0.003342,0.000619],[0.00338,0.000306],[0.003395,0.0],[0.00338,-0.000306],[0.003342,-0.000619],[0.003265,-0.000936],[0.003166,-0.001252],[0.003021,-0.001562],[0.002846,-0.001861],[0.00264,-0.002143],[0.002403,-0.002404],[0.002136,-0.00264],[0.001862,-0.002846],[0.001564,-0.00302],[0.001251,-0.003161],[0.000939,-0.003269],[0.000618,-0.003343],[0.000305,-0.003386],[0.0,-0.0034],[-0.000305,-0.003386],[-0.000618,-0.003343],[-0.000938,-0.003269],[-0.001251,-0.003161],[-0.001564,-0.00302],[-0.001861,-0.002846],[-0.002144,-0.00264],[-0.002411,-0.002404],[-0.00264,-0.002143],[-0.002846,-0.001861],[-0.003021,-0.001562],[-0.003166,-0.001252],[-0.003265,-0.000936],[-0.003342,-0.000619],[-0.003387,-0.000306],[-0.003403,0.0],[-0.003387,0.000306],[-0.003342,0.000619],[-0.003265,0.000936],[-0.003166,0.001252],[-0.003021,0.001562],[-0.002846,0.001861],[-0.00264,0.002143],[-0.002411,0.002404],[-0.002144,0.00264],[-0.001861,0.002846],[-0.001564,0.00302],[-0.001251,0.003161],[-0.000938,0.003269],[-0.000618,0.003343],[-0.000305,0.003386],[0.0,0.0034],[0.000305,0.003386],[0.000618,0.003343]],[[0.010948,0.01365],[0.013649,0.01365],[0.013649,0.01095],[0.010948,0.01095]],[[0.010948,-0.01095],[0.013649,-0.01095],[0.013649,-0.01365],[0.010948,-0.01365]],[[-0.013649,0.01365],[-0.010956,0.01365],[-0.010956,0.01095],[-0.013649,0.01095]],[[-0.013649,-0.01365],[-0.013649,-0.01095],[-0.010956,-0.01095],[-0.010956,-0.01365]]];
  const s=new THREE.Shape(); outer.forEach((q,i)=>i?s.lineTo(q[0],q[1]):s.moveTo(q[0],q[1])); s.closePath();
  for(const ring of holes){const h=new THREE.Path();ring.forEach((q,i)=>i?h.lineTo(q[0],q[1]):h.moveTo(q[0],q[1]));h.closePath();s.holes.push(h);}
  return s;
}

/**
 * alu-frame.glb mesh 7 精确端盖截面（20.004×20mm）。
 * 来源：POSITION/indices 端盖三角形的单次边环，44点外轮廓 + 5.142×5.138mm方孔；
 * 不是按截图估算。坐标已从GLB世界偏移归一化到截面中心。
 */
export function makeGlbStripShape() {
  const outer = [
    [0.006966,-0.006262],[0.009003,-0.006262],[0.009003,-0.002569],[0.010002,-0.002569],
    [0.010002,-0.010000],[0.002571,-0.010000],[0.002571,-0.009000],[0.006264,-0.009000],
    [0.006264,-0.006969],[0.002861,-0.003569],[-0.002861,-0.003569],[-0.006263,-0.006969],
    [-0.006263,-0.009000],[-0.002571,-0.009000],[-0.002571,-0.010000],[-0.010002,-0.010000],
    [-0.010002,-0.002569],[-0.009002,-0.002569],[-0.009002,-0.006262],[-0.006965,-0.006262],
    [-0.003570,-0.002862],[-0.003570,0.002862],[-0.006965,0.006262],[-0.009002,0.006262],
    [-0.009002,0.002569],[-0.010002,0.002569],[-0.010002,0.010000],[-0.002571,0.010000],
    [-0.002571,0.009000],[-0.006263,0.009000],[-0.006263,0.006969],[-0.002861,0.003569],
    [0.002861,0.003569],[0.006264,0.006969],[0.006264,0.009000],[0.002571,0.009000],
    [0.002571,0.010000],[0.010002,0.010000],[0.010002,0.002569],[0.009003,0.002569],
    [0.009003,0.006262],[0.006966,0.006262],[0.003571,0.002862],[0.003571,-0.002862]
  ];
  const s = new THREE.Shape();
  outer.forEach((q,i) => i ? s.lineTo(q[0],q[1]) : s.moveTo(q[0],q[1]));
  s.closePath();
  const hole = new THREE.Path();
  [[-0.002571,-0.002569],[-0.002571,0.002569],[0.002571,0.002569],[0.002571,-0.002569]]
    .forEach((q,i) => i ? hole.lineTo(q[0],q[1]) : hole.moveTo(q[0],q[1]));
  hole.closePath(); s.holes.push(hole);
  return s;
}

/** 层板条截面（XY 平面，中心原点） */
export function makeRibShape(w, h) {
  const hw = w / 2, hh = h / 2, r = Math.min(hh * 0.6, 0.0015);
  const s = new THREE.Shape();
  s.moveTo(-hw + r, -hh);
  s.lineTo(hw - r, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - r);
  s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - r);
  s.lineTo(-hw, -hh + r);
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return s;
}

/**
 * 沿 +Z 挤出截面
 * @returns {THREE.ExtrudeGeometry} 挤出体 z ∈ [0, length]
 */
export function extrudeAlongZ(shape, length, curveSegments = 10) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: length,
    bevelEnabled: false,
    curveSegments,
    steps: 1,
  });
  geo.computeVertexNormals();
  return geo;
}

/** 挤出并旋转为沿 +Y 向上（z∈[0,L] → y∈[0,L]），截面 x→x, y→-z */
export function extrudeUp(shape, length, curveSegments = 10) {
  const geo = extrudeAlongZ(shape, length, curveSegments);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/** 挤出并旋转为沿 +X：挤出段先居中（x∈[-L/2,L/2]）再旋转，截面 Y 保持竖直（强轴） */
export function extrudeAlongX(shape, length, curveSegments = 10) {
  const geo = extrudeAlongZ(shape, length, curveSegments);
  geo.translate(0, 0, -length / 2); // 居中，配合实例缩放不会偏移
  geo.rotateY(Math.PI / 2);
  return geo;
}
