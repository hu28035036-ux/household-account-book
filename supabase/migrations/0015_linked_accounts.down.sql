-- 0015 down: linked_accounts + linked_account_syncs 폐기.
drop policy if exists "linked_syncs_select_own" on public.linked_account_syncs;
drop policy if exists "linked_syncs_insert_own" on public.linked_account_syncs;
drop policy if exists "linked_syncs_update_own" on public.linked_account_syncs;
drop index if exists public.idx_linked_syncs_account;
drop table if exists public.linked_account_syncs cascade;

drop policy if exists "linked_accounts_select_own" on public.linked_accounts;
drop policy if exists "linked_accounts_insert_own" on public.linked_accounts;
drop policy if exists "linked_accounts_update_own" on public.linked_accounts;
drop policy if exists "linked_accounts_delete_own" on public.linked_accounts;
drop trigger if exists trg_linked_accounts_updated_at on public.linked_accounts;
drop index if exists public.idx_linked_accounts_user;
drop index if exists public.idx_linked_accounts_household;
drop table if exists public.linked_accounts cascade;

drop index if exists public.idx_candidates_linked_account;
alter table public.transaction_candidates drop column if exists linked_account_id;
