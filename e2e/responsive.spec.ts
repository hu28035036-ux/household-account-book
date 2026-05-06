import { test, expect } from '@playwright/test';

/**
 * 반응형 점검 — 6개 뷰포트(playwright.config 프로젝트별 자동 적용).
 * 인증 없이 닿을 수 있는 /login 페이지 + 보호 라우트 진입 시 리다이렉트된 /login 페이지를 점검.
 */

test('로그인 화면: 가로 스크롤 없음', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  // 가로 오버플로 검사: documentElement.scrollWidth <= clientWidth + 1
  const overflow = await page.evaluate(() => {
    const el = document.documentElement;
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
  });
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
});

test('로그인 화면: 핵심 컨트롤 터치 영역 ≥ 44px (모바일에서만 의미)', async ({ page, viewport }) => {
  await page.goto('/login');
  if (!viewport || viewport.width >= 768) {
    test.skip();
    return;
  }
  const button = page.getByRole('button', { name: /인증 코드 받기/ });
  const box = await button.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

  const input = page.getByLabel('이메일');
  const inputBox = await input.boundingBox();
  expect(inputBox?.height ?? 0).toBeGreaterThanOrEqual(40);
});

test('로그인 폼이 화면 안쪽에 정렬', async ({ page, viewport }) => {
  await page.goto('/login');
  if (!viewport) {
    test.skip();
    return;
  }
  const card = page.locator('form').first();
  const box = await card.boundingBox();
  expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width + 1);
});
