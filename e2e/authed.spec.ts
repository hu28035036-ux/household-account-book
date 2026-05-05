import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

/**
 * 인증된 시나리오 e2e.
 * - 환경변수가 모두 갖춰진 경우에만 동작 (없으면 skip).
 * - admin client로 테스트 사용자를 만들고, 매직링크 대신 generateLink → 직접 콜백 호출로 세션 쿠키 획득.
 *
 * 필요 env:
 *   E2E_TEST_EMAIL                        ← 테스트용 메일(임의)
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const HAS_ENV =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
  !!process.env.E2E_TEST_EMAIL;

test.describe('인증된 사용자 흐름', () => {
  test.skip(!HAS_ENV, '필수 env 미설정 — skip');

  test('로그인 후 /dashboard 진입 + 대시보드 카드 4개 표시', async ({ page, context }) => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const email = process.env.E2E_TEST_EMAIL!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // 사용자 보장 (없으면 생성)
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = list.users.find((u) => u.email === email);
    if (!existing) {
      await admin.auth.admin.createUser({ email, email_confirm: true });
    }

    // 매직링크 직링크 생성
    const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
    const { data: link, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${baseUrl}/auth/callback` },
    });
    if (error || !link?.properties?.action_link) test.skip(true, '매직링크 생성 실패');

    // 콜백 URL 따라가서 세션 쿠키를 받음
    await page.goto(link!.properties!.action_link!);
    await page.waitForURL((u) => /\/dashboard/.test(u.toString()) || /\/auth\/callback/.test(u.toString()), {
      timeout: 30_000,
    });
    await page.waitForLoadState('domcontentloaded');

    if (!/\/dashboard/.test(page.url())) {
      await page.goto('/dashboard');
    }

    await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible();
    await expect(page.getByText('이번 달 지출')).toBeVisible();
    await expect(page.getByText('이번 달 수입')).toBeVisible();
    await expect(page.getByText('잔액')).toBeVisible();
    await expect(page.getByText('AI 분석 대기 후보')).toBeVisible();
  });
});
