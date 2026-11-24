-- New-class notifications: an email to members when a class guide is first published, and a
-- "New" badge in the portal. Run this in the Supabase SQL Editor BEFORE merging the matching app
-- change. Everything here also works with the current app.

-- ---------------------------------------------------------------------------
-- 1. When a class was first published (for the "New" badge), set by the database itself.
--    Classes published before this change are left without one, so none of them shows as new.
-- ---------------------------------------------------------------------------
alter table public.classes add column published_at timestamptz;

create function public.stamp_published_at() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;
create trigger classes_stamp_published before insert or update of status on public.classes
  for each row execute function public.stamp_published_at();

-- ---------------------------------------------------------------------------
-- 2. When members were emailed about a class. Set once, by the server, when the email goes out,
--    so a class is never announced twice. Existing classes count as already announced.
--    (Only admins can write classes at all, so no extra rule is needed for this column.)
-- ---------------------------------------------------------------------------
alter table public.classes add column notified_at timestamptz;
update public.classes set notified_at = now() where status = 'published';

-- ---------------------------------------------------------------------------
-- 3. Each member can turn the emails off in their profile (on by default).
-- ---------------------------------------------------------------------------
alter table public.profiles add column email_new_classes boolean not null default true;
grant update (email_new_classes) on public.profiles to authenticated;
