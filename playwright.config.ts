import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const useExternalServer = !!process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  },
  projects: [
    { name: 'mobile-360', use: { ...devices['Pixel 5'], viewport: { width: 360, height: 740 } } },
    { name: 'mobile-390', use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } } },
    { name: 'tablet-768', use: { ...devices['iPad (gen 7) landscape'], viewport: { width: 768, height: 1024 } } },
    { name: 'desktop-1024', use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } } },
    { name: 'desktop-1280', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'desktop-1440', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: useExternalServer
    ? undefined
    : {
        command: 'npm run dev',
        url: BASE_URL,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
        env: {
          // dev 서버가 인증 호출 시 죽지 않도록 dummy 값 주입(테스트는 인증 없는 경로만 검증).
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://example.supabase.co',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'dummy-anon-key',
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'dummy-service-key',
          OLLAMA_API_BASE_URL: process.env.OLLAMA_API_BASE_URL ?? 'http://localhost:11434',
          OLLAMA_MODEL: process.env.OLLAMA_MODEL ?? 'gemma4:e4b',
          NEXT_PUBLIC_OCR_LANGUAGE: process.env.NEXT_PUBLIC_OCR_LANGUAGE ?? 'kor+eng',
        },
      },
});
