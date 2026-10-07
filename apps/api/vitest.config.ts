import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Os testes ponta a ponta compartilham api e worker no mesmo processo.
    fileParallelism: false,
  },
});
