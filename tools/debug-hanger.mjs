// 挂衣架调试：dump 每个 mesh 的世界包围盒，定位尺寸异常部件
globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect(){}, set fillStyle(v){}, beginPath(){}, ellipse(){}, fill(){} }), width: 0, height: 0 }) };
const { buildHanger } = await import('../src/core/buildHanger.js');
const r = buildHanger({});
r.group.updateMatrixWorld(true);
const THREE = await import('three');
const box = new THREE.Box3();
r.group.traverse(o => {
  if (!o.isMesh && !o.isInstancedMesh) return;
  box.setFromObject(o);
  const s = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  console.log(`${o.type.padEnd(14)} count=${o.isInstancedMesh ? o.count : 1}  size=${s.x.toFixed(3)}×${s.y.toFixed(3)}×${s.z.toFixed(3)}  center=[${c.x.toFixed(2)},${c.y.toFixed(2)},${c.z.toFixed(2)}]`);
});
r.dispose();