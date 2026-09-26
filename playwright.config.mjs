import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'test',
  timeout: 60000,
  retries: 0,
  workers: 1,
  use: {
    headless: true,
    channel: 'chrome', // 系统级 Chrome：CI ubuntu-latest 预装，本地免下载 ms-playwright 浏览器
    viewport: { width: 1440, height: 900 },
  },
  reporter: [['list']],
});
