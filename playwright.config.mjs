import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'test',
  timeout: 60000,
  retries: 0,
  workers: 1,
  use: {
    headless: true,
    viewport: { width: 1440, height: 900 },
  },
  reporter: [['list']],
});
