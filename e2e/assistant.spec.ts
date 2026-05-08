import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

/**
 * AI 어시스턴트 E2E.
 * - 시나리오: 시트 열기 → "스벅 5천" 입력 → 미리보기 → 추가 → /transactions 에서 새 거래 확인
 * - 시나리오: "통계 보여줘" → /stats 로 이동
 *
 * 필요 env: E2E_TEST_EMAIL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const HAS_ENV =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
  !!process.env.E2E_TEST_EMAIL;

const TEST_USER_TAG = '[E2E_ASSISTANT]'; // 테스트 거래 식별용

async function loginViaMagicLink(page: Page, baseUrl: string, email: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list.users.find((u) => u.email === email);
  if (!existing) {
    await admin.auth.admin.createUser({ email, email_confirm: true });
  }

  const { data: link, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${baseUrl}/auth/callback` },
  });
  if (error || !link?.properties?.action_link) {
    throw new Error('magic link 생성 실패');
  }

  await page.goto(link.properties.action_link);
  await page.waitForURL(
    (u: URL) => /\/dashboard/.test(u.toString()) || /\/auth\/callback/.test(u.toString()),
    { timeout: 30_000 },
  );
  await page.waitForLoadState('domcontentloaded');
  if (!/\/dashboard/.test(page.url())) {
    await page.goto(`${baseUrl}/dashboard`);
  }
}

test.describe('AI 어시스턴트 — Phase 1+2 통합', () => {
  test.skip(!HAS_ENV, '필수 env 미설정 — skip');

  test('시트 열기 + 헤더 ✨ 버튼 노출', async ({ page }) => {
    const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
    await loginViaMagicLink(page, baseUrl, process.env.E2E_TEST_EMAIL!);

    // 헤더 ✨ 버튼 클릭
    const trigger = page.getByRole('button', { name: /AI 입력/ });
    await expect(trigger).toBeVisible({ timeout: 10_000 });
    await trigger.click();

    // 시트 제목 확인
    await expect(page.getByRole('dialog', { name: 'AI 입력' })).toBeVisible();
    await expect(page.getByPlaceholder(/스벅 5천/)).toBeVisible();
  });

  test('navigate — "통계 보여줘" 입력 → /stats 이동', async ({ page }) => {
    const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
    await loginViaMagicLink(page, baseUrl, process.env.E2E_TEST_EMAIL!);

    await page.getByRole('button', { name: /AI 입력/ }).click();
    const input = page.getByPlaceholder(/스벅 5천/);
    await input.fill('통계 보여줘');
    await input.press('Enter');

    await page.waitForURL(/\/stats/, { timeout: 20_000 });
    expect(page.url()).toMatch(/\/stats/);
  });

  test('add_transaction — "스벅 5천" 입력 → 미리보기 → 추가 → 거래내역에 반영', async ({
    page,
  }) => {
    const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
    await loginViaMagicLink(page, baseUrl, process.env.E2E_TEST_EMAIL!);

    await page.getByRole('button', { name: /AI 입력/ }).click();
    const input = page.getByPlaceholder(/스벅 5천/);
    // E2E 식별용 태그를 가맹점에 끼워넣지 않음 (AI 가 정규화하므로) — 대신 거래내역 화면에서
    // 가장 최근 5,000원 스타벅스 거래로 식별
    await input.fill('스벅 5천');
    await input.press('Enter');

    // 미리보기 카드 — 스타벅스, 5,000원, 지출 표시
    await expect(page.getByText(/스타벅스/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/5,000/)).toBeVisible();

    // 추가 버튼
    const addBtn = page.getByRole('button', { name: /^추가$/ });
    await addBtn.click();

    // 성공 메시지 (1.5초 후 사라지므로 빨리 잡기)
    await expect(page.getByText(/추가됨/)).toBeVisible({ timeout: 10_000 });

    // /transactions 로 이동 (시트가 닫히면 다시 열거나 이동)
    await page.goto(`${baseUrl}/transactions`);
    // 가장 최근 거래에 스타벅스 + 5,000원
    await expect(page.getByText('스타벅스').first()).toBeVisible({ timeout: 15_000 });
  });

  test('add_transaction — 수입 케이스 "월급 100만 받음"', async ({ page }) => {
    const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
    await loginViaMagicLink(page, baseUrl, process.env.E2E_TEST_EMAIL!);

    await page.getByRole('button', { name: /AI 입력/ }).click();
    const input = page.getByPlaceholder(/스벅 5천/);
    await input.fill('월급 100만 받음');
    await input.press('Enter');

    // 미리보기 — +1,000,000 또는 1,000,000원 수입
    await expect(page.getByText(/1,000,000/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/수입/)).toBeVisible();

    await page.getByRole('button', { name: /^추가$/ }).click();
    await expect(page.getByText(/추가됨/)).toBeVisible({ timeout: 10_000 });
  });

  test('clarify — "5천" 입력 → 되묻기 메시지', async ({ page }) => {
    const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
    await loginViaMagicLink(page, baseUrl, process.env.E2E_TEST_EMAIL!);

    await page.getByRole('button', { name: /AI 입력/ }).click();
    const input = page.getByPlaceholder(/스벅 5천/);
    await input.fill('5천');
    await input.press('Enter');

    // 어디에서? 같은 되묻기
    await expect(page.getByText(/어디|어떤|무엇/)).toBeVisible({ timeout: 20_000 });
  });

  test('unknown — "ㅎㅇ" 입력 → 안내 메시지', async ({ page }) => {
    const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
    await loginViaMagicLink(page, baseUrl, process.env.E2E_TEST_EMAIL!);

    await page.getByRole('button', { name: /AI 입력/ }).click();
    const input = page.getByPlaceholder(/스벅 5천/);
    await input.fill('ㅎㅇ');
    await input.press('Enter');

    await expect(page.getByText(/가계부 명령으로 보이지 않습니다|이해하지 못했/)).toBeVisible({
      timeout: 20_000,
    });
  });
});
