// 相机动画 / 入场 / 分组浮现 / 爆炸视图（尊重 prefers-reduced-motion）
import * as THREE from 'three';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createAnims(camera, controls) {
  const tweens = [];
  let flight = null;

  function now() { return performance.now(); }

  function addTween({ dur, delay = 0, onUpdate, onDone }) {
    tweens.push({ start: now() + delay, dur, onUpdate, onDone, fired: false });
  }

  function update() {
    const t = now();
    let active = tweens.length > 0 || !!flight;
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      if (t < tw.start) continue;
      const p = Math.min(1, (t - tw.start) / tw.dur);
      tw.onUpdate(easeInOut(p), p);
      if (p >= 1) { tweens.splice(i, 1); tw.onDone && tw.onDone(); }
    }
    if (flight) {
      const p = Math.min(1, (t - flight.start) / flight.dur);
      const e = easeInOut(p);
      camera.position.lerpVectors(flight.fromPos, flight.toPos, e);
      controls.target.lerpVectors(flight.fromTgt, flight.toTgt, e);
      if (p >= 1) flight = null;
    }
    return active; // 还有动画在跑 → 需要继续帧
  }

  function flyTo(pos, target, dur = 900) {
    if (REDUCED) {
      camera.position.copy(pos);
      controls.target.copy(target);
      return;
    }
    flight = {
      fromPos: camera.position.clone(),
      toPos: pos.clone(),
      fromTgt: controls.target.clone(),
      toTgt: target.clone(),
      start: now(), dur,
    };
  }

  // 用户手动操作时打断相机飞行
  controls.addEventListener('start', () => { flight = null; });

  function intro(bounds) {
    const iso = viewPos('iso', bounds);
    const far = iso.pos.clone().multiplyScalar(2.4).add(new THREE.Vector3(0, bounds.H * 0.8, 0));
    camera.position.copy(far);
    controls.target.copy(iso.tgt);
    if (REDUCED) { camera.position.copy(iso.pos); return; }
    flyTo(iso.pos, iso.tgt, 1600);
  }

  // 包围球计算机距：任意宽高比下整机完整入画
  function fitDistance(bounds) {
    const { W, H, D } = bounds;
    const radius = 0.5 * Math.sqrt(W * W + H * H + D * D);
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    return (radius / Math.sin(Math.min(vFov, hFov) / 2)) * 1.14;
  }

  function viewPos(name, bounds) {
    const { W, H, D } = bounds;
    const tgt = new THREE.Vector3(0, H * 0.52, 0);
    const dist = fitDistance(bounds);
    const dirs = {
      front: [0, 0.06, 1],
      side: [1, 0.06, 0.001],
      iso: [0.62, 0.5, 0.78],
    };
    if (name === 'node' && bounds.nodeTarget) {
      const target=bounds.nodeTarget.clone();
      return {pos:target.clone().add(new THREE.Vector3(-.25,-.13,.30)),tgt:target};
    }
    if (name === 'slot') {
      return {
        pos: new THREE.Vector3(-W / 2 - 0.40, H * 0.42, D / 2 + 0.40),
        tgt: new THREE.Vector3(-W / 2 + 0.06, H * 0.40, D / 2 - 0.02),
      };
    }
    const d = dirs[name] || dirs.iso;
    const dir = new THREE.Vector3(d[0], d[1], d[2]).normalize();
    return { pos: tgt.clone().add(dir.multiplyScalar(dist)), tgt };
  }

  // 分组浮现：位移 + 淡入（兼容 mesh 数组与 InstancedMesh 映射表）
  function reveal(parts) {
    if (REDUCED) return;
    const list = Array.isArray(parts) ? parts.map((m, i) => [m.name || ('m' + i), m]) : Object.entries(parts);
    let idx = 0;
    for (const [name, mesh] of list) {
      if (!mesh || !mesh.isMesh || !mesh.material) continue;
      const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(mat=>({mat,opacity:mat.opacity,transparent:mat.transparent}));
      const baseY = mesh.position.y;
      for(const {mat} of mats){mat.transparent=true;mat.opacity=0;}
      mesh.position.y = baseY - 0.05;
      addTween({
        dur: 240, delay: idx * 60,
        onUpdate: (e) => {
          for(const {mat,opacity} of mats) mat.opacity=e*opacity;
          mesh.position.y = baseY - 0.05 * (1 - e);
        },
        onDone: () => { mesh.position.y = baseY; for(const {mat,opacity,transparent} of mats){mat.opacity=opacity;mat.transparent=transparent;} },
      });
      idx++;
    }
  }

  // 爆炸视图
  let exploded = false;
  function explode(parts, on) {
    exploded = on;
    const moves = [
      ['beamsB', new THREE.Vector3(0, 0, -0.32)],
      ['beamsRail', new THREE.Vector3(0, 0, 0.34)],
      ['deck', new THREE.Vector3(0, -0.45, 0.18)],
      ['panels', new THREE.Vector3(0, 0, -0.55)],
      ['brkV', new THREE.Vector3(0, 0, 0.30)],
      ['brkH', new THREE.Vector3(0, 0, 0.34)],
    ];
    const conn = parts.conn;
    if (REDUCED) {
      for (const [name, off] of moves) {
        const mesh = parts[name];
        if (mesh) mesh.position.copy(on ? off : new THREE.Vector3(0, 0, 0));
      }
      if (conn) conn.visible = !on;
      return;
    }
    for (const [name, off] of moves) {
      const mesh = parts[name];
      if (!mesh) continue;
      const from = mesh.position.clone();
      const to = on ? off : new THREE.Vector3(0, 0, 0);
      addTween({ dur: 600, onUpdate: (e) => mesh.position.lerpVectors(from, to, e) });
    }
    if (conn) {
      const mat = conn.material;
      mat.transparent = true;
      const fromO = mat.opacity ?? 1;
      const toO = on ? 0 : 1;
      addTween({
        dur: 400, delay: on ? 0 : 250,
        onUpdate: (e) => { mat.opacity = fromO + (toO - fromO) * e; },
        onDone: () => { conn.visible = !on; },
      });
      if (on) conn.visible = true;
      else conn.visible = true;
    }
  }

  return { update, flyTo, intro, viewPos, reveal, revealGroups: reveal, explode, get exploded() { return exploded; }, REDUCED };
}
