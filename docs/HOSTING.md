# Hosting & going live

The whole website is the `site/` folder: plain HTML, CSS and JavaScript with no build step.
Anything that can serve static files can host it.

## 1. GitHub Pages (now)

1. Merge to `main`.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The workflow `.github/workflows/deploy-pages.yml` publishes `site/` on every push to `main`.
   The URL will be `https://<your-username>.github.io/<repo-name>/`.

> GitHub Pages is free for **public** repos. A private repo needs a paid GitHub plan to use Pages.
> If the repo stays private, use one of the hosts in step 3 instead (all free).

## 2. Switch on the shared family archive (Supabase, free)

In preview mode, videos are saved only in the browser that uploaded them. To let the whole family see the same videos:

1. Create a free project at <https://supabase.com>.
2. **SQL Editor** → paste `supabase/schema.sql` → **Run**. This creates the tables, a private `videos` bucket, and rules that only signed-in family members can read or write.
3. **Authentication → URL Configuration**: set *Site URL* to your live site URL.
4. **Authentication → Sign In / Providers**: keep Email enabled. To keep it family-only, turn off "Allow new users to sign up" and invite each family member from **Authentication → Users → Invite**.
5. **Project Settings → API**: copy the *Project URL* and *anon public* key into `site/assets/js/config.js`, and set `storage: 'supabase'`.

The anon key is safe to publish. Security comes from the row-level-security rules in `schema.sql`.

**Free-tier limits:** 1 GB of file storage in total and **50 MB per file**. A free project also pauses after a week with no activity; opening the dashboard wakes it. For longer videos, upload them to YouTube as **Unlisted** and use "Paste a link" in the upload window.
When the archive outgrows the free tier, the next step is Supabase Pro or Cloudflare R2. Only `site/assets/js/store/` would change.

## 3. Moving to another host later

Upload the **contents of `site/`** to any of these:

| Host | How |
|---|---|
| Netlify / Cloudflare Pages / Vercel (free) | Connect the repo and set the publish directory to `site`. No build command. |
| Traditional web hosting (cPanel, FTP) | Upload everything inside `site/` to `public_html/`. |
| Custom domain on GitHub Pages | Settings → Pages → Custom domain. |

Every link uses `#/` routes and relative paths, so the site works from a sub-folder and needs no server rewrite rules.
If the site is on Supabase, add the new URL in Supabase → Authentication → URL Configuration.
