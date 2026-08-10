import { defineConfig } from '@playwright/test';

/**
 * PW_BASE_URL 允许把同一套 spec 指向一个「已经在跑」的构建产物。
 *
 * Phase 4D-2 需要在基线提交（ce508cf）与改造后各跑一次同一个度量脚本，
 * 才能给出可比的信息架构数字；基线那次由外部 worktree 自行 build + preview，
 * 因此这里必须能关掉内建 webServer，避免它重复构建当前分支并抢端口。
 */
const externalBaseUrl = process.env.PW_BASE_URL;

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: externalBaseUrl ?? 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  ...(externalBaseUrl
    ? {}
    : {
        webServer: {
          command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173',
          url: 'http://127.0.0.1:4173',
          reuseExistingServer: false,
          timeout: 120_000,
        },
      }),
});
