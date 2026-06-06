
-- 1. Helper to check admin without recursive RLS
create or replace function public.is_admin(_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = _uid and is_admin = true and account_status = 'active'
  )
$$;

-- 2. Lock in super-owner row (idempotent)
update public.profiles
set is_admin = true,
    is_approved = true,
    role = 'super_admin',
    account_status = 'active'
where email = 'muhammadokasha216@gmail.com';

-- 3. Protect super owner from being demoted
create or replace function public.protect_super_owner()
returns trigger
language plpgsql
as $$
begin
  if old.email = 'muhammadokasha216@gmail.com' then
    new.is_admin := true;
    new.is_approved := true;
    new.role := 'super_admin';
    new.account_status := 'active';
    new.email := old.email;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_super_owner on public.profiles;
create trigger trg_protect_super_owner
  before update on public.profiles
  for each row execute function public.protect_super_owner();

-- Block delete of super owner
create or replace function public.protect_super_owner_delete()
returns trigger
language plpgsql
as $$
begin
  if old.email = 'muhammadokasha216@gmail.com' then
    raise exception 'Cannot delete super owner';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_protect_super_owner_delete on public.profiles;
create trigger trg_protect_super_owner_delete
  before delete on public.profiles
  for each row execute function public.protect_super_owner_delete();

-- 4. Admin RLS policies
drop policy if exists "admins_select_all" on public.profiles;
create policy "admins_select_all" on public.profiles
  for select to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists "admins_update_all" on public.profiles;
create policy "admins_update_all" on public.profiles
  for update to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
