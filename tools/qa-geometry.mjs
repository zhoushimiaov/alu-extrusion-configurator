// 本轮修复的几何/联动验证脚本（node verify-r2.mjs）
// 1) 周转箱：箱体不得越出立柱内表面（用户报的穿模）
// 2) 光轴展架 panel / acrylic：板顶不得高于顶档横杆
// 3) 木展车四个开关：partCount 应随开关变化（证明面板 -> store -> 重建链路存在）
import * as THREE from 'three';
globalThis.document = { createElement: (t) => t === 'canvas' ? { width: 0, height: 0, getContext: () => ({ fillRect(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){}, fill(){}, ellipse(){}, arc(){}, drawImage(){}, set fillStyle(v){}, set strokeStyle(v){}, set lineWidth(v){} }) } : {} };

import { buildCratesRack } from '../src/core/buildCratesRack.js';
import { buildRodRack } from '../src/core/buildRodRack.js';
import { buildWoodCart } from '../src/core/buildWoodCart.js';
import { DEFAULT_CRATES_CONFIG } from '../src/config/crates.js';

const POST_W = 0.04;
const RIM_OUT = 0.013;   // 口沿外扩 + 装配间隙（与 buildCratesRack 保持一致）
const BEAM = 0.02;       // 2020 梁截面（buildCratesRack: const BEAM = 0.02）
const Y_WHEEL = 0.05;    // 轮心高（buildCratesRack: const yWheel = 0.05）

let failures = 0;        // 任一断言 FAIL 即累加；脚本末尾据此设置退出码（可作 CI 门禁）

console.log('=== 1. 周转箱收纳架：箱体 vs 框架内表面 ===');
for (const cfg of [
  { name: 'default-4t', c: {} },
  { name: '2t-white', c: { tiers: 2, scheme: 'white' } },
  { name: '6t-olive-nopull', c: { tiers: 6, scheme: 'olive', pullOut: false } },
  { name: 'wide-0.9', c: { width: 0.9, depth: 0.62, height: 1.2 } },
]) {
  const { group, stats, config } = buildCratesRack(cfg.c);
  // 关键：箱体是挂在嵌套 Group 下的普通 Mesh，必须先刷新世界矩阵，
  // 否则 expandByObject 取到的是局部坐标（丢失每层 yBase 堆叠与 Z 交错偏移）。
  group.updateMatrixWorld(true);
  const px = config.width / 2, pz = config.depth / 2;
  const innerX = px - POST_W / 2, innerZ = pz - POST_W / 2;
  const crateBox = new THREE.Box3();
  let crateCount = 0;
  group.traverse((o) => {
    if (o.isMesh && !o.isInstancedMesh) { crateBox.expandByObject(o); crateCount++; }
  });
  const overX = crateBox.max.x - (innerX - 0.001);
  const overZ = crateBox.max.z - (innerZ - 0.001);
  const underZ = -crateBox.min.z - (innerZ - 0.001);
  const ok = overX <= 0 && overZ <= 0 && underZ <= 0;
  if (!ok) failures++;
  console.log(`[${cfg.name}] 箱体网格=${crateCount} 件=${stats.partCount} 重=${stats.weightKg.toFixed(1)}kg`);
  console.log(`  立柱内表面 X=±${innerX.toFixed(3)} Z=±${innerZ.toFixed(3)}；箱体 X+${crateBox.max.x.toFixed(3)} / Z±${Math.max(crateBox.max.z, -crateBox.min.z).toFixed(3)}`);
  console.log(`  越界量：X ${overX.toFixed(4)} m，Z+ ${overZ.toFixed(4)} m，Z- ${underZ.toFixed(4)} m  → ${ok ? 'PASS 未穿模' : 'FAIL 仍穿模'}`);

  // 最顶层箱顶 ≤ 顶框底面（防止顶层箱穿插顶框；原 crateH 统一公式曾致顶层穿顶 59mm）
  const yPost1 = Y_WHEEL + 0.045 + BEAM / 2 + config.height;   // 立柱顶 = 顶框底面
  const topClear = yPost1 - crateBox.max.y;
  const topOk = topClear >= 0;
  if (!topOk) failures++;
  console.log(`  顶框底面=${yPost1.toFixed(3)} m，最顶层箱顶=${crateBox.max.y.toFixed(3)} m，余量=${topClear.toFixed(4)} m  → ${topOk ? 'PASS 未穿顶框' : 'FAIL 顶层穿顶框'}`);
}

console.log('\n=== 2. 光轴展架：展板顶边 vs 顶档横杆 ===');
for (const style of ['panel', 'acrylic']) {
  const { group, stats, bounds } = buildRodRack({ style, width: 0.8, height: 1.2 });
  const k = 1.2 / 1.2;
  const yTop = 1.282 * k;          // 顶档横杆（buildRodRack 中的 yTop 公式）
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

console.log('\n=== 3. 光轴木展车：四个开关对零件数的影响 ===');
const base = buildWoodCart({});
console.log(`[全开] 件=${base.stats.partCount} 重=${base.stats.weightKg.toFixed(1)}kg`);
for (const key of ['pegboard', 'topRail', 'sideRail', 'casters']) {
  const off = buildWoodCart({ [key]: false });
  const delta = off.stats.partCount - base.stats.partCount;
  if (delta === 0) failures++;
  console.log(`[关闭 ${key}] 件=${off.stats.partCount}（Δ${delta}）→ ${delta !== 0 ? 'PASS 开关影响模型' : 'FAIL 开关无影响'}`);
}

// 全配置扫描：tiers × height 矩阵，证明 crateHOf 封顶修复普适（非仅默认配置）
console.log('\n=== 4. 周转箱：tiers × height 全配置穿顶/穿模扫描 ===');
let scanFail = 0, scanN = 0;
for (const tiers of [2, 3, 4, 5, 6]) {
  for (const height of [0.55, 0.7, 0.95, 1.2]) {
    const { group, config } = buildCratesRack({ tiers, height, width: 0.62, depth: 0.42 });
    group.updateMatrixWorld(true);
    const box = new THREE.Box3();
    group.traverse((o) => { if (o.isMesh && !o.isInstancedMesh) box.expandByObject(o); });
    const yPost1 = Y_WHEEL + 0.045 + BEAM / 2 + height;   // 顶框底面
    const innerX = config.width / 2 - POST_W / 2, innerZ = config.depth / 2 - POST_W / 2;
    const topOk = box.max.y <= yPost1 + 1e-4;
    const xOk = box.max.x <= innerX + 1e-4 && box.min.x >= -innerX - 1e-4;
    const zOk = box.max.z <= innerZ + 1e-4 && box.min.z >= -innerZ - 1e-4;
    scanN++;
    if (!(topOk && xOk && zOk)) {
      scanFail++; failures++;
      console.log(`  FAIL tiers=${tiers} h=${height}: 箱顶${box.max.y.toFixed(3)}/框底${yPost1.toFixed(3)} X${box.max.x.toFixed(3)}/±${innerX.toFixed(3)} Z${box.max.z.toFixed(3)}/±${innerZ.toFixed(3)}`);
    }
    group.traverse((o) => { if (o.isMesh) o.geometry?.dispose?.(); });
  }
}
console.log(`  扫描 ${scanN} 个配置 → ${scanFail === 0 ? 'PASS 全部未穿顶/穿模' : `FAIL ${scanFail} 个`}`);

// 退出码：任一断言 FAIL 即非零退出，可直接接入 CI / npm script 做几何门禁
console.log(failures === 0
  ? '\n✅ 全部几何断言 PASS'
  : `\n❌ ${failures} 项断言 FAIL`);
process.exitCode = failures === 0 ? 0 : 1;
