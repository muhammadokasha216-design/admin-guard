
alter function public.protect_super_owner() set search_path = public;
alter function public.protect_super_owner_delete() set search_path = public;

revoke execute on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated, service_role;
