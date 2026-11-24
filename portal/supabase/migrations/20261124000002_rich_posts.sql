-- Rich posts: pictures in messages and class guides, and replies that quote an earlier reply.
-- Run this in the Supabase SQL Editor BEFORE merging the matching app change. Everything
-- here also works with the current app (new columns have defaults, and save_class() stays).

-- ---------------------------------------------------------------------------
-- 1. Picture lists. A picture is a file in the private "post-images" bucket, stored as
--    "<uploader's user id>/<random id>.<webp|jpg|png>". At most 4 per message, per class
--    summary and per homework. Pictures in a member's message must be their own uploads.
-- ---------------------------------------------------------------------------
create function public.valid_image_paths(p_paths text[], p_owner uuid) returns boolean
language sql immutable set search_path = ''
as $$
  select coalesce(cardinality(p_paths), 0) <= 4
     and not exists (
       select 1 from unnest(coalesce(p_paths, '{}'::text[])) as p(path)
        where p.path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg|png)$'
           or (p_owner is not null and split_part(p.path, '/', 1) <> p_owner::text));
$$;

alter table public.threads add column images text[] not null default '{}'
  constraint threads_images_valid check (public.valid_image_paths(images, author_id));
alter table public.posts add column images text[] not null default '{}'
  constraint posts_images_valid check (public.valid_image_paths(images, author_id));
alter table public.classes add column summary_images text[] not null default '{}'
  constraint classes_summary_images_valid check (public.valid_image_paths(summary_images, null));
alter table public.homework add column images text[] not null default '{}'
  constraint homework_images_valid check (public.valid_image_paths(images, null));

-- Members may set pictures when posting and editing (classes and homework: admins, as before).
grant insert (images) on public.threads to authenticated;
grant update (images) on public.threads to authenticated;
grant insert (images) on public.posts to authenticated;
grant update (images) on public.posts to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Replying to a particular reply. The quoted reply must be in the same discussion.
--    If it is deleted later, the link is cleared and the app says "Original message was deleted".
-- ---------------------------------------------------------------------------
alter table public.posts add column reply_to bigint references public.posts (id) on delete set null;
-- Stays true after the quoted reply is deleted, so the app can say so.
alter table public.posts add column quoted boolean not null default false;
create index posts_reply_to_idx on public.posts (reply_to);
grant insert (reply_to, quoted) on public.posts to authenticated;

-- A reply may be pictures only (like a photo without a caption on WhatsApp); otherwise it needs text.
alter table public.posts drop constraint posts_body_md_check;
alter table public.posts add constraint posts_body_md_check check (
  char_length(body_md) <= 5000
  and (char_length(btrim(body_md)) >= 1 or cardinality(images) >= 1));

-- Checked by a function, because a rule on posts can't query posts itself.
create function public.post_in_thread(p_post bigint, p_thread bigint) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.posts p where p.id = p_post and p.thread_id = p_thread);
$$;
revoke execute on function public.post_in_thread(bigint, bigint) from public, anon;
grant execute on function public.post_in_thread(bigint, bigint) to authenticated;

drop policy "members reply" on public.posts;
create policy "members reply" on public.posts for insert to authenticated
  with check (public.is_active_member() and author_id = (select auth.uid())
    and exists (select 1 from public.threads t where t.id = thread_id)
    and (reply_to is null or public.post_in_thread(reply_to, thread_id)));

-- ---------------------------------------------------------------------------
-- 3. The private picture bucket. Members can see pictures; each member uploads only into
--    their own folder; the uploader or an admin can delete. Pictures are shown through
--    short-lived signed links, never public ones.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', false, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "members read post images" on storage.objects for select to authenticated
  using (bucket_id = 'post-images' and public.is_active_member());
create policy "members upload own post images" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-images' and public.is_active_member()
    and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "uploaders and admins delete post images" on storage.objects for delete to authenticated
  using (bucket_id = 'post-images' and (owner_id = (select auth.uid())::text or public.is_admin()));

-- ---------------------------------------------------------------------------
-- 4. Saving a class with pictures, all-or-nothing (save_class() without pictures stays for
--    the current app and can be dropped in a later cleanup).
-- ---------------------------------------------------------------------------
create function public.save_class_with_images(
  p_id bigint,
  p_number int,
  p_class_date date,
  p_title text,
  p_summary_md text,
  p_summary_images text[],
  p_status text,
  p_materials jsonb,
  p_homework jsonb
) returns bigint
language plpgsql security invoker set search_path = ''
as $$
declare
  v_id bigint;
  v_keep bigint[];
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN: only admins can save classes' using errcode = '42501';
  end if;

  if p_id is null then
    insert into public.classes (number, class_date, title, summary_md, summary_images, status)
    values (p_number, p_class_date, p_title, p_summary_md, coalesce(p_summary_images, '{}'), p_status)
    returning id into v_id;
  else
    update public.classes
       set number = p_number, class_date = p_class_date, title = p_title, summary_md = p_summary_md,
           summary_images = coalesce(p_summary_images, '{}'), status = p_status
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'CLASS_GONE: that class no longer exists' using errcode = 'P0002';
    end if;
  end if;

  delete from public.class_materials where class_id = v_id;
  insert into public.class_materials (class_id, label, url, position)
  select v_id, m ->> 'label', m ->> 'url', (m ->> 'position')::int
    from jsonb_array_elements(coalesce(p_materials, '[]'::jsonb)) as m;

  select coalesce(array_agg((h ->> 'id')::bigint), '{}')
    into v_keep
    from jsonb_array_elements(coalesce(p_homework, '[]'::jsonb)) as h
   where h ->> 'id' is not null;

  delete from public.homework where class_id = v_id and not (id = any (v_keep));

  update public.homework as hw
     set title = h ->> 'title',
         instructions_md = coalesce(h ->> 'instructions_md', ''),
         images = coalesce(array(select jsonb_array_elements_text(h -> 'images')), '{}'),
         deadline = (h ->> 'deadline')::timestamptz,
         handin_expected = coalesce((h ->> 'handin_expected')::boolean, false),
         position = (h ->> 'position')::int
    from jsonb_array_elements(coalesce(p_homework, '[]'::jsonb)) as h
   where h ->> 'id' is not null and hw.id = (h ->> 'id')::bigint and hw.class_id = v_id;

  insert into public.homework (class_id, title, instructions_md, images, deadline, handin_expected, position)
  select v_id, h ->> 'title', coalesce(h ->> 'instructions_md', ''),
         coalesce(array(select jsonb_array_elements_text(h -> 'images')), '{}'),
         (h ->> 'deadline')::timestamptz, coalesce((h ->> 'handin_expected')::boolean, false), (h ->> 'position')::int
    from jsonb_array_elements(coalesce(p_homework, '[]'::jsonb)) as h
   where h ->> 'id' is null;

  return v_id;
end;
$$;
revoke execute on function public.save_class_with_images(bigint, int, date, text, text, text[], text, jsonb, jsonb) from public, anon;
grant execute on function public.save_class_with_images(bigint, int, date, text, text, text[], text, jsonb, jsonb) to authenticated;
