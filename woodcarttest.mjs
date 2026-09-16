import { buildWoodCart } from './src/core/buildWoodCart.js';
globalThis.document = { createElement: (t) => t === 'canvas' ? { width: 0, height: 0, getContext: () => ({ fillRect(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){}, fill(){}, ellipse(){}, arc(){}, drawImage(){}, set fillStyle(v){}, set strokeStyle(v){}, set lineWidth(v){} }) } : {} };
const cases = [
  { name: 'default', cfg: {} },
  { name: 'tall-3shelves', cfg: { height: 2.6, shelves: 3 } },
  { name: 'min-1shelf', cfg: { width: 0.6, height: 1.6, shelves: 1, pegboard: false, sideRail: false } },
  { name: 'feet-walnut', cfg: { casters: false, woodTone: 'walnut' } },
];
for (const c of cases) {
  const { group, stats, bounds } = buildWoodCart(c.cfg);
  console.log(`[${c.name}] children=${group.children.length} parts=${stats.partCount} weight=${stats.weightKg.toFixed(1)}kg rod=${stats.profileLengthM.toFixed(2)}m bounds=${JSON.stringify(bounds)}`);
}
