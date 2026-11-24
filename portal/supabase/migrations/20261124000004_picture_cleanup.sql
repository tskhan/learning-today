-- Picture storage tidy-up from the security audit. Run this in the Supabase SQL Editor BEFORE
-- merging the matching app change. Everything here also works with the current app (it shows
-- pictures through signed links made on the server, so members never read the files directly).

-- ---------------------------------------------------------------------------
-- 1. Members can read (and so list) only the files in their own folder; admins, all of them.
--    Everyone's pictures still show in the portal: the server makes the links for them.
-- ---------------------------------------------------------------------------
drop policy "members read post images" on storage.objects;
create policy "members read own post images" on storage.objects for select to authenticated
  using (bucket_id = 'post-images' and public.is_active_member()
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));

-- ---------------------------------------------------------------------------
-- 2. A removed member can no longer delete pictures they uploaded earlier.
-- ---------------------------------------------------------------------------
drop policy "uploaders and admins delete post images" on storage.objects;
create policy "uploaders and admins delete post images" on storage.objects for delete to authenticated
  using (bucket_id = 'post-images' and public.is_active_member()
    and (owner_id = (select auth.uid())::text or public.is_admin()));

-- ---------------------------------------------------------------------------
-- 3. Pictures nothing uses: uploaded at least p_older_than ago and not in any discussion,
--    reply, class or homework (for example, added to a message that was never sent). The
--    server deletes them through the storage API. Only the server's secret key can call this.
-- ---------------------------------------------------------------------------
create function public.unused_images(p_older_than interval default interval '2 days', p_limit int default 100)
returns setof text
language sql stable set search_path = ''
as $$
  select o.name
    from storage.objects o
   where o.bucket_id = 'post-images'
     and o.created_at < now() - p_older_than
     and not exists (select 1 from public.threads t where o.name = any (t.images))
     and not exists (select 1 from public.posts p where o.name = any (p.images))
     and not exists (select 1 from public.classes c where o.name = any (c.summary_images))
     and not exists (select 1 from public.homework h where o.name = any (h.images))
   order by o.created_at
   limit p_limit;
$$;
revoke execute on function public.unused_images(interval, int) from public, anon, authenticated;
grant execute on function public.unused_images(interval, int) to service_role;
