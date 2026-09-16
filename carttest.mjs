import { buildCartTable } from './src/core/buildCartTable.js';
// Node 冒烟：提供最小 document.createElement('canvas') 桩（wood 纹理路径会用到）
globalThis.document = {
  createElement: (tag) => {
    if (tag === 'canvas') {
      return {
        width: 0, height: 0,
        getContext: () => ({
          fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
          fill() {}, ellipse() {},
          set fillStyle(v) {}, set strokeStyle(v) {}, set lineWidth(v) {},
        }),
      };
    }
    return {};
  },
};
const cases = [
  { name: 'default', cfg: {} },
  { name: 'no-glass', cfg: { glassTop: false } },
  { name: 'frost-norail', cfg: { midAcrylic: 'frost', rodRails: false } },
  { name: 'walnut-feet', cfg: { woodFinish: 'walnut', casters: false } },
  { name: 'big', cfg: { width: 0.8, depth: 0.65, height: 0.9 } },
];
for (const c of cases) {
  const { group, stats, bounds } = buildCartTable(c.cfg);
  console.log(`[${c.name}] children=${group.children.length} parts=${stats.partCount} weight=${stats.weightKg.toFixed(1)}kg rod=${stats.profileLengthM.toFixed(2)}m bounds=${JSON.stringify(bounds)}`);
}
