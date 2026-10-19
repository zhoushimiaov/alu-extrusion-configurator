import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildHanger } from '../src/core/buildHanger.js';
import { DEFAULT_HANGER_CONFIG, POST_D } from '../src/config/hanger.js';

const near = (a, b, label, tolerance = 1e-5) =>
  assert.ok(Math.abs(a - b) < tolerance, `${label}: ${a} != ${b}`);

function instance(mesh, i) {
  const mat = new THREE.Matrix4();
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  mesh.getMatrixAt(i, mat);
  mat.decompose(p, q, s);
  return { p, q, s };
}

test('经典挂衣架：挂衣杆落在两根真实侧向支撑杆上，四个端点接入立柱抱箍', () => {
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
    const ySupport = yHang - POST_D / 2 - 0.009 + 0.002;
    try {
      assert.equal(hangRail.name, 'hangerMainRod');
      assert.equal(hangSupports.children.length, 2, 'one depth-bearing rail per side');
      assert.equal(hangPostSleeves.children.length, 4, 'front and rear uprights each have a collar');
      assert.equal(hangSaddles.children.length, 2, 'the central hanging rail has a metal seat on each side');
      assert.equal(posts.count, 4);
      near(hangRail.position.y, yHang, 'hanger lowered from upper frame');
      assert.ok(topRail.children.filter(o => o.isMesh && o.geometry.type === 'BoxGeometry').length === 0,
        'old unsupported 38mm square clamps removed');

      for (const [i, support] of hangSupports.children.entries()) {
        const x = i ? halfX : -halfX;
        near(support.position.x, x, 'support at side post X');
        near(support.position.y, ySupport, 'support below main rod');
        near(support.position.z, 0, 'support centered front-to-back');
        near(support.scale.y, 2 * halfZ, 'cradle spans between front and back posts');
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
      assert.ok(built.stats.cutList.some(c => c.spec.includes('侧向承托光轴') && c.qty === 2));
      assert.ok(built.stats.hardware.some(c => c.name.includes('金属鞍座') && c.qty === 2));
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
      const { shelf, shelfTabs, braces, braceJoints } = model.groups;
      const px = cfg.width / 2 - POST_D / 2;
      const pz = cfg.depth / 2 - POST_D / 2;
      const yTopRail = 0.068 + 0.02 + cfg.height - POST_D / 2;
      const arm = Math.min(0.19, pz - 0.047);
      near(shelf.scale.y, 0.026, '26mm real top shelf thickness');
      near(shelf.position.y + shelf.scale.y / 2, yTopRail + POST_D / 2 - 0.001, 'shelf top flush with top frame');
      assert.equal(shelfTabs.children.length, 4);
      assert.equal(braces.count, 4);
      assert.equal(braceJoints.children.length, 8, 'each brace has 2 end fittings');

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
        near(Math.abs(p.x), px, 'braces attached to side posts');
        assert.ok(pz - arm >= 0.047 - 1e-6, 'brace does not cross the center in shallow racks');
      }
      assert.ok(model.stats.hardware.some(h => h.name.includes('斜撑端部耳板') && h.qty === 8));
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
