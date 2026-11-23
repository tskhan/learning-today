# Setting up the Batch 91 Portal

This guide takes you from the free accounts you already have (Supabase, Resend, Vercel) to a working portal at **https://portal.learning-today.com**. Do the steps in order. It takes about 45 minutes, most of it waiting for DNS.

You will copy a few keys between websites. **Never paste a key into a chat, an email or GitHub.** Only paste it into the settings pages named below.

---

## 1. Supabase: the database and logins

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and click **New project**.
   - Name: `learning-today-portal`
   - Database password: click **Generate a password** and save it in your password manager. You won't need it for this guide.
   - Region: **South Asia (Mumbai)**, the closest to Pakistan.
   - Click **Create new project** and wait a minute or two.
2. **Create the tables.** In the left menu open **SQL Editor** → **New query**.
   - Open [`portal/supabase/migrations/20261122000001_schema.sql`](supabase/migrations/20261122000001_schema.sql) on GitHub, click **Raw**, copy everything, paste it into the editor and click **Run**. It should say *Success. No rows returned*.
   - Make another **New query** and do the same with [`20261122000002_seed.sql`](supabase/migrations/20261122000002_seed.sql). This adds Classes 1–6 and the starting join code.
   - Make a third **New query** and do the same with [`20261123000001_explicit_grants.sql`](supabase/migrations/20261123000001_explicit_grants.sql). This lets the portal's server use the tables (newer Supabase projects don't allow that automatically).
3. **Turn off open sign-ups.** Go to **Authentication → Sign In / Providers**.
   - Turn **off** "Allow new users to sign up". (People join through the portal's own form, which checks the join code.)
   - Under **Email**, turn **off** "Confirm email". Click **Save**.
4. **Tell Supabase where the portal lives.** Go to **Authentication → URL Configuration**.
   - Site URL: `https://portal.learning-today.com`
   - Redirect URLs → **Add URL**: `https://portal.learning-today.com/auth/confirm`
5. **The password-reset email.** Go to **Authentication → Emails → Templates → Reset password**.
   - Subject: `Reset your Batch 91 Portal password`
   - Body: copy the contents of [`supabase/templates/recovery.html`](supabase/templates/recovery.html) and paste it over the existing body. Click **Save**.
6. **Raise the sign-in limit.** All logins reach Supabase from the portal's server, so they share one limit. Go to **Authentication → Rate Limits** and set "sign-ups and sign-ins" to **300** per 5 minutes, so a whole class logging in at once is never blocked. Click **Save**.
7. **Copy your keys** (you'll need them in step 3). Go to **Project Settings → API Keys** and note down:
   - the **Project URL** (Project Settings → Data API, looks like `https://abcd.supabase.co`)
   - the **Publishable key** (starts with `sb_publishable_`)
   - the **Secret key** (starts with `sb_secret_`; click the eye icon to reveal it). This one is powerful: keep it private.

## 2. Resend: the password-reset emails

1. In [resend.com](https://resend.com) open **Domains → Add domain**, type `learning-today.com` and pick the region closest to you.
2. Resend shows a few DNS records: a **TXT** record named `resend._domainkey`, and two **CNAME** records named `rsend` and `send` (older accounts may see TXT and MX instead). Try Resend's **Auto configure** button first. If it can't reach your DNS provider, add each record by hand where you manage `learning-today.com`'s DNS (GoDaddy: My Products → DNS → Add New Record). Copy the **Name** and **Value** exactly. Type only the short name (for example `send`), because GoDaddy adds `.learning-today.com` itself.
3. Back in Resend, click **Verify DNS records**. It can take from a few minutes to a few hours. Wait until the domain shows **Verified**.
4. Open **API Keys → Create API key**. Name it `supabase-smtp`, permission **Sending access**, domain `learning-today.com`. Copy the key (starts with `re_`). Resend shows it only once.
5. Back in **Supabase → Authentication → Emails → SMTP Settings**, turn on **Enable custom SMTP** and fill in:
   - Sender email: `no-reply@learning-today.com`
   - Sender name: `Batch 91 Portal`
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: the Resend key from step 4
   - Click **Save**.

## 3. Vercel: hosting the portal

1. In [vercel.com/new](https://vercel.com/new), click **Import** next to the GitHub repository `tskhan/learning-today`. If you don't see it, click **Adjust GitHub App Permissions** and allow that repository.
2. On the configure screen:
   - **Root Directory:** click **Edit** and choose `portal`.
   - Framework preset: **Next.js** (Vercel picks it automatically).
   - Open **Environment Variables** and add these four:

     | Name | Value |
     |---|---|
     | `NEXT_PUBLIC_SUPABASE_URL` | your Supabase Project URL |
     | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | your `sb_publishable_…` key |
     | `SUPABASE_SECRET_KEY` | your `sb_secret_…` key |
     | `NEXT_PUBLIC_SITE_URL` | `https://portal.learning-today.com` |

3. Click **Deploy** and wait for the confetti. Vercel gives you a temporary address ending in `.vercel.app`.
4. Under **Settings → Git**, check that the **Production Branch** is `main`. From now on, every change merged into `main` updates the portal automatically.

## 4. The address portal.learning-today.com

1. In Vercel open your project → **Settings → Domains** → **Add**, type `portal.learning-today.com` and click **Add**.
2. Vercel shows one **CNAME** record, usually Name `portal` and Value `cname.vercel-dns.com` (use exactly what Vercel shows). Add it at your DNS provider.
3. Wait until Vercel shows **Valid Configuration** (usually a few minutes). Vercel sets up HTTPS for you.

## 5. Make yourself the admin

1. Open https://portal.learning-today.com/signup and sign up with your own name and email, using the join code `batch91-change-me`.
2. In **Supabase → Table Editor → profiles**, find your row, double-click the **role** cell, change `student` to `admin` and press Enter.
3. Reload the portal. You'll now see **Admin** in the menu.
4. **Change the join code straight away:** Admin → Settings. The starting code is visible in the project's public code, so pick a new one and post it in the Batch 91 WhatsApp group.

## 6. Check it works

- Log out, click **Forgot password?** and make sure the email arrives (check spam the first time).
- Open a class guide on your phone.
- Ask one classmate to sign up and post a test question.
- Then merge the branch so the **Sign-in** link appears in the learning-today.com menu.

## Good to know

- **Free projects sleep.** Supabase pauses a free project after 7 days with no visits. If the portal stops loading after a quiet week, open your Supabase dashboard and click **Restore project**. Weekly classes normally keep it awake.
- **Adding a class:** after each class, go to Admin → Classes → New class, fill in what was discussed, the material and any homework, and set it to Published.
- **Someone forgot their password and the email didn't arrive:** Admin → Members → **Reset link** next to their name, then send them the link on WhatsApp. It works once.
- **Another admin:** Admin → Members → **Make admin**.
- **"Too many log-ins right now":** everyone's log-ins share the limit from step 1.6. If students see this message, wait 5 minutes, or raise the limit in Supabase → Authentication → Rate Limits.
