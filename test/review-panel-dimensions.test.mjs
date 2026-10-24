import test from 'node:test';
import assert from 'node:assert/strict';
import { withAssemblyDimensions } from '../src/ui/reviewedPanel.js';

test('protected profile panel displays the final envelope and retains its original stats behavior', () => {
  const cells={w:{innerHTML:'3.42'},h:{innerHTML:'2.75'},d:{innerHTML:'0.40'}};
  const root={querySelector:selector=>cells[selector.match(/"([whd])"/)[1]]};
  let seen;
  const inner={weightEl:{id:'weight'},updateStats(stats){seen=stats;}};
  const wrapped=withAssemblyDimensions(inner,root);
  const stats={envelope:{W:3.48,H:2.8,D:.418}};
  wrapped.updateStats(stats);
  assert.equal(seen,stats);
  assert.equal(wrapped.weightEl,inner.weightEl);
  assert.equal(cells.w.innerHTML,'3.48<small>m</small>');
  assert.equal(cells.h.innerHTML,'2.80<small>m</small>');
  assert.equal(cells.d.innerHTML,'0.42<small>m</small>');
  wrapped.updateStats({weightKg:10});
  assert.equal(cells.w.innerHTML,'3.48<small>m</small>');
});
