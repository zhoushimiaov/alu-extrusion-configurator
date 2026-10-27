import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReportHtml } from '../src/ui/printReport.js';

test('A4 quotation report uses the MEKIT brand in title and header', () => {
  const html = buildReportHtml({
    kind: 'profile',
    cfg: {},
    stats: { cutList: [], hardware: [], panes: [], profileLengthM: 0, weightKg: 0, partCount: 0 },
    price: {
      lines: [],
      total: 0,
      material: 0,
      hardware: 0,
      panes: 0,
      complete: true,
      unpriced: [],
      source: 'test',
      updated: '2026-10-27',
    },
  });
  assert.match(html, /<title>MEKIT\. · 工业铝型材置物架 · 设计与报价单<\/title>/);
  assert.match(html, /<span class="brand">MEKIT\.<\/span>/);
  assert.match(html, /A DESIGN SYSTEM BY MEANS · DESIGN &amp; QUOTATION/);
  assert.doesNotMatch(html, /MODULO/);
});
