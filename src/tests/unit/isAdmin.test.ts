import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isAdminEmail } from '@/lib/admin/isAdmin';

describe('isAdminEmail', () => {
  const original = process.env.ADMIN_EMAILS;
  beforeEach(() => {
    process.env.ADMIN_EMAILS = '';
  });
  afterEach(() => {
    process.env.ADMIN_EMAILS = original;
  });

  it('환경변수 없으면 누구도 admin 아님', () => {
    process.env.ADMIN_EMAILS = '';
    expect(isAdminEmail('a@b.com')).toBe(false);
  });
  it('정확 매칭(대소문자 무시)', () => {
    process.env.ADMIN_EMAILS = 'admin@x.com,owner@y.com';
    expect(isAdminEmail('admin@x.com')).toBe(true);
    expect(isAdminEmail('ADMIN@x.com')).toBe(true);
    expect(isAdminEmail('Owner@y.com')).toBe(true);
  });
  it('미등록 이메일은 false', () => {
    process.env.ADMIN_EMAILS = 'admin@x.com';
    expect(isAdminEmail('user@x.com')).toBe(false);
  });
  it('null/빈 입력은 false', () => {
    process.env.ADMIN_EMAILS = 'admin@x.com';
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
    expect(isAdminEmail('')).toBe(false);
  });
  it('공백/콤마 변형 처리', () => {
    process.env.ADMIN_EMAILS = '  admin@x.com , , owner@y.com  ';
    expect(isAdminEmail('admin@x.com')).toBe(true);
    expect(isAdminEmail('owner@y.com')).toBe(true);
  });
});
