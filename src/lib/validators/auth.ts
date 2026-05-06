import { z } from 'zod';

// 아이디: 영문/숫자/_/- 3~20자, 시작은 영문
export const Username = z
  .string()
  .min(3, '아이디는 3자 이상')
  .max(20, '아이디는 20자 이하')
  .regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/, '아이디는 영문/숫자/_/- 만 사용 (시작은 영문)');

export const Password = z
  .string()
  .min(8, '비밀번호는 8자 이상')
  .max(72, '비밀번호는 72자 이하');

export const SignupInput = z.object({
  username: Username,
  full_name: z.string().min(1, '이름을 입력하세요').max(40),
  birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식'),
  email: z.string().email('이메일 형식이 올바르지 않습니다').max(254),
  password: Password,
});
export type SignupInput = z.infer<typeof SignupInput>;

export const LoginInput = z.object({
  username: Username,
  password: Password,
});
export type LoginInput = z.infer<typeof LoginInput>;
