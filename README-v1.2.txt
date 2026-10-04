LOVERS GARAGE v1.2

This release keeps the same Supabase project, database, storage buckets, accounts, and existing public media as v1.1.

Changes:
- Fixed responsive/mobile layout for phones and small screens.
- Improved mobile navigation, cards, upload screen, profiles, modals, and comments.
- Video players use playsinline/preload metadata.
- Preview video is explicitly paused/reset before opening the detail player to prevent duplicate playback.
- No media or accounts are migrated, copied, or deleted.

Deployment:
Upload this folder to Vercel as a static site. Keep config.js connected to the same Supabase project.
