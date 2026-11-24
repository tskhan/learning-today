# Rich posts: editor, pictures and quoted replies (24 Nov 2026)

Agreed with the owner: a formatting-as-you-type editor (option A), up to 4 pictures per message from any member, and the same editor and pictures in the admin class-guide form.

## What members get
- **Editor** (Tiptap 3.33, pinned): toolbar for bold, italic, underline, strikethrough, bullet and numbered lists, link, quote and code. Keyboard shortcuts work. Content is **saved as Markdown** (`@tiptap/markdown`), so existing posts keep working and the server still renders and sanitises every message (`lib/markdown.ts`; `<u>` is allowed for underline).
- **Pictures as attachments**, shown under the message text like WhatsApp: paste (Ctrl+V), drag and drop, or 📎. Shrunk in the browser to at most 1600 px (WebP, JPEG where WebP can't be encoded), which also drops hidden metadata such as location. Up to 4 per message, 1.5 MB each after shrinking. Tapping opens the full picture.
- **Reply to a particular message:** a Reply link on each post opens the reply box quoting it (`?reply=ID#reply`); the reply shows a quote box (author and first line, or "Photo") that jumps to the original. If the original is deleted it says so.
- **Class guides:** the admin form's "What was discussed" and each homework's instructions use the same editor, each with its own pictures.

## Data (migration `20261124000002_rich_posts.sql`, run BEFORE merging; works with the current app)
- `threads.images`, `posts.images`, `classes.summary_images`, `homework.images`: `text[]` of storage paths, at most 4, each `<user uuid>/<uuid>.<webp|jpg|png>`; for threads and posts every path must be in the author's own folder.
- `posts.reply_to` → `posts(id)`, `on delete set null`; must be in the same thread.
- Private storage bucket `post-images` (image types only, 2 MB cap): members read; members upload only into their own folder; owners and admins delete.
- `save_class_with_images()`: like `save_class()` plus pictures (the old function stays until the next cleanup, so the old app keeps working during deploy).
- Server action body limit raised to 2 MB (`next.config.ts`).

## Display and clean-up
- Pictures are shown through signed links (1 hour), created on the server for members only.
- Deleting a message, a discussion or a class, or removing a picture while editing, deletes the files too. Pictures uploaded for a message that is never sent stay as orphans (small; can be swept later).

## Tests
- Unit: path validation, excerpts, underline and that Markdown images stay stripped.
- Database: storage rules, image columns, reply_to rules, `save_class_with_images()`.
- Browser: format and post, attach a picture and see it, quote a reply, delete removes files, class guide with pictures.
