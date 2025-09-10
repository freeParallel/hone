import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  use: {
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:5173'
  },
  // Reuse existing server if you're running `pnpm dev` locally; otherwise start preview
  webServer: {
    command: 'pnpm run preview -- --host 127.0.0.1 --port 5173',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 120_000
  }
});

