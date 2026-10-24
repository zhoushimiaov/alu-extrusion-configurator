import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const dist = pathToFileURL(resolve('dist/index.html')).href;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('modulo.tour.v1', '1'));
});

test('legacy table share opens the independent table and survives reload', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  const old = { kind: 'books', style: 'table', tBays: 2, tBayW: .95, depth: .4, glassTop: false };
  const encoded = Buffer.from(JSON.stringify(old)).toString('base64url');
  await page.goto(dist + '#books/side?c=' + encoded);
  await page.waitForFunction(() => window.__ALU_READY);
  await expect(page.locator('#panel .panel-title')).toContainText('阅读长桌');
  await expect(page.locator('[data-num="tBays"]')).toHaveText(/2/);
  expect(new URL(page.url()).hash).toMatch(/^#table\/side\?c=/);
  await page.reload();
  await page.waitForFunction(() => window.__ALU_READY);
  await expect(page.locator('#panel .panel-title')).toContainText('阅读长桌');
  await expect(page.locator('[data-num="tBays"]')).toHaveText(/2/);
  expect(errors).toEqual([]);
});

for (const kind of ['hanger', 'profile']) {
  test(`${kind} explode-close preserves every assembly transform in the shipped file`, async ({ page }) => {
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.goto(dist + '#' + kind);
    await page.waitForFunction(() => window.__ALU_READY);
    await page.waitForTimeout(1800);
    const matrices = () => page.evaluate(() => {
      const root = window.__ALU_GROUP(); root.updateMatrixWorld(true);
      const result = []; root.traverse(o => result.push(o.matrixWorld.toArray()));
      return result;
    });
    const before = await matrices();
    const explode = page.getByRole('button', { name: '爆炸分解', exact: true });
    await explode.click();
    await page.waitForTimeout(1800);
    if (kind === 'profile') await page.getByRole('button', { name: '节点近看', exact: true }).click();
    else await explode.click();
    await page.waitForTimeout(1000);
    await expect(explode).not.toHaveClass(/\bon\b/);
    const after = await matrices();
    expect(after.length).toBe(before.length);
    let delta = 0;
    after.forEach((matrix, i) => matrix.forEach((v, j) => { delta = Math.max(delta, Math.abs(v - before[i][j])); }));
    expect(delta).toBeLessThan(1e-7);
    expect(errors).toEqual([]);
  });
}

test('loading a legacy table from the configuration list keeps its product identity', async ({ page }) => {
  const cfg = { kind:'books', style:'table', tBays:1, tBayW:.9, glassTop:false };
  await page.addInitScript(cfg => {
    localStorage.setItem('modulo_config_list', JSON.stringify([{
      id:'legacy-table',kind:'books',title:'旧阅读长桌',summary:'单节',priceText:'',cfg,timestamp:1,
    }]));
  }, cfg);
  await page.goto(dist + '#rod');
  await page.waitForFunction(() => window.__ALU_READY);
  await page.getByRole('button', {name:'查看配置清单',exact:true}).click();
  await page.getByRole('button', {name:'载入配置',exact:true}).click();
  await expect(page.locator('#panel .panel-title')).toContainText('阅读长桌');
  await expect(page.locator('[data-num="tBays"]')).toHaveText(/1/);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('modulo_config_list')));
  expect(saved[0].cfg).toEqual(cfg);
});
