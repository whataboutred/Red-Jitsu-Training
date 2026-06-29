-- Tamper-proof per-user daily cap for paid AI insight generations.
--
-- The /api/insights route runs as the calling user (anon key + user token), so
-- any rate-limit state stored in a user-writable table can be reset by that
-- user. We therefore keep the counter in a table with RLS enabled and NO client
-- policies — only the SECURITY DEFINER function below (owned by the table owner,
-- which bypasses RLS) can read or write it. Clients cannot touch it directly.

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  count int not null default 0,
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;
-- Intentionally NO policies: deny all direct client access. Writes happen only
-- through claim_ai_generation() (security definer).

-- Atomically claim one generation for the current user/day. Returns true if the
-- claim is within the daily limit, false otherwise (and does not consume quota
-- when denied). The upsert row-locks (user_id, day) so concurrent claims
-- serialize and cannot race past the limit.
create or replace function public.claim_ai_generation(p_limit int default 20)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_count int;
begin
  if uid is null then
    return false;
  end if;

  insert into public.ai_usage (user_id, day, count)
  values (uid, current_date, 1)
  on conflict (user_id, day)
  do update set count = public.ai_usage.count + 1
  returning count into new_count;

  if new_count > p_limit then
    -- Over the cap: undo this claim and deny.
    update public.ai_usage
      set count = count - 1
      where user_id = uid and day = current_date;
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.claim_ai_generation(int) from public, anon;
grant execute on function public.claim_ai_generation(int) to authenticated;

-- Close the cooldown-tamper vector: users have no feature that deletes an
-- insight row, and the route only ever upserts (insert/update). Removing the
-- DELETE policy stops a user from deleting their cached row to dodge throttling.
drop policy if exists ai_insights_delete_own on public.ai_insights;
