
-- Pin search_path on the remaining mutable function
create or replace function public.sync_profile_flags()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.is_approved is distinct from old.is_approved then
    new.account_status := case when new.is_approved then 'active' else new.account_status end;
  end if;
  if new.account_status is distinct from old.account_status then
    new.is_approved := (new.account_status = 'active');
  end if;
  if new.is_admin is distinct from old.is_admin then
    new.role := case when new.is_admin then 'admin' else new.role end;
  end if;
  if new.role is distinct from old.role then
    new.is_admin := new.role in ('admin','super_admin');
  end if;
  return new;
end;
$$;

-- handle_new_user is a trigger function; no client should call it directly
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- is_admin is used inside RLS policies for `authenticated`; revoke from anon/public only
revoke all on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated;
