# LOVERS GARAGE — Public Website

This version is the public/shared website build. It uses Supabase for accounts, database data, and media storage, so different visitors see the same uploads and accounts.

## IMPORTANT: Supabase account setup

1. Create a Supabase project.
2. Go to **Authentication → Providers → Email**.
3. Make sure **Email** is enabled.
4. Turn **Confirm email** OFF for this username-only version. Users do not enter an email address, so there is no email address available for them to confirm.
5. Open **SQL Editor**, paste the entire `supabase.sql` file, and run it.
6. In **Storage**, create two PUBLIC buckets named exactly:
   - `media`
   - `avatars`
7. Open `config.js` and paste your Supabase project URL and PUBLIC/ANON key.

## Configure

`config.js` should contain:

```js
window.LG_CONFIG = {
  SUPABASE_URL: 'https://YOURPROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR-PUBLIC-ANON-KEY'
};
```

Never put a Supabase `service_role` key in this file.

## Accounts

LOVERS GARAGE intentionally shows only **username + password** to users. Internally, the site maps the username to a non-real synthetic Auth email so Supabase Auth can handle password authentication.

The fixed account flow:
- checks whether the username is already taken;
- creates the Auth account;
- signs in immediately when Supabase returns no session;
- creates/recovers the public profile row;
- keeps the Auth session persisted in the browser;
- lets the same username/password log in later.

If signup says Supabase is requiring email confirmation, go to **Authentication → Providers → Email** and turn **Confirm email** OFF.

## Deploy for free

The site is static HTML/JS and can be deployed to Cloudflare Pages. Put the contents of this folder in a GitHub repository, then import that repository into Cloudflare Pages. No Node.js server is required for this frontend build.

## Upload limits

The free-plan build accepts PNG/JPEG/GIF/WebP images and MP4/WebM/MOV videos up to 50 MB per file. Supabase Storage holds the actual files; the database holds their metadata.

## Version 1.1 update

This v1.1 build uses the same Supabase project and storage as the previous public release, so existing accounts and media remain available. Before deploying v1.1, run `supabase-v1.1-comments.sql` once in the existing Supabase SQL Editor to add the comments table and its RLS policies.

v1.1 also fixes the video detail bug by pausing card-preview videos when a detail view opens.
