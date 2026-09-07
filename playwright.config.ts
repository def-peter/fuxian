import { defineConfig } from '@playwright/test';

// Most E2E specs use Chinese accessible names; localization specs override this per launch.
process.env.FUXIAN_E2E_SYSTEM_LOCALE ??= 'zh-CN';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
  },
});
