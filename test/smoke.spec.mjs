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
  const panel = page.page.locator('#panel');
  await expect(panel.getByRole('button', { name: '加入配置清单' })).toBeVisible();
  await expect(panel.getByRole('button', { name: '导出算料单' })).toBeVisible();
  await expect(panel.getByRole('button', { name: '导出 3D 模型 (.glb)' })).toBeVisible();
  await expect(panel.getByRole('button', { name: '阳极氧化银色' })).toBeVisible();
  await expect(panel.getByRole('button', { name: '阳极氧化黑色' })).toBeVisible();
  // 视图切换（HUD 内按钮）
  await page.getByRole('button', { name: '正视', exact: true }).click();
  await page.getByRole('button', { name: '轴测', exact: true }).click();
  await page.waitForTimeout(400);
  expect(appErrors(page)).toEqual([]);
});

test('层数可减到 2 并稳定渲染', async ({ page }) => {
  await page.goto(dist + '#profile');
  await page.waitForFunction(() => window.__ALU_READY !== undefined, null, { timeout: 20000 });
  test.skip(await isSoftwareGL(page), '软件渲染：GLB 重建阻塞主线程，压力用例跳过（本地 GPU 覆盖）');
  // 面板内的层数 stepper（HUD 的增加/减少一层在 region "3D 预览" 下）
  const panel = page.page.locator('#panel');
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
  await page.page.locator('#panel').getByRole('button', { name: '导出 3D 模型 (.glb)' }).click();
  await expect(page.locator('#toast')).toContainText('3D 模型已导出', { timeout: 30000 });
  expect(appErrors(page)).toEqual([]);
});

test('光轴展架:切换 + 价格区块 + 导出按钮', async ({ page }) => {
  await page.goto(dist + '#rod');
  await page.waitForFunction(() => window.__ALU_READY !== undefined, null, { timeout: 20000 });
  const panel = page.page.locator('#panel');
  await expect(panel.getByRole('button', { name: '导出 3D 模型 (.glb)' })).toBeVisible();
  await expect(panel.locator('[data-price]')).toContainText('¥');
  await expect(panel.locator('[data-mkt-breakdown]')).toContainText('材料 ¥');
  // 切回型材架
  await page.getByRole('tab', { name: '切换到铝型材置物架' }).click();
  await page.waitForTimeout(600);
  await expect(page.getByRole('tab', { name: '切换到光轴展架' })).toBeVisible();
  await page.waitForTimeout(400);
  expect(appErrors(page)).toEqual([]);
});

test('构建产物内含 OG meta 与模型导出器', () => {
  const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  expect(html).toContain('og:image');
  expect(html).toContain('model/gltf-binary');
});
