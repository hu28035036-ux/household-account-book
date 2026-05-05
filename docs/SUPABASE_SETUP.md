# SUPABASE_SETUP

## 프로젝트 생성
1. supabase.com에서 프로젝트 생성(Free 플랜).
2. 리전: `Northeast Asia (Seoul)` 권장.
3. DB 비밀번호 안전하게 보관(외부 노출 금지).

## 환경변수
| 변수 | 위치 | 설명 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | 절대 클라이언트 노출 금지 |
| `SUPABASE_STORAGE_BUCKET` | server | 버킷 이름(예: `receipts`) |

## Auth
- 이메일 + 비밀번호 + 매직링크 활성화.
- 이메일 템플릿(한국어) 정비.
- Redirect URL에 로컬 개발(`http://localhost:3000`) + Vercel 도메인 등록.

## Storage
- 버킷: `receipts` (private).
- 폴더 구조: `{user_id}/{yyyy}/{mm}/{uuid}.{ext}`.
- 정책 예:
  ```sql
  -- READ
  create policy "user can read own files"
  on storage.objects for select
  using ( bucket_id = 'receipts' and (auth.uid()::text = (storage.foldername(name))[1]) );

  -- WRITE
  create policy "user can upload own files"
  on storage.objects for insert
  with check ( bucket_id = 'receipts' and (auth.uid()::text = (storage.foldername(name))[1]) );

  -- DELETE
  create policy "user can delete own files"
  on storage.objects for delete
  using ( bucket_id = 'receipts' and (auth.uid()::text = (storage.foldername(name))[1]) );
  ```

## DB
- `supabase/migrations/` 디렉터리에 마이그레이션 SQL 파일을 timestamp 접두사로 보관.
- 모든 테이블 RLS 활성화.
- 기본 카테고리/결제수단 시드는 사용자 가입 트리거로 1회 삽입.

### 가입 시 시드 트리거 예시
```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles(user_id) values (new.id) on conflict do nothing;
  -- 기본 카테고리/결제수단 insert ...
  return new;
end;$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
```

## RLS 표준 정책 (모든 사용자 소유 테이블)
```sql
alter table TABLE enable row level security;
create policy "select_own" on TABLE for select using (auth.uid() = user_id);
create policy "insert_own" on TABLE for insert with check (auth.uid() = user_id);
create policy "update_own" on TABLE for update using (auth.uid() = user_id);
create policy "delete_own" on TABLE for delete using (auth.uid() = user_id);
```

## 클라이언트 분리
- `lib/supabase/client.ts` — 브라우저 클라이언트(anon key).
- `lib/supabase/server.ts` — 서버 컴포넌트/Route Handler(요청 컨텍스트의 세션 사용).
- `lib/supabase/admin.ts` — service role 사용. **서버 전용**, 가능한 한 안 쓰는 게 원칙. 트리거/잡 처리에 한정.

## 마이그레이션 워크플로
- 로컬에서 SQL 작성 → dev 프로젝트 적용 → 검증 → main 머지 시 production 적용.
- 모든 마이그레이션은 down 스크립트(롤백) 동반.
- production 적용 전 백업 권장.

## 백업
- Free 플랜은 자동 백업이 제한적. 중요한 시점(스키마 변경 직전)에 수동 export 권장.

## 무료 플랜 한계
- DB 0.5 GB / Storage 1 GB / 월 50 MB egress 등 (정확한 수치는 시점에 따라 변동, 공식 문서 확인).
- 원본 이미지 자동 정리 정책 + 가벼운 압축으로 용량 관리.

## 점검 체크리스트
- [ ] 모든 테이블 RLS on
- [ ] Storage 정책 적용
- [ ] service role key 클라이언트 미노출
- [ ] 가입 시 기본 시드 트리거 동작
- [ ] Redirect URL 등록(로컬+프로덕션)
- [ ] 마이그레이션/롤백 SQL 보관
