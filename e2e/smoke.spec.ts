import { test, expect } from '@playwright/test';

/**
 * Smoke 테스트 — 인증 없이도 가능한 회귀 검사.
 * - / → /login 으로 자동 이동 (미들웨어/page.tsx 동작)
 * - 보호 라우트는 모두 /login?redirect=...로 리다이렉트
 * - 로그인 화면이 깨지지 않고 핵심 폼 요소가 보임
 */

const PROTECTED_PATHS = [
  '/dashboard',
  '/transactions',
  '/upload',
  '/candidates',
  '/budgets',
  '/categories',
  '/payment-methods',
  '/households',
  '/notifications',
  '/files',
  '/settings',
  '/admin',
];

test('루트 → /login 자동 리다이렉트', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login(\?|$)/);
});

test('로그인 화면이 정상 렌더링', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'AI 가계부' })).toBeVisible();
  await expect(page.getByLabel('이메일')).toBeVisible();
  await expect(page.getByRole('button', { name: /인증 코드 받기/ })).toBeVisible();
});

for (const path of PROTECTED_PATHS) {
  test(`보호 라우트 ${path} 는 미로그인 시 /login 으로 보냄`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\?redirect=/);
  });
}

test('잘못된 라우트는 404 또는 안전한 화면', async ({ page }) => {
  const res = await page.goto('/this-page-does-not-exist');
  expect(res?.status()).toBeLessThan(500);
});
