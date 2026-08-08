import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // 核心逻辑是纯 TS，不依赖 DOM；存档测试使用自实现的 localStorage stub。
    // 界面冒烟测试通过文件头的 `@vitest-environment jsdom` 单独切换环境。
    environment: 'node',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost/',
      },
    },
    include: ['tests/**/*.test.{ts,tsx}'],
    reporters: ['default'],
  },
});
