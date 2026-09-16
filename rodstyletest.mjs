import { buildRodRack } from './src/core/buildRodRack.js';
globalThis.document = { createElement: (t) => t === 'canvas' ? { width: 0, height: 0, getContext: () => ({ fillRect(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){}, fill(){}, ellipse(){}, set fillStyle(v){}, set strokeStyle(v){}, set lineWidth(v){} }) } : {} };
const cases = [
  { name: 'poster', cfg: { style: 'poster', backPanel: 'poster' } },
  { name: 'panel', cfg: { style: 'panel' } },
  { name: 'acrylic', cfg: { style: 'acrylic' } },
];
for (const c of cases) {
  const { group, stats } = buildRodRack(c.cfg);
  console.log(`[${c.name}] children=${group.children.length} parts=${stats.partCount} weight=${stats.weightKg.toFixed(1)}kg rod=${stats.profileLengthM.toFixed(2)}m panes=${JSON.stringify(stats.panes || [])}`);
}
