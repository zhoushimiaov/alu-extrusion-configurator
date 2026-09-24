// 面板价格区块：市场参考价 + 材料/五金/板件拆分 + 逐项淘宝/1688 比价链接
// 双产品面板共用。DOM 操作全部 textContent，不注入 HTML。
import { taobaoUrl, alibabaUrl } from '../config/market.js';
import { calcMarketPrice } from './marketPrice.js';
import { fmtPrice } from './store.js';

/** 价格区块 HTML（嵌入面板 price-block 中 [data-price] 行之后） */
export const PRICE_MARKET_HTML = `
  <div class="price-src" data-mkt-src></div>
  <div class="price-breakdown" data-mkt-breakdown></div>
  <details class="price-detail">
    <summary>比价明细 · 淘宝 / 1688</summary>
    <div class="price-lines" data-mkt-lines></div>
  </details>`;

/** 用最新算料 stats 刷新价格区块。返回市场报价 quote。 */
export function updatePriceBlock(priceBlock, stats) {
  const q = calcMarketPrice(stats);
  const pEl = priceBlock.querySelector('[data-price]');
  if (pEl) {
    pEl.textContent = fmtPrice(q.total);
    pEl.classList.remove('num-updated');
    void pEl.offsetWidth;
    pEl.classList.add('num-updated');
  }
  priceBlock.querySelector('[data-mkt-src]').textContent =
    `${q.source} · 表版本 ${q.updated}${q.complete ? "" : " · 有未计价项：" + q.unpriced.join("、")}`;
  priceBlock.querySelector('[data-mkt-breakdown]').textContent =
    `材料 ¥${q.material.toLocaleString('zh-CN')} · 五金 ¥${q.hardware.toLocaleString('zh-CN')} · 板件 ¥${q.panes.toLocaleString('zh-CN')}`;

  const box = priceBlock.querySelector('[data-mkt-lines]');
  box.innerHTML = '';
  for (const line of q.lines) {
    const row = document.createElement('div');
    row.className = 'price-line-item';

    const label = document.createElement('span');
    label.className = 'pl-label';
    label.textContent = line.label;
    const detail = document.createElement('span');
    detail.className = 'pl-detail';
    detail.textContent = `${line.detail} → ¥${Math.round(line.cost).toLocaleString('zh-CN')}`;

    const links = document.createElement('span');
    links.className = 'pl-links';
    const tb = document.createElement('a');
    tb.href = taobaoUrl(line.query); tb.target = '_blank'; tb.rel = 'noopener';
    tb.textContent = '淘宝';
    const a16 = document.createElement('a');
    a16.href = alibabaUrl(line.query); a16.target = '_blank'; a16.rel = 'noopener';
    a16.textContent = '1688';
    links.append(tb, a16);

    row.append(label, detail, links);
    box.appendChild(row);
  }
  return q;
}
