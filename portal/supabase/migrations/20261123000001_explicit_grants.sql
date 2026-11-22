-- Newer Supabase projects no longer grant table access to the built-in roles
-- automatically. Grant exactly what the portal needs, explicitly:
-- the server's secret key (service_role) uses every table; signed-in members
-- (authenticated) get the column-level grants from the schema migration, plus
-- the helper functions the security rules call. Row-level security still
-- decides what each member can see or change.
grant usage on schema public to authenticated, service_role;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on function public.is_active_member(), public.is_admin() to authenticated, service_role;
