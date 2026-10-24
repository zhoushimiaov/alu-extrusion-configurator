import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';

const dist = pathToFileURL(resolve('dist/index.html')).href;

// GLTFLoader resolves embedded image buffers through a browser Image object
// even when the test process does not provide a DOM. Keep parser metadata
// usable; this test reads materials and transforms, not texture pixels.
if (typeof globalThis.self === 'undefined') globalThis.self = globalThis;
globalThis.self.createImageBitmap = async () => ({});

function envelope(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  return box.getSize(new THREE.Vector3()).toArray();
}

async function readDownload(page, buttonName) {
  const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
  await page.getByRole('button', { name: buttonName, exact: true }).click();
  const download = await downloadPromise;
  const bytes = await readFile(await download.path());
  const root = await new Promise((ok, fail) => new GLTFLoader().parse(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
    (gltf) => ok(gltf.scene),
    fail,
  ));
  return { name: download.suggestedFilename(), root };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('modulo.tour.v1', '1'));
});

test('GLB downloaded during explode and XRay has the assembled manufacturing envelope', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(dist + '#rod');
  await page.waitForFunction(() => window.__ALU_READY);
  await page.waitForTimeout(1800);
  const assembled = await page.evaluate(() => window.__ALU_GROUP().userData.envelope || null);
  await page.getByRole('button', { name: 'X 光透视', exact: true }).click();
  await page.getByRole('button', { name: '爆炸分解', exact: true }).click();
  await page.waitForTimeout(700);
  const { root } = await readDownload(page, '导出 3D 模型 (.glb)');
  const exported = envelope(root);
  expect(exported.every(Number.isFinite)).toBe(true);
  if (assembled) {
    for (let i = 0; i < 3; i++) expect(Math.abs(exported[i] - assembled[i === 0 ? 'W' : i === 1 ? 'H' : 'D'])).toBeLessThan(0.01);
  }
  expect(exported[2]).toBeGreaterThan(0.4);
  expect(exported[2]).toBeLessThan(0.8);
  expect(errors).toEqual([]);
});

test('switching product immediately after export still downloads the original assembled product', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(dist + '#rod');
  await page.waitForFunction(() => window.__ALU_READY);
  await page.waitForTimeout(1800);
  const assembled = await page.evaluate(() => window.__ALU_GROUP().userData.envelope || null);
  const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
  await page.getByRole('button', { name: '导出 3D 模型 (.glb)', exact: true }).click();
  await page.locator('#product-tabs [data-kind="table"]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^RodRack/);
  const bytes = await readFile(await download.path());
  expect(bytes.byteLength).toBeGreaterThan(10000);
  const root = await new Promise((ok, fail) => new GLTFLoader().parse(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
    (gltf) => ok(gltf.scene),
    fail,
  ));
  const exported = envelope(root);
  expect(exported.every(Number.isFinite)).toBe(true);
  expect(exported.every((value) => value > 0.01)).toBe(true);
  if (assembled) {
    for (let i = 0; i < 3; i++) {
      expect(Math.abs(exported[i] - assembled[i === 0 ? 'W' : i === 1 ? 'H' : 'D'])).toBeLessThan(0.01);
    }
  }
  expect(errors).toEqual([]);
});

test('GLB exported during connector fade keeps assembly materials instead of translucent animation materials', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(dist + '#profile');
  await page.waitForFunction(() => window.__ALU_READY);
  await page.waitForTimeout(1800);

  await page.locator('button[data-seg="frameMode"][data-val="standard"]').evaluate((button) => button.click());
  await page.waitForTimeout(800);
  const assembled = await page.evaluate(() => {
    const root = window.__ALU_GROUP();
    let connector = null;
    root.traverse((object) => { if (object.name === 'conn') connector = object; });
    const materials = Array.isArray(connector?.material) ? connector.material : [connector?.material];
    return materials.filter(Boolean).map((material) => ({
      opacity: material.opacity,
      transparent: material.transparent,
      depthWrite: material.depthWrite,
    }));
  });
  expect(assembled.length).toBeGreaterThan(0);

  await page.getByRole('button', { name: '爆炸分解', exact: true }).click();
  await page.waitForTimeout(180);
  const fading = await page.evaluate(() => {
    const root = window.__ALU_GROUP();
    let connector = null;
    root.traverse((object) => { if (object.name === 'conn') connector = object; });
    const materials = Array.isArray(connector?.material) ? connector.material : [connector?.material];
    return materials.filter(Boolean).some((material) => material.opacity < 1);
  });
  expect(fading).toBe(true);

  const { root } = await readDownload(page, '导出 3D 模型 (.glb)');
  const exportedConnectorMaterials = [];
  root.traverse((object) => {
    if (!object.isMesh || !object.name.startsWith('conn_')) return;
    for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
      if (material) exportedConnectorMaterials.push(material);
    }
  });
  expect(exportedConnectorMaterials.length).toBeGreaterThan(0);
  for (const material of exportedConnectorMaterials) {
    expect(assembled).toContainEqual({
      opacity: material.opacity,
      transparent: material.transparent,
      depthWrite: material.depthWrite,
    });
  }

  const restored = await page.evaluate(() => {
    const root = window.__ALU_GROUP();
    let connector = null;
    root.traverse((object) => { if (object.name === 'conn') connector = object; });
    const materials = Array.isArray(connector?.material) ? connector.material : [connector?.material];
    return materials.filter(Boolean).some((material) => material.opacity < 1);
  });
  expect(restored).toBe(true);
  expect(errors).toEqual([]);
});

test('XRay UI state applies to every newly mounted product', async ({ page }) => {
  await page.goto(dist + '#rod');
  await page.waitForFunction(() => window.__ALU_READY);
  await page.getByRole('button', { name: 'X 光透视', exact: true }).click();
  await page.locator('#product-tabs [data-kind="table"]').click();
  await expect(page.getByRole('button', { name: 'X 光透视', exact: true })).toHaveClass(/\bon\b/);
  const xray = await page.evaluate(() => {
    let found = false;
    window.__ALU_GROUP().traverse((object) => {
      if (!object.isMesh) return;
      if (Object.prototype.hasOwnProperty.call(object.userData, '__origMat')) found = true;
    });
    return found;
  });
  expect(xray).toBe(true);
});

test('switching product while print capture is pending never builds a mixed report', async ({ page }) => {
  await page.goto(dist + '#rod');
  await page.waitForFunction(() => window.__ALU_READY);
  await page.evaluate(() => {
    const nativeCapture = window.__ALU_CAPTURE;
    window.__printCalls = [];
    const originalWrite = HTMLDocument.prototype.write;
    HTMLDocument.prototype.write = function (html) {
      if (String(html).includes('设计与报价单')) window.__printCalls.push(String(html));
      return originalWrite.call(this, html);
    };
    window.__ALU_CAPTURE = (callback) => {
      window.__releasePrintCapture = () => nativeCapture(callback);
    };
  });
  await page.locator('#panel').getByRole('button', { name: '打印 / 导出 PDF', exact: true }).click();
  await page.locator('#product-tabs [data-kind="table"]').click();
  await page.evaluate(() => window.__releasePrintCapture?.());
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__printCalls)).toEqual([]);
  await expect(page.locator('#toast')).toContainText('产品已切换');
});
