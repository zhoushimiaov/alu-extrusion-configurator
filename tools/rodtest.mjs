import { buildRodRack } from '../src/core/buildRodRack.js';
globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect(){}, set fillStyle(v){}, set strokeStyle(v){}, set lineWidth(v){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){} }), width: 0, height: 0 }) };
const cases = [
  { name: 'default-1.2', cfg: {} },
  { name: 'tall-1.8-deck', cfg: { height: 1.8, shelf: 'deck' } },
  { name: 'wide-1.0-zinc', cfg: { width: 1.0, backPanel: 'zinc', shelf: 'none' } },
  { name: 'short-1.0-nocast', cfg: { height: 1.0, casters: false } },
];
for (const c of cases) {
  const { group, stats, bounds } = buildRodRack(c.cfg);
  console.log(`[${c.name}] children=${group.children.length} parts=${stats.partCount} weight=${stats.weightKg.toFixed(1)}kg rod=${stats.profileLengthM.toFixed(2)}m bounds=${JSON.stringify(bounds)}`);
}
