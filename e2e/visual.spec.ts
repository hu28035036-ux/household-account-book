import { test, expect } from '@playwright/test';

/**
 * 시각 회귀(Visual Regression) — 인증이 필요 없는 화면만 baseline.
 * 첫 실행 시 baseline이 없으면 Playwright가 생성하고 통과(reporter는 새 baseline 저장 안내).
 * 이후부터는 픽셀 비교로 회귀를 잡는다.
 *
 * 안정성 팁:
 *  - 폰트 로딩 대기 (page.evaluate(document.fonts.ready))
 *  - 애니메이션 disable (animations: 'disabled')
 *  - maxDiffPixelRatio 0.02로 OS/렌더 차이 허용
 */

test.describe('visual: /login', () => {
  test('전체 페이지 스냅샷', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(async () => {
      // @ts-ignore
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
    });
    // 입력 placeholder 깜빡임 등 제거를 위해 짧게 대기
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('login-full.png', {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    });
  });

  test('카드 영역만 스냅샷', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(async () => {
      // @ts-ignore
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
    });
    const card = page.locator('form').first();
    await expect(card).toHaveScreenshot('login-card.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    });
  });
});
