// 接地接触遮蔽贴片（预览特性：?ground=1 开启，默认关闭待用户拍板审美方向）。
// 替代被否决的阴影贴图路线：每只脚/轮下放一张径向渐隐圆片，
// 零 shadow map、零后期，成本仅 4 个透明 quad。
import * as THREE from 'three';

let sharedTex = null;
function getTexture() {
  if (sharedTex) return sharedTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(30,32,36,0.60)');
  grad.addColorStop(0.5, 'rgba(30,32,36,0.26)');
  grad.addColorStop(1, 'rgba(30,32,36,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  sharedTex = new THREE.CanvasTexture(c);
  return sharedTex;
}

export function createGroundContact() {
  const mat = new THREE.MeshBasicMaterial({
    map: getTexture(),
    transparent: true,
    depthWrite: false,
  });
  const geo = new THREE.CircleGeometry(1, 24);
  const group = new THREE.Group();
  group.visible = false;

  function sync(bounds) {
    while (group.children.length) group.remove(group.children[0]);
    if (!bounds || !bounds.W) { group.visible = false; return; }
    const r = Math.max(0.05, Math.min(bounds.W, bounds.D) * 0.10);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const m = new THREE.Mesh(geo, mat);
        m.rotation.x = -Math.PI / 2;
        m.scale.setScalar(r * 2.6); // 贴片大于脚径才能从常见视角读出接地关系（实测 1.6x 不可感知）
        m.position.set(sx * (bounds.W / 2 - r * 0.8), 0.003, sz * (bounds.D / 2 - r * 0.8));
        m.renderOrder = 3;
        group.add(m);
      }
    }
    group.visible = true;
  }

  function dispose() {
    geo.dispose();
    while (group.children.length) group.remove(group.children[0]);
  }

  return { group, sync, dispose };
}
