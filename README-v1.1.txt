LOVERS GARAGE v1.1

This update keeps the SAME Supabase project and the SAME public media storage as the existing LOVERS GARAGE website. Existing accounts, uploads, images, GIFs, videos, reactions, and profiles are preserved.

NEW IN v1.1
- Public comments on every upload.
- Logged-in users can post comments up to 500 characters.
- Users can delete their own comments.
- Comment usernames open the user's profile.
- Fixed the video double-play bug: opening a video detail now pauses the small card preview so only the detail player continues playing.

IMPORTANT — RUN THE DATABASE MIGRATION
1. Open your existing Supabase project.
2. Go to SQL Editor.
3. Open/copy `supabase-v1.1-comments.sql`.
4. Run it once.

DO NOT create a new Supabase project and DO NOT delete the existing `media` bucket. This version intentionally points at the same backend so all existing public media stays available.

DEPLOY
Replace the files in your Cloudflare Pages/GitHub deployment with the contents of this folder. The existing `config.js` is already configured for the current LOVERS GARAGE Supabase project.
