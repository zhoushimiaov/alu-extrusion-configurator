// 配置清单（购物车/比价暂存状态管理与抽屉 UI）
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
  document.body.appendChild(drawerEl);
  return drawerEl;
}

function renderDrawerContent() {
  const el = ensureDrawer();
  const list = loadList();
  const countEl = el.querySelector('[data-dh-count]');
  const bodyEl = el.querySelector('[data-dh-body]');
  const footerEl = el.querySelector('[data-dh-footer]');

  countEl.textContent = `(${list.length})`;

  if (!list.length) {
    bodyEl.innerHTML = `
      <div class="drawer-empty">
        <div class="empty-icon"><svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 14l2 2 4-4"/></svg></div>
        <div class="empty-title">清单暂无已存配置</div>
        <div class="empty-desc">在下方或右侧配置面板点击「加入配置清单」，配置即可暂存到此处，方便对比不同方案。</div>
      </div>
    `;
    footerEl.innerHTML = '';
    return;
  }

  bodyEl.innerHTML = list.map(item => {
    const time = new Date(item.timestamp);
    const timeStr = `${time.getMonth() + 1}/${time.getDate()} ${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
    return `
      <div class="drawer-card" data-id="${item.id}">
        <div class="dc-top">
          <span class="dc-tag">${item.title}</span>
          <span class="dc-time">${timeStr}</span>
        </div>
        <div class="dc-summary">${item.summary || '自定义配置'}</div>
        <div class="dc-bottom">
          <div class="dc-price">${item.priceText || '¥ —'}</div>
          <div class="dc-actions">
            <button class="dc-btn dc-load" data-load-id="${item.id}" title="将该配置载入配置器">载入配置</button>
            <button class="dc-btn dc-del" data-del-id="${item.id}" title="删除该条目">删除</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // 绑定内部动作
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

  footerEl.innerHTML = `
    <div class="df-row">
      <button class="df-btn df-clear" id="df-clear-btn">清空清单</button>
      <button class="df-btn df-copy" id="df-copy-btn">复制清单摘要</button>
    </div>
  `;

  footerEl.querySelector('#df-clear-btn')?.addEventListener('click', () => {
    if (confirm('确定清空当前保存的所有配置条目吗？')) {
      clearConfigList();
    }
  });

  footerEl.querySelector('#df-copy-btn')?.addEventListener('click', () => {
    const text = list.map((item, i) => `${i + 1}. [${item.title}] ${item.summary} | ${item.priceText}`).join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        alert('清单内容已复制到剪贴板！');
      }).catch(() => {
        prompt('复制清单内容：', text);
      });
    } else {
      prompt('复制清单内容：', text);
    }
  });
}

export function openDrawer() {
  const el = ensureDrawer();
  renderDrawerContent();
  requestAnimationFrame(() => el.classList.add('open'));
}

export function closeDrawer() {
  if (drawerEl) {
    drawerEl.classList.remove('open');
  }
}

export function toggleDrawer() {
  if (drawerEl && drawerEl.classList.contains('open')) closeDrawer();
  else openDrawer();
}
