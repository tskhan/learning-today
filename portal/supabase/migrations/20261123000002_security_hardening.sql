-- Security hardening from the 23 November 2026 audit.
-- Run this in the Supabase SQL Editor AFTER the matching app change is live on Vercel.
-- (The new app works with or without it; the old app does not work with it: new
-- sign-ups would stay removed and saving a hand-in would fail.)

-- ---------------------------------------------------------------------------
-- 1. Wrong join codes are counted per network address, so the code can't be
--    guessed by trying thousands of codes. Only the server (secret key) uses
--    this table; nobody else can read or write it.
-- ---------------------------------------------------------------------------
create table public.signup_attempts (
  id bigint generated always as identity primary key,
  ip text not null,
  attempted_at timestamptz not null default now()
);
create index signup_attempts_ip_idx on public.signup_attempts (ip, attempted_at);
alter table public.signup_attempts enable row level security;
revoke all on public.signup_attempts from anon, authenticated;
grant all on public.signup_attempts to service_role;

-- ---------------------------------------------------------------------------
-- 2. Backstop for the join code. Every new account starts as removed, so it
--    can read nothing. The portal's join form, which checks the code and uses
--    the secret key, switches the account to active straight after creating
--    it. An account created any other way (for example if Supabase's own
--    sign-ups were ever switched on) stays removed until an admin restores it.
-- ---------------------------------------------------------------------------
alter table public.profiles alter column status set default 'removed';

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, status)
  values (new.id, coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), 'Member'), 'removed');
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Hand-in notes are private to their author. Members can still see who
--    handed in what (the link), but not each other's notes. The app reads a
--    member's own notes on the server, and saves notes with a plain update or
--    insert (an upsert would need to read the note column).
-- ---------------------------------------------------------------------------
revoke select on public.homework_status from authenticated;
grant select (user_id, homework_id, done_at, handin_url) on public.homework_status to authenticated;
