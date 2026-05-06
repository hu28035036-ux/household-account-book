import { describe, it, expect } from 'vitest';
import { localizeAuthError } from '@/lib/auth/errorMessages';

describe('localizeAuthError', () => {
  it('Database error saving new user → 일반 가입 오류 안내', () => {
    expect(localizeAuthError('Database error saving new user')).toMatch(/가입 처리 중/);
  });
  it('email rate limit exceeded → 발송 한도', () => {
    expect(localizeAuthError('Email rate limit exceeded')).toMatch(/발송 한도/);
  });
  it('OTP expired/invalid → 만료/일치', () => {
    expect(localizeAuthError('Token has expired or is invalid')).toMatch(/만료|일치/);
    expect(localizeAuthError('OTP expired')).toMatch(/만료|일치/);
  });
  it('Network → 네트워크', () => {
    expect(localizeAuthError('Failed to fetch')).toMatch(/네트워크/);
  });
  it('Invalid email → 형식 안내', () => {
    expect(localizeAuthError('Invalid email')).toMatch(/형식/);
  });
  it('알 수 없는 메시지 → fallback + 원문 일부', () => {
    const out = localizeAuthError('something weird', '실패');
    expect(out).toMatch(/실패/);
    expect(out).toMatch(/something weird/);
  });
  it('empty/null → 기본 fallback', () => {
    expect(localizeAuthError(null)).toMatch(/오류/);
    expect(localizeAuthError('')).toMatch(/오류/);
  });
  it('직접 던진 한국어 메시지(EMAIL_NOT_ALLOWED 포함)는 그대로 인식', () => {
    expect(localizeAuthError('초대 명단에 등록되지 않은 이메일입니다 (EMAIL_NOT_ALLOWED): foo@bar.com')).toMatch(/초대 명단/);
  });
  it('Invalid login credentials → 아이디/비번 안내', () => {
    expect(localizeAuthError('Invalid login credentials')).toMatch(/아이디 또는 비밀번호/);
  });
  it('Already registered → 이미 가입 안내', () => {
    expect(localizeAuthError('User already registered')).toMatch(/이미 가입/);
  });
  it('weak password → 비밀번호 길이 안내', () => {
    expect(localizeAuthError('Password should be at least 8 characters')).toMatch(/비밀번호.*짧/);
  });
  it('signups disabled → 회원가입 비활성', () => {
    expect(localizeAuthError('Signups not allowed for this instance')).toMatch(/회원가입.*비활성/);
  });
});
