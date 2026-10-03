// 几何/联动验证脚本（node tools/qa-geometry.mjs；任一 FAIL 退出码非零，可作 CI 门禁）
// 1) 周转箱：推入状态箱体不越出立柱内表面、X 向在侧梁/滑轨以内、不穿顶框；抽出量不超过滑轨承载
// 2) 光轴展架 panel / acrylic：板顶不得高于顶档横杆
// 3) 木展车四个开关：件数或五金清单随开关变化（证明面板 -> store -> 重建链路存在）
// 4) 周转箱 tiers × height 全配置扫描（推入状态）
import * as THREE from 'three';
globalThis.document = { createElement: (t) => t === 'canvas' ? { width: 0, height: 0, getContext: () => ({ fillRect(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){}, fill(){}, ellipse(){}, arc(){}, drawImage(){}, set fillStyle(v){}, set strokeStyle(v){}, set lineWidth(v){} }) } : {} };

import { buildCratesRack } from '../src/core/buildCratesRack.js';
import { buildRodRack } from '../src/core/buildRodRack.js';
import { buildWoodCart } from '../src/core/buildWoodCart.js';

const POST_W = 0.04;
const BEAM = 0.02;         // 2020 梁截面（buildCratesRack: const BEAM = 0.02）
const CASTER_H = 0.085;    // 周转箱底盘安装面高（buildCratesRack: const CASTER_H = 0.085）

let failures = 0;

// 箱体为 InstancedMesh 合批（groups.crates）：逐实例展开求包围盒
function crateBox(prod) {
  const box = new THREE.Box3(), m = new THREE.Matrix4(), child = new THREE.Box3();
  prod.group.updateMatrixWorld(true);
  prod.groups.crates.traverse((o) => {
    if (!o.isInstancedMesh) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m);
      m.premultiply(o.matrixWorld);
      box.union(child.copy(o.geometry.boundingBox).applyMatrix4(m));
    }
  });
  return box;
}
// 立柱顶 = 顶框底面：底盘安装面 + 双层底梁之下层（BEAM）+ 立柱长度
const topFrameBottom = (height) => CASTER_H + BEAM + height;

console.log('=== 1. 周转箱收纳架：箱体 vs 框架（推入）/ 滑轨承载（抽出）===');
for (const cfg of [
  { name: 'default-4t', c: {} },
  { name: '2t-white', c: { tiers: 2, scheme: 'white' } },
  { name: '6t-olive-nopull', c: { tiers: 6, scheme: 'olive', pullOut: false } },
  { name: 'wide-0.9', c: { width: 0.9, depth: 0.62, height: 1.2 } },
]) {
  const prod = buildCratesRack(cfg.c);
  const { stats, config } = prod;
  const box = crateBox(prod);
  const innerX = config.width / 2 - POST_W / 2, innerZ = config.depth / 2 - POST_W / 2;
  const overX = box.max.x - (innerX - BEAM);                              // 箱体（含唇边）在侧梁内侧面以内
  const pushedZ = config.pullOut ? 0 : Math.max(box.max.z, -box.min.z) - innerZ;
  const pulls = prod.crate.pulls;
  const pullOk = pulls.every((p) => p <= prod.crate.width * 0.8 + 1e-6);  // 抽出后箱体后沿仍压在滑轨上
  const topClear = topFrameBottom(config.height) - box.max.y;
  const ok = overX <= 1e-4 && pushedZ <= 1e-4 && pullOk && topClear >= -1e-4;
  if (!ok) failures++;
  console.log(`[${cfg.name}] 件=${stats.partCount} 重=${stats.weightKg.toFixed(1)}kg 抽出=${pulls.map((p) => p.toFixed(2)).join('/')}`);
  console.log(`  X 越界 ${overX.toFixed(4)} · 推入 Z 越界 ${pushedZ.toFixed(4)} · 抽出≤80%箱宽 ${pullOk} · 顶框余量 ${topClear.toFixed(4)} m → ${ok ? 'PASS' : 'FAIL'}`);
  prod.dispose();
}

console.log('\n=== 2. 光轴展架：展板顶边 vs 顶档横杆 ===');
for (const style of ['panel', 'acrylic']) {
  const { group, stats } = buildRodRack({ style, width: 0.8, height: 1.2 });
  const yTop = 1.282;              // 顶档横杆（buildRodRack 中的 yTop 公式，k=1）
  const boardBox = new THREE.Box3();
  group.traverse((o) => {
    if (!(o.isMesh || o.isInstancedMesh)) return;
    const m = o.material;
    if (!m) return;
    const isBoard = (m.transmission ?? 0) > 0 || (m.color && Math.abs(m.color.getHex() - 0xf0f1ee) < 0x080808);
    if (isBoard) boardBox.expandByObject(o);
  });
  const top = boardBox.max.y;
  const over = top - (yTop - 0.05);
  if (over > 0.0001) failures++;
  console.log(`[${style}] 板顶=${top.toFixed(3)} m，顶档横杆=${yTop.toFixed(3)} m，余量=${(yTop - top).toFixed(3)} m → ${over <= 0.0001 ? 'PASS 未超高' : 'FAIL 超顶杆'}`);
  console.log(`  板件面积=${(stats.panes[0] && stats.panes[0].areaM2)} m²`);
}

console.log('\n=== 3. 光轴木展车：四个开关对模型的影响 ===');
const base = buildWoodCart({});
console.log(`[全开] 件=${base.stats.partCount} 重=${base.stats.weightKg.toFixed(1)}kg`);
// 判据：件数或五金清单任一变化（脚轮 ↔ 地脚件数相同，但五金规格不同）
const sig = (b) => JSON.stringify(b.stats.hardware);
for (const key of ['pegboard', 'topRail', 'sideRail', 'casters']) {
  const off = buildWoodCart({ [key]: false });
  const delta = off.stats.partCount - base.stats.partCount;
  const changed = delta !== 0 || sig(off) !== sig(base);
  if (!changed) failures++;
  console.log(`[关闭 ${key}] 件=${off.stats.partCount}（Δ${delta}）→ ${changed ? 'PASS 开关影响模型' : 'FAIL 开关无影响'}`);
  off.dispose();
}
base.dispose();

console.log('\n=== 4. 周转箱：tiers × height 全配置穿顶/穿模扫描（推入状态）===');
let scanFail = 0, scanN = 0;
for (const tiers of [2, 3, 4, 5, 6]) {
  for (const height of [0.55, 0.7, 0.95, 1.2]) {
    const prod = buildCratesRack({ tiers, height, width: 0.62, depth: 0.42, pullOut: false });
    const box = crateBox(prod);
    const { config } = prod;
    const innerX = config.width / 2 - POST_W / 2, innerZ = config.depth / 2 - POST_W / 2;
    const topOk = box.max.y <= topFrameBottom(height) + 1e-4;
    const xOk = box.max.x <= innerX + 1e-4 && box.min.x >= -innerX - 1e-4;
    const zOk = box.max.z <= innerZ + 1e-4 && box.min.z >= -innerZ - 1e-4;
    scanN++;
    if (!(topOk && xOk && zOk)) {
      scanFail++; failures++;
      console.log(`  FAIL tiers=${tiers} h=${height}: 箱顶${box.max.y.toFixed(3)}/框底${topFrameBottom(height).toFixed(3)} X${box.max.x.toFixed(3)}/±${innerX.toFixed(3)} Z${box.max.z.toFixed(3)}/±${innerZ.toFixed(3)}`);
    }
    prod.dispose();
  }
}
console.log(`  扫描 ${scanN} 个配置 → ${scanFail === 0 ? 'PASS 全部未穿顶/穿模' : `FAIL ${scanFail} 个`}`);

console.log(failures === 0
  ? '\n✅ 全部几何断言 PASS'
  : `\n❌ ${failures} 项断言 FAIL`);
process.exitCode = failures === 0 ? 0 : 1;
