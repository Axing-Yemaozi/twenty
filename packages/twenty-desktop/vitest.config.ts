import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    'process.env.TWENTY_DESKTOP_PRODUCTION_URL': JSON.stringify(
      'https://crm.example.com',
    ),
  },
  test: {
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text-summary'],
    },
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
