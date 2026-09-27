// 配置清单（购物车/比价暂存状态管理与抽屉 UI）
// 纪律：动态内容一律 createElement + textContent（item 字段来自 localStorage，
// 坚持 textContent 杜绝持久化 XSS 路径）；抽屉为模态对话框——焦点圈闭、
// Escape 关闭、关闭后焦点归还触发按钮。
const STORAGE_KEY = 'modulo_config_list';

function loadList() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveList(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // 忽略存储超限等异常
  }
  updateBadge();
}

let drawerEl = null;
let loadCallback = null;
let lastTrigger = null; // 打开抽屉的触发元素，关闭后焦点归还

// 轻量 toast（复用 index.html 的 #toast，与 main.js 同一视觉体系）
function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2400);
}



export function initConfigList(onLoad) {
  loadCallback = onLoad;
  updateBadge();
}

export function getConfigList() {
  return loadList();
}

export function addConfigItem({ kind, title, summary, priceText, cfg }) {
  const list = loadList();
  const item = {
    id: 'cfg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    kind,
    title,
    summary,
    priceText,
    cfg,
    timestamp: Date.now(),
    url: location.href,
  };
  list.unshift(item);
  if (list.length > 40) list.length = 40;
  saveList(list);
  if (drawerEl && drawerEl.classList.contains('open')) {
    renderDrawerContent();
  }
  return { item, totalCount: list.length };
}

export function removeConfigItem(id) {
  const list = loadList().filter(x => x.id !== id);
  saveList(list);
  if (drawerEl && drawerEl.classList.contains('open')) {
    renderDrawerContent();
  }
}

export function clearConfigList() {
  saveList([]);
  if (drawerEl && drawerEl.classList.contains('open')) {
    renderDrawerContent();
  }
}

export function updateBadge() {
  const list = loadList();
  const count = list.length;
  let btn = document.getElementById('config-list-btn');
  if (!btn) {
    const overlay = document.querySelector('.brand-overlay') || document.body;
    btn = document.createElement('button');
    btn.id = 'config-list-btn';
    btn.className = 'config-list-btn';
    btn.setAttribute('aria-label', '查看配置清单');
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg><span class="btn-text">清单</span><span class="badge-num">${count}</span>`;
    btn.addEventListener('click', toggleDrawer);
    overlay.appendChild(btn);
  }
  const badge = btn.querySelector('.badge-num');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
  }
  btn.classList.toggle('has-items', count > 0);
}

function ensureDrawer() {
  if (drawerEl) return drawerEl;
  drawerEl = document.createElement('div');
  drawerEl.id = 'config-drawer-root';
  drawerEl.className = 'config-drawer-root';
  drawerEl.innerHTML = `
    <div class="drawer-mask" data-act="close"></div>
    <div class="drawer-panel" role="dialog" aria-modal="true" aria-label="配置清单">
      <div class="drawer-header">
        <div class="dh-title">配置清单 <span class="dh-count" data-dh-count></span></div>
        <button class="drawer-close" data-act="close" aria-label="关闭清单"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div class="drawer-body" data-dh-body></div>
      <div class="drawer-footer" data-dh-footer></div>
    </div>
  `;
  drawerEl.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'close') closeDrawer();
  });
  // 焦点圈闭（模态）：Tab 循环限制在抽屉内，Escape 关闭
  drawerEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); closeDrawer(); return; }
    if (e.key !== 'Tab') return;
    const focusables = [...drawerEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter((el) => el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  document.body.appendChild(drawerEl);
  return drawerEl;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function renderDrawerContent() {
  const root = ensureDrawer();
  const list = loadList();
  const countEl = root.querySelector('[data-dh-count]');
  const bodyEl = root.querySelector('[data-dh-body]');
  const footerEl = root.querySelector('[data-dh-footer]');

  countEl.textContent = `(${list.length})`;

  if (!list.length) {
    bodyEl.replaceChildren();
    const empty = el('div', 'drawer-empty');
    const icon = el('div', 'empty-icon');
    icon.innerHTML = '<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 14l2 2 4-4"/></svg>';
    empty.append(
      icon,
      el('div', 'empty-title', '清单暂无已存配置'),
      el('div', 'empty-desc', '在下方或右侧配置面板点击「加入配置清单」，配置即可暂存到此处，方便对比不同方案。'),
    );
    bodyEl.appendChild(empty);
    footerEl.replaceChildren();
    return;
  }

  // 卡片：createElement + textContent（item 字段来自 localStorage，不走 innerHTML）
  for (const item of list) {
    const time = new Date(item.timestamp);
    const timeStr = `${time.getMonth() + 1}/${time.getDate()} ${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;

    const card = el('div', 'drawer-card');
    card.dataset.id = item.id;

    const top = el('div', 'dc-top');
    top.append(el('span', 'dc-tag', item.title), el('span', 'dc-time', timeStr));

    const summary = el('div', 'dc-summary', item.summary || '自定义配置');

    const bottom = el('div', 'dc-bottom');
    const price = el('div', 'dc-price', item.priceText || '¥ —');
    const actions = el('div', 'dc-actions');
    const loadBtn = el('button', 'dc-btn dc-load', '载入配置');
    loadBtn.title = '将该配置载入配置器';
    loadBtn.dataset.loadId = item.id;
    const delBtn = el('button', 'dc-btn dc-del', '删除');
    delBtn.title = '删除该条目';
    delBtn.dataset.delId = item.id;
    actions.append(loadBtn, delBtn);
    bottom.append(price, actions);

    card.append(top, summary, bottom);
    bodyEl.appendChild(card);
  }

  bodyEl.querySelectorAll('[data-load-id]').forEach(b => {
    b.addEventListener('click', () => {
      const id = b.dataset.loadId;
      const target = list.find(x => x.id === id);
      if (target && loadCallback) {
        loadCallback(target.kind, target.cfg);
        closeDrawer();
      }
    });
  });

  bodyEl.querySelectorAll('[data-del-id]').forEach(b => {
    b.addEventListener('click', () => {
      removeConfigItem(b.dataset.delId);
    });
  });

  // 底栏：清空（两步确认，替代系统 confirm）+ 复制摘要
  footerEl.replaceChildren();
  const row = el('div', 'df-row');
  const clearBtn = el('button', 'df-btn df-clear', '清空清单');
  clearBtn.id = 'df-clear-btn';
  const copyBtn = el('button', 'df-btn df-copy', '复制清单摘要');
  copyBtn.id = 'df-copy-btn';
  row.append(clearBtn, copyBtn);
  footerEl.appendChild(row);

  clearBtn.addEventListener('click', () => {
    if (clearBtn.dataset.armed) {
      clearConfigList();
      toast('清单已清空');
      return;
    }
    clearBtn.dataset.armed = '1';
    clearBtn.textContent = '确认清空？';
    toast('再点一次确认清空全部条目');
    setTimeout(() => {
      if (clearBtn.isConnected) {
        delete clearBtn.dataset.armed;
        clearBtn.textContent = '清空清单';
      }
    }, 3000);
  });

  copyBtn.addEventListener('click', () => {
    const text = list.map((item, i) => `${i + 1}. [${item.title}] ${item.summary} | ${item.priceText}`).join('\n');
    const fallbackCopy = () => {
      const ta = el('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand && document.execCommand('copy');
      ta.remove();
      toast(ok ? '清单内容已复制到剪贴板' : '复制失败，请手动选择文本复制');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => toast('清单内容已复制到剪贴板'))
        .catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
  });
}

export function openDrawer() {
  const el2 = ensureDrawer();
  lastTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  renderDrawerContent();
  requestAnimationFrame(() => {
    el2.classList.add('open');
    // 焦点进入抽屉（模态语义）：优先关闭按钮
    el2.querySelector('.drawer-close')?.focus();
  });
}

export function closeDrawer() {
  if (drawerEl) {
    drawerEl.classList.remove('open');
    // 焦点归还触发元素（模态关闭惯例）
    if (lastTrigger && lastTrigger.isConnected) lastTrigger.focus();
    lastTrigger = null;
  }
}

export function toggleDrawer() {
  if (drawerEl && drawerEl.classList.contains('open')) closeDrawer();
  else openDrawer();
}
