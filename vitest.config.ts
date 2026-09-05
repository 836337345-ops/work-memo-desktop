import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'tests/contract/**/*.{test,spec}.{ts,tsx}',
    ],
    clearMocks: true,
  },
});
