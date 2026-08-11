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
    // 守恒 / 确定性 / 无死锁这类不变量测试要跑完整对局，单条动辄 1~3 秒。
    // vitest 默认的 5s 上限在机器有负载时会把它们判成超时失败，
    // 使套件的红绿变成负载相关而非代码相关。放宽到 30s：
    // 真正挂死的用例仍会被拦住，正常的重型模拟不再假红。
    testTimeout: 30_000,
    reporters: ['default'],
  },
});
