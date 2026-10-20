// 上线前冒烟测试（Playwright, chromium headless）
// 覆盖:双产品加载、关键控件存在、视图切换、层数边界、导出按钮、价格区块、控制台无错误
// 运行:npm run smoke （需要先 npm run build）
import { test, expect } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

// file:// URL（pathToFileURL）——page.goto 需要完整 URL，裸路径会报 invalid URL
const dist = pathToFileURL(fileURLToPath(new URL('../dist/index.html', import.meta.url))).href;

test.beforeEach(async ({ page }) => {
  // 预置首访引导跳过标记：spotlight 遮罩会拦截面板点击类用例（引导本身由人工/probe 覆盖）
  await page.addInitScript(() => localStorage.setItem('modulo.tour.v1', '1'));
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.__errors = errors;
});

// 忽略外部资源失败（离线环境微信 JSSECARD 404 / CDN 不可达）：冒烟只关心应用自身错误
const appErrors = (page) => page.__errors.filter(e => !/jssecard|qq\.com|net::|Failed to load resource/.test(e));

// CI（ubuntu-latest 无 GPU）走 SwiftShader 软件渲染：单次 GLB 重建阻塞主线程数十秒，
// 重建压力类用例在软件渲染下必然超时——检测到即跳过（本地/真机 GPU 正常执行）。
const isSoftwareGL = (page) => page.evaluate(() => {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(String(name));
});

test('型材架:加载就绪 + 关键控件 + 视图切换', async ({ page }) => {
  await page.goto(dist + '#profile');
  await page.waitForFunction(() => window.__ALU_READY !== undefined, null, { timeout: 20000 });
  // 关键控件（面板作用域，避开 HUD 重复）
  const panel = page.locator('#panel');
  await expect(panel.getByRole('button', { name: '加入配置清单' })).toBeVisible();
  await expect(panel.getByRole('button', { name: '采购清单 .xlsx' })).toBeVisible();
  await expect(panel.getByRole('button', { name: '采购清单 .csv' })).toBeVisible();
  await expect(panel.getByRole('button', { name: '导出 3D 模型 (.glb)' })).toBeVisible();
  await expect(panel.getByRole('button', { name: '阳极氧化银色' })).toBeVisible();
  await expect(panel.getByRole('button', { name: '阳极氧化黑色' })).toBeVisible();
  // 视图切换（HUD 内按钮）
  await page.getByRole('button', { name: '正视', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__ALU_PROJECTION?.())).toBe('orthographic');
  await page.getByRole('button', { name: '轴测', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__ALU_PROJECTION?.())).toBe('orthographic');
  await page.getByRole('button', { name: '透视', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__ALU_PROJECTION?.())).toBe('perspective');
  const targetBefore = await page.evaluate(() => window.__ALU_CAMERA_TARGET?.());
  await page.getByRole('button', { name: '节点近看', exact: true }).click();
  await page.waitForTimeout(1100);
  const targetAfter = await page.evaluate(() => window.__ALU_CAMERA_TARGET?.());
  expect(Math.hypot(...targetAfter.map((v,i) => v - targetBefore[i]))).toBeGreaterThan(0.10);
  expect(await page.evaluate(() => window.__ALU_PROJECTION?.())).toBe('perspective');
  expect(appErrors(page)).toEqual([]);
});

test('层数可减到 2 并稳定渲染', async ({ page }) => {
  await page.goto(dist + '#profile');
  await page.waitForFunction(() => window.__ALU_READY !== undefined, null, { timeout: 20000 });
  test.skip(await isSoftwareGL(page), '软件渲染：GLB 重建阻塞主线程，压力用例跳过（本地 GPU 覆盖）');
  // 面板内的层数 stepper（HUD 的增加/减少一层在 region "3D 预览" 下）
  const panel = page.locator('#panel');
  const minus = panel.getByRole('button', { name: '减少一层' });
  const readout = panel.locator('[data-num="levels"]');
  // 一路减到下限（LIMITS.levels = [2,8]）
  for (let i = 0; i < 8; i++) {
    const n = +(await readout.textContent());
    if (n <= 2) break;
    await minus.click();
    await expect(readout).not.toHaveText(String(n), { timeout: 10000 });
  }
  await expect(readout).toHaveText('2');
  await expect(minus).toBeDisabled();
  await page.waitForTimeout(600);
  expect(appErrors(page)).toEqual([]);
});

test('导出 3D 模型可点击并出 toast', async ({ page }) => {
  await page.goto(dist + '#profile');
  await page.waitForFunction(() => window.__ALU_READY !== undefined, null, { timeout: 20000 });
  test.skip(await isSoftwareGL(page), '软件渲染：GLTF 导出压力用例跳过（本地 GPU 覆盖）');
  await page.locator('#panel').getByRole('button', { name: '导出 3D 模型 (.glb)' }).click();
  await expect(page.locator('#toast')).toContainText('3D 模型已导出', { timeout: 30000 });
  expect(appErrors(page)).toEqual([]);
});

test('光轴展架:切换 + 价格区块 + 导出按钮', async ({ page }) => {
  await page.goto(dist + '#rod');
  await page.waitForFunction(() => window.__ALU_READY !== undefined, null, { timeout: 20000 });
  const panel = page.locator('#panel');
  await expect(panel.getByRole('button', { name: '导出 3D 模型 (.glb)' })).toBeVisible();
  await expect(panel.locator('[data-price]')).toContainText('¥');
  await expect(panel.locator('[data-mkt-breakdown]')).toContainText('材料 ¥');
  // 支撑点标记必须确实作用于3D层，且数据与几何四轮一致。
  await page.getByRole('button', { name: '支撑点标记', exact: true }).click();
  const supports = await page.evaluate(() => window.__ALU_SUPPORTS?.());
  expect(supports.markerCount).toBe(4);
  expect(supports.visible).toBe(true);
  await page.getByRole('button', { name: 'X 光透视', exact: true }).click();
  await expect(page.getByRole('button', { name: 'X 光透视', exact: true })).toHaveClass(/on/);
  await page.getByRole('button', { name: 'X 光透视', exact: true }).click();
  // 切回型材架
  await page.getByRole('tab', { name: '切换到铝型材置物架' }).click();
  await page.waitForTimeout(600);
  await expect(page.getByRole('tab', { name: '切换到光轴展架' })).toBeVisible();
  await page.waitForTimeout(400);
  expect(appErrors(page)).toEqual([]);
});

test('WebGL 不可用：八产品仍可切换并显示可用操作', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
      return original.call(this, type, ...args);
    };
  });
  const runtimeErrors = [];
  page.on('pageerror', (err) => runtimeErrors.push(String(err)));
  await page.goto(dist + '#rod');
  await expect(page.locator('#loader')).toHaveCSS('display', 'none', { timeout: 5000 });
  for (const kind of ['rod', 'cart', 'crates', 'woodcart', 'hanger', 'books', 'sheet', 'profile']) {
    await page.locator(`#product-tabs button[data-kind="${kind}"]`).click();
    if (kind === 'sheet') {
      await expect(page.locator('#panel').getByRole('button', { name: '导出工程算料单（待开发）' })).toBeVisible();
      await expect(page.locator('#panel').getByRole('button', { name: '导出工程算料单（待开发）' })).toBeDisabled();
    } else {
      await expect(page.locator('#panel').getByRole('button', { name: '导出算料单' })).toBeVisible();
    }
  }
  expect(runtimeErrors).toEqual([]);
});

test('镀锌板书架: 第八栏目和真实 GLB 原型预览信息', async ({ page }) => {
  await page.goto(dist + '#sheet');
  await page.waitForFunction(() => window.__ALU_READY !== undefined, null, { timeout: 20000 });
  const panel = page.locator('#panel');
  await expect(page.getByRole('tab', { name: '切换到镀锌板书架' })).toHaveAttribute('aria-selected', 'true');
  await expect(panel.locator('.panel-title')).toContainText('镀锌板书架');
  await expect(panel.getByRole('button', { name: '导出深化 3D 模型 (.glb)' })).toBeVisible();
  await expect(panel.getByRole('button', { name: '下载原始 GLB' })).toBeVisible();
  await expect(panel.getByRole('button', { name: '导出工程算料单（待开发）' })).toBeDisabled();
  await expect(panel.getByRole('group', { name: '板厚' })).toBeVisible();
  await expect(panel.getByRole('button', { name: '1.5 mm' })).toHaveAttribute('aria-pressed', 'true');
  await expect(panel).toContainText('原始 GLB');
  if (!(await isSoftwareGL(page))) {
    await page.waitForFunction(() => window.__ALU_GROUP?.()?.name === 'GalvanizedCabinet', null, { timeout: 25000 });
    const dims = await page.evaluate(() => {
      const g = window.__ALU_GROUP();
      const mesh = [...g.children];
      return { name: g.name, children: mesh.length };
    });
    expect(dims.name).toBe('GalvanizedCabinet');
    expect(dims.children).toBeGreaterThan(0);
  }
  expect(appErrors(page)).toEqual([]);
});

test('构建产物内含 OG meta 与模型导出器', () => {
  const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  expect(html).toContain('og:image');
  expect(html).toContain('model/gltf-binary');
});
