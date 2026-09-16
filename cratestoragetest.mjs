import { buildCratesRack } from './src/core/buildCratesRack.js';
const cases = [
  { name: 'default-4t', cfg: {} },
  { name: '2t-white', cfg: { tiers: 2, scheme: 'white' } },
  { name: '6t-olive-nopull', cfg: { tiers: 6, scheme: 'olive', pullOut: false } },
  { name: 'feet', cfg: { casters: false } },
];
for (const c of cases) {
  const { group, stats, bounds } = buildCratesRack(c.cfg);
  console.log(`[${c.name}] children=${group.children.length} parts=${stats.partCount} weight=${stats.weightKg.toFixed(1)}kg rod=${stats.profileLengthM.toFixed(2)}m bounds=${JSON.stringify(bounds)}`);
}
