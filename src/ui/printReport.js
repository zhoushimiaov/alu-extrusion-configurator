// 打印 / PDF 交付物：把当前配置的算料 + 报价 + 场景快照排成 A4 报告，
// 经隐藏 iframe 调起系统打印（用户可在打印对话框里"另存为 PDF"）。
// 零依赖、file:// 可用；快照由接线层在渲染帧内同步抓取 canvas（window.__ALU_CAPTURE），
// 拿不到快照时报告自动降级为纯表格版式。
import { calcMarketPrice } from './marketPrice.js';
import { configLineFor } from './cutlist.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const PRODUCT_TITLES = {
  profile: '工业铝型材置物架',
  rod: '光轴展架',
  cart: '移动边几',
  crates: '周转箱收纳架',
  woodcart: '光轴木展车',
  hanger: '光轴挂衣架',
  books: '光轴书架',
};

function money(n) { return '¥ ' + Math.round(n || 0).toLocaleString('zh-CN'); }

/** 组装报告 HTML（独立完整文档，打印样式全部内联，不依赖宿主页面 CSS） */
export function buildReportHtml({ kind, cfg, stats, snapshot, price }) {
  const q = price || calcMarketPrice(stats);
  const title = PRODUCT_TITLES[kind] || '配置方案';
  const now = new Date();
  const p2 = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())} ${p2(now.getHours())}:${p2(now.getMinutes())}`;
  let line = '';
  try { line = configLineFor(cfg, kind).configLine; } catch { /* 标签未注册等：报告不因摘要失败而中断 */ }

  const cuts = stats.cutList || [];
  const totalCutM = cuts.reduce((a, c) => a + (c.section === '板' ? 0 : c.len * c.qty), 0);
  const cutRows = cuts.map((c, i) =>
    `<tr><td class="num">${i + 1}</td><td>${esc(c.spec)}</td><td>${esc(c.section)}</td><td class="num">${c.span ?? c.len ?? ''}</td><td class="num">${c.len ?? ''}</td><td class="num">${c.qty}</td><td>${c.section === '板' ? '块' : '根'}</td></tr>`
  ).join('');
  const hwRows = (stats.hardware || []).map((h, i) =>
    `<tr><td class="num">${i + 1}</td><td>${esc(h.name)}</td><td class="num">${h.qty}</td><td>件</td></tr>`
  ).join('');
  const priceRows = (q.lines || []).map((l) =>
    `<tr><td>${esc(l.label)}</td><td>${esc(l.detail)}</td><td class="num">${money(l.cost)}</td></tr>`
  ).join('');

  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>MODULO 模数 · ${esc(title)} · 设计与报价单</title>
<style>
  @page { size: A4; margin: 13mm 12mm; }
  * { box-sizing: border-box; }
  body { font: 12px/1.65 "Microsoft YaHei", "PingFang SC", system-ui, sans-serif; color: #1a1d21; margin: 0; }
  .hd { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #1a1d21; padding-bottom: 8px; }
  .hd .brand { font-size: 17px; font-weight: 700; letter-spacing: .1em; }
  .hd .sub { color: #667; font-size: 10px; letter-spacing: .12em; }
  h2 { font-size: 13px; margin: 16px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #c9cdd2; }
  h2 .en { color: #99a; font-size: 10px; font-weight: 400; letter-spacing: .12em; margin-left: 8px; }
  .meta { color: #556; font-size: 10.5px; margin: 8px 0 2px; display: flex; gap: 18px; flex-wrap: wrap; }
  .cfg-line { font-size: 12.5px; margin: 6px 0 2px; }
  .hero img { width: 100%; max-height: 92mm; object-fit: contain; border: 1px solid #e2e4e8; border-radius: 4px; }
  .price-row { display: flex; align-items: baseline; gap: 22px; flex-wrap: wrap; margin: 4px 0 2px; }
  .price-big { font-size: 27px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .price-split { color: #556; font-size: 11px; }
  .price-src { color: #889; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; margin-top: 4px; }
  th, td { border: 1px solid #d8dbdf; padding: 3.5px 6px; text-align: left; vertical-align: top; }
  th { background: #f2f3f5; font-weight: 600; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .kv { display: flex; gap: 26px; flex-wrap: wrap; font-size: 11.5px; margin: 4px 0; }
  .kv b { font-variant-numeric: tabular-nums; }
  .warn { color: #9a5b00; background: #fdf4e3; border: 1px solid #f0dcb0; border-radius: 4px; padding: 5px 8px; font-size: 10.5px; margin-top: 6px; }
  .page-break { page-break-before: always; }
  .foot { margin-top: 14px; border-top: 1px solid #c9cdd2; padding-top: 6px; color: #778; font-size: 9.5px; line-height: 1.7; }
</style></head><body>
  <div class="hd"><span class="brand">MODULO 模数</span><span class="sub">DESIGN &amp; QUOTATION</span></div>
  <div class="cfg-line"><b>${esc(title)}</b> · 设计与报价单</div>
  <div class="meta">
    <span>生成时间 ${esc(stamp)}</span>
    ${line ? `<span>${esc(line)}</span>` : ''}
    <span>价格表：${esc(q.source || '')} · ${esc(q.updated || '')}</span>
  </div>
  ${snapshot ? `<div class="hero"><img src="${snapshot}" alt="当前配置 3D 视图"></div>` : ''}
  <h2>报价概览 <span class="en">SUMMARY</span></h2>
  <div class="price-row">
    <span class="price-big">${money(q.total)}${q.complete ? '' : ' +'}</span>
    <span class="price-split">材料 ${money(q.material)} · 五金 ${money(q.hardware)} · 板件 ${money(q.panes)}</span>
  </div>
  <div class="price-src">${q.complete ? '全项已计价' : `另有 ${q.unpriced.length} 项待询价：${esc((q.unpriced || []).join('、'))}`}</div>
  ${priceRows ? `<h2>比价明细 <span class="en">PRICE LINES</span></h2>
  <table><thead><tr><th style="width:34%">项目</th><th>数量 × 单价</th><th class="num" style="width:16%">小计</th></tr></thead><tbody>${priceRows}</tbody></table>` : ''}

  <h2 class="page-break">下料清单 <span class="en">CUT LIST</span></h2>
  <table><thead><tr><th style="width:7%">序号</th><th style="width:33%">名称</th><th style="width:12%">规格</th><th class="num">名义尺寸 (m)</th><th class="num">下料长度 (m)</th><th class="num">数量</th><th style="width:8%">单位</th></tr></thead>
  <tbody>${cutRows || '<tr><td colspan="7">无</td></tr>'}
  <tr><td colspan="4">合计（型材 / 光轴）</td><td class="num">${totalCutM.toFixed(1)}</td><td colspan="2">m</td></tr></tbody></table>

  <h2>五金与配件 <span class="en">HARDWARE</span></h2>
  <table><thead><tr><th style="width:10%">序号</th><th>名称</th><th class="num" style="width:14%">数量</th><th style="width:10%">单位</th></tr></thead>
  <tbody>${hwRows || '<tr><td colspan="4">无</td></tr>'}</tbody></table>

  <h2>统计 <span class="en">STATS</span></h2>
  <div class="kv">
    <span>主材总长 <b>${(stats.profileLengthM ?? 0).toFixed(1)} m</b></span>
    <span>估算自重 <b>${(stats.weightKg ?? 0).toFixed(1)} kg</b></span>
    <span>零件总数 <b>${(stats.partCount ?? 0).toLocaleString('zh-CN')} 件</b></span>
    ${stats.stripLengthM ? `<span>板条总长 <b>${stats.stripLengthM.toFixed(1)} m</b></span>` : ''}
  </div>
  <div class="foot">
    数据性质：配置器演示示例，下料前请以工程图复核。长度为未验证装配假设的演示结果，非加工指令；需卖家确认节点与公差后重新出图。<br>
    报价为按公开渠道价格表估算的参考值（${esc(q.source || '内置基准')}），不构成正式报价；承重、公差与适配以工程图纸与正式报价单为准。
  </div>
</body></html>`;
}

/** 生成报告并调起打印。返回是否成功。 */
export async function printCurrentReport(opts) {
  const html = buildReportHtml(opts);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    await new Promise((res) => {
      if (doc.readyState === 'complete') res();
      else {
        iframe.onload = res;
        setTimeout(res, 800); // file:// 下 onload 偶发不触发，兜底放行
      }
    });
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  } finally {
    // 打印对话框为阻塞式，afterprint 在部分浏览器不触发：延时清理兜底
    setTimeout(() => iframe.remove(), 60_000);
  }
}
