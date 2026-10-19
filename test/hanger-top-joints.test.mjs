import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildHanger } from '../src/core/buildHanger.js';
import { DEFAULT_HANGER_CONFIG, POST_D } from '../src/config/hanger.js';

// 原木款贴图在浏览器中使用 Canvas；Node 几何测试只需模拟绘图接口。
const textureGradient = { addColorStop() {} };
const canvasContext = new Proxy({}, {
  get(_target, key) {
    if (key === 'createLinearGradient' || key === 'createRadialGradient')
      return () => textureGradient;
    if (key === 'canvas') return { width: 256, height: 256 };
    return () => {};
  },
  set() { return true; },
});
globalThis.document = {
  createElement: tag => tag === 'canvas'
    ? { width: 256, height: 256, getContext: () => canvasContext }
    : {},
};

const near = (a, b, label, tolerance = 1e-5) =>
  assert.ok(Math.abs(a - b) < tolerance, `${label}: ${a} != ${b}`);

function instance(mesh, i) {
  const mat = new THREE.Matrix4();
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  mesh.getMatrixAt(i, mat);
  mat.decompose(p, q, s);
  return { p, q, s };
}

test('经典挂衣架：挂衣杆及承托杆双向贯穿，四个立柱节点真实连接且端头对称外露', () => {
  for (const config of [
    { width: 1.5, depth: 0.55, height: 2.4, color: 'silver' },
    { width: 0.8, depth: 0.35, height: 2.0, color: 'black' },
    { width: 2.0, depth: 0.8, height: 2.6, color: 'champagne' },
  ]) {
    const built = buildHanger({ ...config, style: 'classic', wheels: true });
    const { hangRail, hangSupports, hangPostSleeves, hangSaddles, topRail, posts } = built.groups;
    const halfX = (config.width - POST_D) / 2;
    const halfZ = (config.depth - POST_D) / 2;
    const yTopRail = 0.068 + 0.02 + config.height - POST_D / 2;
    const yHang = yTopRail - 0.24;
    const ySupport = yHang;
    try {
      assert.equal(hangRail.name, 'hangerMainRod');
      assert.equal(hangSupports.children.length, 2, 'one depth-bearing rail per side');
      assert.equal(hangPostSleeves.children.length, 4, 'front and rear uprights each have a collar');
      assert.equal(hangSaddles.children.length, 2, 'the central hanging rail has a metal seat on each side');
      assert.equal(posts.count, 4);
      near(hangRail.position.y, yHang, 'hanger lowered from upper frame');
      near(hangRail.scale.y, config.width + 0.11, 'single Ø30 main rod spans whole width and both external ends');
      near(hangRail.position.x - hangRail.scale.y / 2, -config.width / 2 - 0.055, 'left tip is externally visible');
      near(hangRail.position.x + hangRail.scale.y / 2, config.width / 2 + 0.055, 'right tip is externally visible');
      assert.ok(topRail.children.filter(o => o.isMesh && o.geometry.type === 'BoxGeometry').length === 0,
        'old unsupported 38mm square clamps removed');

      for (const [i, support] of hangSupports.children.entries()) {
        const x = i ? halfX : -halfX;
        near(support.position.x, x, 'support at side post X');
        near(support.position.y, ySupport, 'support below main rod');
        near(support.position.z, 0, 'support centered front-to-back');
        near(support.scale.y, config.depth + 0.09, 'support is one continuous through-rod, not a loose stub');
        near(support.scale.y / 2 - halfZ, 0.06, 'support projects 60mm beyond each post center');
        near(support.position.y, hangRail.position.y, 'T node axes are coplanar, never floating');
        near(support.position.z - support.scale.y / 2, -config.depth / 2 - 0.045, 'rear end cap projects beyond frame');
        near(support.position.z + support.scale.y / 2, config.depth / 2 + 0.045, 'front end cap projects beyond frame');
        near(Math.abs(support.rotation.x), Math.PI / 2, 'support aligns with Z axis');

        const saddle = hangSaddles.children[i];
        near(saddle.position.x, x, 'saddle centered over side support');
        near(saddle.position.y, yHang, 'saddle at rod elevation');
        near(saddle.position.z, 0, 'saddle coaxial with main rod');

        for (const z of [-halfZ, halfZ]) {
          const matches = hangPostSleeves.children.filter(
            sleeve => Math.abs(sleeve.position.x - x) < 1e-6
              && Math.abs(sleeve.position.z - z) < 1e-6
              && Math.abs(sleeve.position.y - ySupport) < 1e-6
          );
          assert.equal(matches.length, 1, 'support end joins a visible post sleeve');
        }
      }
      assert.ok(yTopRail - yHang >= 0.22, 'coat hanger hook room below top shelf');
      assert.ok(built.stats.cutList.some(c => c.spec.includes('侧向贯穿光轴') && c.qty === 2 && Math.abs(c.len - (config.depth + 0.09)) < 0.001));
      assert.ok(built.stats.cutList.some(c => c.spec.includes('主挂衣杆贯穿') && c.qty === 1 && Math.abs(c.len - (config.width + 0.11)) < 0.001));
      assert.ok(built.stats.hardware.some(c => c.name.includes('T 型穿接套筒') && c.qty === 2));
      const { rearTie, rearTieCollars } = built.groups;
      assert.equal(rearTieCollars.children.length, 2, 'rear beam uses two post sleeves, no square clamps');
      near(rearTie.scale.y, config.width + 0.09, 'rear rod spans full rack with external tip on both sides');
    } finally { built.dispose(); }
  }
});

test('经典挂衣架：加厚顶板、四个真实承托片、角撑端耳板均连接到顶框/立柱', () => {
  for (const cfg of [
    { width: 1.5, depth: 0.55, height: 2.4 },
    { width: 0.8, depth: 0.35, height: 2.0 },
    { width: 2.0, depth: 0.8, height: 2.6 },
  ]) {
    const model = buildHanger({ style: 'classic', ...cfg });
    try {
      const { shelf, shelfTabs, braces, braceJoints, bracePins } = model.groups;
      const px = cfg.width / 2 - POST_D / 2;
      const pz = cfg.depth / 2 - POST_D / 2;
      const yTopRail = 0.068 + 0.02 + cfg.height - POST_D / 2;
      const arm = Math.min(0.19, pz - 0.047);
      near(shelf.scale.y, 0.026, '26mm real top shelf thickness');
      near(shelf.position.y + shelf.scale.y / 2, yTopRail + POST_D / 2 - 0.001, 'shelf top flush with top frame');
      assert.equal(shelfTabs.children.length, 4);
      assert.equal(braces.count, 4);
      assert.equal(braces.geometry.type, 'CylinderGeometry', 'top brace uses slender round-shaft language');
      near(braces.geometry.parameters.radiusTop, 0.006, 'Ø12 diagonal braces');
      assert.equal(braceJoints.children.length, 8, 'each outboard brace has two metal sleeves');
      assert.equal(bracePins.children.length, 8, 'each fitting has a real short X-direction through pin');

      for (const tab of shelfTabs.children) {
        near(tab.position.y + 0.003, shelf.position.y - shelf.scale.y / 2, 'shelf rests directly on tab');
        assert.ok(Math.abs(tab.position.x) + 0.035 <= cfg.width / 2 - POST_D / 2 + 1e-5);
        assert.ok(Math.abs(tab.position.z) + 0.026 <= cfg.depth / 2 - POST_D / 2 + 1e-5);
      }
      for (let i = 0; i < braces.count; i++) {
        const { p, q, s } = instance(braces, i);
        near(s.y, Math.SQRT2 * arm, 'brace length follows dimension');
        const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize();
        const a = p.clone().addScaledVector(axis, s.y / 2);
        const b = p.clone().addScaledVector(axis, -s.y / 2);
        const expected = [a, b];
        for (const end of expected) {
          assert.ok(
            braceJoints.children.some(tab => tab.position.distanceTo(end) < 1e-4),
            'actual diagonal brace endpoint lies inside metal corner fitting'
          );
        }
        near(Math.abs(p.x), px + 0.032, 'brace is 32mm OUTSIDE the side-frame centerline');
        assert.ok(pz - arm >= 0.047 - 1e-6, 'brace does not cross the center in shallow racks');
      }
      for (const [i, fitting] of braceJoints.children.entries()) {
        const pin = bracePins.children[i];
        const xPost = Math.sign(fitting.position.x) * px;
        near(pin.position.x, (xPost + fitting.position.x) / 2, 'joining pin bridges outer brace to inner side frame');
        near(pin.position.y, fitting.position.y, 'pin meets diagonal sleeve at the same Y');
        near(pin.position.z, fitting.position.z, 'pin meets diagonal sleeve at the same Z');
        near(pin.scale.y, 0.062, 'pin spans enough to penetrate both mating members');
        const distance = Math.abs(fitting.position.x - xPost);
        near(distance, 0.032, 'brace offset from post center');
        assert.ok(pin.scale.y > distance + 0.01, 'positive overlap prevents a disconnected rod end');
      }
      assert.ok(model.stats.hardware.some(h => h.name.includes('斜撑端部金属套筒') && h.qty === 8));
      assert.ok(model.stats.hardware.some(h => h.name.includes('斜撑水平连接穿销') && h.qty === 8));
      assert.ok(model.stats.cutList.some(c => c.spec.includes('外挂斜撑光轴 ⌀12') && c.qty === 4));
      assert.ok(model.stats.cutList.some(c => c.spec.includes('后框贯穿横撑 ⌀14') && c.qty === 1));
      near(model.groups.rearTie.geometry.parameters.radiusTop, 0.007, 'Ø14 rear through rod');
      assert.ok(model.groups.rearTieCollars.children.every(x => x.geometry.type === 'CylinderGeometry'));
      assert.ok(model.stats.weightKg > 0);
    } finally { model.dispose(); }
  }
});

test('另一种原木水磨石样式不受经典款改动影响', () => {
  const config = { ...DEFAULT_HANGER_CONFIG, style: 'atelier' };
  const result = buildHanger(config);
  try {
    assert.equal(result.groups.hangSupports, undefined);
    assert.equal(result.groups.braceJoints, undefined);
    assert.ok(result.stats.partCount > 0);
  } finally { result.dispose(); }
});
