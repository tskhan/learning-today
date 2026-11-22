-- Batch 91 Portal: tables, security rules (row-level security) and triggers.
-- Every rule the app relies on is enforced here too, so a direct API call
-- with the public key can never do more than the app allows.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 80),
  role text not null default 'student' check (role in ('student', 'admin')),
  status text not null default 'active' check (status in ('active', 'removed')),
  joined_at timestamptz not null default now()
);

create table public.classes (
  id bigint generated always as identity primary key,
  number int not null unique check (number > 0),
  class_date date not null,
  title text not null check (char_length(btrim(title)) between 1 and 150),
  summary_md text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.class_materials (
  id bigint generated always as identity primary key,
  class_id bigint not null references public.classes (id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 150),
  url text not null check (url ~* '^https?://'),
  position int not null default 0
);
create index class_materials_class_idx on public.class_materials (class_id);

create table public.homework (
  id bigint generated always as identity primary key,
  class_id bigint not null references public.classes (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 150),
  instructions_md text not null default '',
  deadline timestamptz,
  handin_expected boolean not null default false,
  position int not null default 0
);
create index homework_class_idx on public.homework (class_id);

create table public.class_reviews (
  user_id uuid not null references public.profiles (id) on delete cascade,
  class_id bigint not null references public.classes (id) on delete cascade,
  reviewed_at timestamptz not null default now(),
  primary key (user_id, class_id)
);

create table public.homework_status (
  user_id uuid not null references public.profiles (id) on delete cascade,
  homework_id bigint not null references public.homework (id) on delete cascade,
  done_at timestamptz not null default now(),
  handin_url text check (handin_url ~* '^https?://'),
  note text check (note is null or char_length(note) <= 500),
  primary key (user_id, homework_id)
);
create index homework_status_homework_idx on public.homework_status (homework_id);

create table public.threads (
  id bigint generated always as identity primary key,
  author_id uuid default auth.uid() references public.profiles (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 150),
  body_md text not null check (char_length(btrim(body_md)) between 1 and 5000),
  class_id bigint references public.classes (id) on delete set null,
  is_class_thread boolean not null default false,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  edited_at timestamptz
);
create unique index threads_one_class_thread on public.threads (class_id) where is_class_thread;
create index threads_activity_idx on public.threads (pinned desc, last_activity_at desc);

create table public.posts (
  id bigint generated always as identity primary key,
  thread_id bigint not null references public.threads (id) on delete cascade,
  author_id uuid default auth.uid() references public.profiles (id) on delete set null,
  body_md text not null check (char_length(btrim(body_md)) between 1 and 5000),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index posts_thread_idx on public.posts (thread_id, created_at);
create index posts_author_recent_idx on public.posts (author_id, created_at);
create index threads_author_recent_idx on public.threads (author_id, created_at);

create table public.settings (
  id int primary key default 1 check (id = 1),
  join_code text not null check (char_length(join_code) between 4 and 64)
);

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------
create function public.is_active_member() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status = 'active'
  );
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status = 'active' and p.role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Privileges: start from nothing, then grant exactly what the app needs.
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.classes, public.class_materials, public.homework,
  public.class_reviews, public.homework_status, public.threads, public.posts, public.settings
  from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

grant select, insert, update, delete on public.classes, public.class_materials, public.homework to authenticated;

grant select, insert, delete on public.class_reviews to authenticated;
grant select, insert, update, delete on public.homework_status to authenticated;

grant select, delete on public.threads to authenticated;
grant insert (title, body_md, class_id) on public.threads to authenticated;
grant update (title, body_md) on public.threads to authenticated;

grant select, delete on public.posts to authenticated;
grant insert (thread_id, body_md) on public.posts to authenticated;
grant update (body_md) on public.posts to authenticated;
-- settings: no grants to anon or authenticated; the server reads it with the secret key.

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_materials enable row level security;
alter table public.homework enable row level security;
alter table public.class_reviews enable row level security;
alter table public.homework_status enable row level security;
alter table public.threads enable row level security;
alter table public.posts enable row level security;
alter table public.settings enable row level security;

-- profiles
create policy "members read profiles" on public.profiles for select to authenticated
  using (public.is_active_member());
create policy "members update own profile" on public.profiles for update to authenticated
  using (public.is_active_member() and id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- classes
create policy "members read published classes" on public.classes for select to authenticated
  using (public.is_active_member() and (status = 'published' or public.is_admin()));
create policy "admins insert classes" on public.classes for insert to authenticated
  with check (public.is_admin());
create policy "admins update classes" on public.classes for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admins delete classes" on public.classes for delete to authenticated
  using (public.is_admin());

-- class materials and homework follow their class
create policy "members read materials" on public.class_materials for select to authenticated
  using (public.is_active_member() and exists (
    select 1 from public.classes c where c.id = class_id and (c.status = 'published' or public.is_admin())));
create policy "admins write materials" on public.class_materials for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "members read homework" on public.homework for select to authenticated
  using (public.is_active_member() and exists (
    select 1 from public.classes c where c.id = class_id and (c.status = 'published' or public.is_admin())));
create policy "admins write homework" on public.homework for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- class reviews: private to the student (and admins)
create policy "read own reviews" on public.class_reviews for select to authenticated
  using (public.is_active_member() and (user_id = (select auth.uid()) or public.is_admin()));
create policy "add own review" on public.class_reviews for insert to authenticated
  with check (public.is_active_member() and user_id = (select auth.uid()) and exists (
    select 1 from public.classes c where c.id = class_id and c.status = 'published'));
create policy "remove own review" on public.class_reviews for delete to authenticated
  using (public.is_active_member() and user_id = (select auth.uid()));

-- homework status: everyone in the batch can see hand-ins; each student writes their own
create policy "members read homework status" on public.homework_status for select to authenticated
  using (public.is_active_member());
create policy "add own homework status" on public.homework_status for insert to authenticated
  with check (public.is_active_member() and user_id = (select auth.uid()));
create policy "update own homework status" on public.homework_status for update to authenticated
  using (public.is_active_member() and user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "remove own homework status" on public.homework_status for delete to authenticated
  using (public.is_active_member() and user_id = (select auth.uid()));

-- threads
create policy "members read threads" on public.threads for select to authenticated
  using (public.is_active_member());
create policy "members start threads" on public.threads for insert to authenticated
  with check (public.is_active_member() and author_id = (select auth.uid()));
create policy "authors edit own threads" on public.threads for update to authenticated
  using (public.is_active_member() and author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));
create policy "authors or admins delete threads" on public.threads for delete to authenticated
  using (public.is_active_member() and (
    (author_id = (select auth.uid()) and not is_class_thread) or public.is_admin()));

-- posts
create policy "members read posts" on public.posts for select to authenticated
  using (public.is_active_member());
create policy "members reply" on public.posts for insert to authenticated
  with check (public.is_active_member() and author_id = (select auth.uid()));
create policy "authors edit own posts" on public.posts for update to authenticated
  using (public.is_active_member() and author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));
create policy "authors or admins delete posts" on public.posts for delete to authenticated
  using (public.is_active_member() and (author_id = (select auth.uid()) or public.is_admin()));

-- settings: RLS on and no policies, so only the secret key can read or write it.

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- A new account gets a profile.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), 'Member'));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- At most 10 threads plus replies per member per 10 minutes.
create function public.enforce_post_rate_limit() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  recent int;
begin
  if tg_table_name = 'threads' then
    -- class threads are opened by the system, not typed by a member
    if (to_jsonb(new) ->> 'is_class_thread')::boolean then
      return new;
    end if;
  end if;
  if new.author_id is null then
    return new;
  end if;
  select (select count(*) from public.threads t
            where t.author_id = new.author_id and not t.is_class_thread
              and t.created_at > now() - interval '10 minutes')
       + (select count(*) from public.posts p
            where p.author_id = new.author_id and p.created_at > now() - interval '10 minutes')
    into recent;
  if recent >= 10 then
    raise exception 'RATE_LIMIT: too many posts in 10 minutes' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger threads_rate_limit before insert on public.threads
  for each row execute function public.enforce_post_rate_limit();
create trigger posts_rate_limit before insert on public.posts
  for each row execute function public.enforce_post_rate_limit();

-- Homework that expects a hand-in counts as done only with a link.
create function public.enforce_handin() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.handin_url is null and exists (
    select 1 from public.homework h where h.id = new.homework_id and h.handin_expected
  ) then
    raise exception 'HANDIN_REQUIRED: this homework needs a link' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger homework_status_handin before insert or update on public.homework_status
  for each row execute function public.enforce_handin();

-- A reply bumps its thread to the top of the list.
create function public.bump_thread_activity() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.threads set last_activity_at = new.created_at where id = new.thread_id;
  return new;
end;
$$;
create trigger posts_bump_thread after insert on public.posts
  for each row execute function public.bump_thread_activity();

-- Edits are marked; classes keep an updated time.
create function public.mark_edited() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_table_name = 'threads' then
    if new.title is distinct from old.title or new.body_md is distinct from old.body_md then
      new.edited_at := now();
    end if;
  elsif new.body_md is distinct from old.body_md then
    new.edited_at := now();
  end if;
  return new;
end;
$$;
create trigger threads_mark_edited before update on public.threads
  for each row execute function public.mark_edited();
create trigger posts_mark_edited before update on public.posts
  for each row execute function public.mark_edited();

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger classes_touch before update on public.classes
  for each row execute function public.touch_updated_at();

-- Publishing a class opens its "Questions about Class N" thread (once).
create function public.open_class_thread() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'published' and not exists (
    select 1 from public.threads t where t.class_id = new.id and t.is_class_thread
  ) then
    insert into public.threads (author_id, title, body_md, class_id, is_class_thread)
    values (
      (select auth.uid()),
      'Questions about Class ' || new.number,
      'Ask anything about Class ' || new.number || ': ' || new.title || '. Classmates and admins will reply here.',
      new.id,
      true
    );
  end if;
  return new;
end;
$$;
create trigger classes_open_thread after insert or update of status on public.classes
  for each row execute function public.open_class_thread();
