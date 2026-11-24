-- Portal improvements deferred from the final code review.
-- Run this in the Supabase SQL Editor BEFORE merging the matching app change:
-- the new app saves classes through save_class(), and everything here also
-- works with the current app.

-- ---------------------------------------------------------------------------
-- 1. Saving a class is all-or-nothing. The class, its materials and its
--    homework are written in one transaction, so a failure part-way (say a bad
--    material link) leaves the class exactly as it was. Runs with the caller's
--    rights, so the usual admin-only rules still apply.
-- ---------------------------------------------------------------------------
create function public.save_class(
  p_id bigint,
  p_number int,
  p_class_date date,
  p_title text,
  p_summary_md text,
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
    insert into public.classes (number, class_date, title, summary_md, status)
    values (p_number, p_class_date, p_title, p_summary_md, p_status)
    returning id into v_id;
  else
    update public.classes
       set number = p_number, class_date = p_class_date, title = p_title, summary_md = p_summary_md, status = p_status
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'CLASS_GONE: that class no longer exists' using errcode = 'P0002';
    end if;
  end if;

  -- Materials are replaced wholesale.
  delete from public.class_materials where class_id = v_id;
  insert into public.class_materials (class_id, label, url, position)
  select v_id, m ->> 'label', m ->> 'url', (m ->> 'position')::int
    from jsonb_array_elements(coalesce(p_materials, '[]'::jsonb)) as m;

  -- Homework is updated in place so existing hand-ins survive edits.
  select coalesce(array_agg((h ->> 'id')::bigint), '{}')
    into v_keep
    from jsonb_array_elements(coalesce(p_homework, '[]'::jsonb)) as h
   where h ->> 'id' is not null;

  delete from public.homework where class_id = v_id and not (id = any (v_keep));

  update public.homework as hw
     set title = h ->> 'title',
         instructions_md = coalesce(h ->> 'instructions_md', ''),
         deadline = (h ->> 'deadline')::timestamptz,
         handin_expected = coalesce((h ->> 'handin_expected')::boolean, false),
         position = (h ->> 'position')::int
    from jsonb_array_elements(coalesce(p_homework, '[]'::jsonb)) as h
   where h ->> 'id' is not null and hw.id = (h ->> 'id')::bigint and hw.class_id = v_id;

  insert into public.homework (class_id, title, instructions_md, deadline, handin_expected, position)
  select v_id, h ->> 'title', coalesce(h ->> 'instructions_md', ''), (h ->> 'deadline')::timestamptz,
         coalesce((h ->> 'handin_expected')::boolean, false), (h ->> 'position')::int
    from jsonb_array_elements(coalesce(p_homework, '[]'::jsonb)) as h
   where h ->> 'id' is null;

  return v_id;
end;
$$;
revoke execute on function public.save_class(bigint, int, date, text, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.save_class(bigint, int, date, text, text, text, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. A class's question thread is hidden from students while the class is a
--    draft (admins still see it), and nobody can reply to a thread they can't
--    see. General threads are unaffected.
-- ---------------------------------------------------------------------------
drop policy "members read threads" on public.threads;
create policy "members read threads" on public.threads for select to authenticated
  using (public.is_active_member() and (
    not is_class_thread
    or public.is_admin()
    or exists (select 1 from public.classes c where c.id = class_id and c.status = 'published')));

drop policy "members read posts" on public.posts;
create policy "members read posts" on public.posts for select to authenticated
  using (public.is_active_member() and exists (select 1 from public.threads t where t.id = thread_id));

drop policy "members reply" on public.posts;
create policy "members reply" on public.posts for insert to authenticated
  with check (public.is_active_member() and author_id = (select auth.uid())
    and exists (select 1 from public.threads t where t.id = thread_id));

-- ---------------------------------------------------------------------------
-- 3. Renumbering or renaming a class updates its question thread's title and
--    opening line, as long as they still read as the portal wrote them. The
--    change isn't marked "edited", because nobody edited the post.
-- ---------------------------------------------------------------------------
create or replace function public.mark_edited() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_setting('portal.system_edit', true) = 'on' then
    return new;
  end if;
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

create function public.rename_class_thread() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.number is distinct from old.number or new.title is distinct from old.title then
    perform set_config('portal.system_edit', 'on', true);
    update public.threads
       set title = case when title = 'Questions about Class ' || old.number
                        then 'Questions about Class ' || new.number else title end,
           body_md = case when body_md = 'Ask anything about Class ' || old.number || ': ' || old.title || '. Classmates and admins will reply here.'
                          then 'Ask anything about Class ' || new.number || ': ' || new.title || '. Classmates and admins will reply here.'
                          else body_md end
     where class_id = new.id and is_class_thread;
    perform set_config('portal.system_edit', 'off', true);
  end if;
  return new;
end;
$$;
create trigger classes_rename_thread after update of number, title on public.classes
  for each row execute function public.rename_class_thread();
