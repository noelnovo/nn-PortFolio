import {defineConfig} from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {alias: {'@': path.resolve('src')}},
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    maxWorkers: 1,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage/app',
      thresholds: {lines: 80, branches: 80, functions: 80, statements: 80},
    },
  },
});
