// 上线前冒烟测试（Playwright, chromium headless）
// 覆盖:双产品加载、关键控件存在、视图切换、层数边界、导出按钮、价格区块、控制台无错误
// 运行:npm run smoke （需要先 npm run build）
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const dist = fileURLToPath(new URL('../dist/index.html', import.meta.url));

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.__errors = errors;
});

// 忽略外部资源失败（离线环境微信 JSSECARD 404 / CDN 不可达）：冒烟只关心应用自身错误
const appErrors = (page) => page.__errors.filter(e => !/jssecard|qq\.com|net::|Failed to load resource/.test(e));

test('型材架:加载就绪 + 关键控件 + 视图切换', async ({ page }) => {
  await page.goto(dist + '#profile');
  await page.waitForFunction(() => window.__ALU_READY !== undefined, null, { timeout: 20000 });
  // 关键控件（面板作用域，避开 HUD 重复）
  const panel = page.getByRole('complementary', { name: '配置面板' });
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
  // 面板内的层数 stepper（HUD 的增加/减少一层在 region "3D 预览" 下）
  const panel = page.getByRole('complementary', { name: '配置面板' });
  const minus = panel.getByRole('button', { name: '减少一层' });
  const readout = panel.locator('[data-num="levels"]');
  // 一路减到下限（LIMITS.levels = [2,8]）
  for (let i = 0; i < 8; i++) {
    const n = +(await readout.textContent());
    if (n <= 2) break;
    await minus.click();
    await expect(readout).not.toHaveText(String(n), { timeout: 5000 });
  }
  await expect(readout).toHaveText('2');
  await expect(minus).toBeDisabled();
  await page.waitForTimeout(600);
  expect(appErrors(page)).toEqual([]);
});

test('导出 3D 模型可点击并出 toast', async ({ page }) => {
  await page.goto(dist + '#profile');
  await page.waitForFunction(() => window.__ALU_READY !== undefined, null, { timeout: 20000 });
  await page.getByRole('complementary', { name: '配置面板' }).getByRole('button', { name: '导出 3D 模型 (.glb)' }).click();
  await expect(page.locator('#toast')).toContainText('3D 模型已导出', { timeout: 15000 });
  expect(appErrors(page)).toEqual([]);
});

test('光轴展架:切换 + 价格区块 + 导出按钮', async ({ page }) => {
  await page.goto(dist + '#rod');
  await page.waitForFunction(() => window.__ALU_READY !== undefined, null, { timeout: 20000 });
  const panel = page.getByRole('complementary', { name: '配置面板' });
  await expect(panel.getByRole('button', { name: '导出 3D 模型 (.glb)' })).toBeVisible();
  await expect(panel.locator('[data-price]')).toContainText('¥');
  await expect(panel.locator('[data-mkt-breakdown]')).toContainText('材料 ¥');
  // 切回型材架
  await page.getByRole('button', { name: '切换到铝型材置物架' }).click();
  await page.waitForTimeout(600);
  await expect(page.getByRole('button', { name: '切换到光轴展架' })).toBeVisible();
  await page.waitForTimeout(400);
  expect(appErrors(page)).toEqual([]);
});

test('构建产物内含 OG meta 与模型导出器', () => {
  const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  expect(html).toContain('og:image');
  expect(html).toContain('model/gltf-binary');
});
