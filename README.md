# StayFlow Pro V4 Cloud

V4 keeps the V3 planner UI but adds:
- Supabase email/password login
- Cloud storage of the complete planner data
- Multi-device sync
- Realtime updates between signed-in devices
- Local offline copy for resilience
- V3 local-data migration on first use

## Setup

1. Create a Supabase project.
2. In Supabase SQL Editor, run `supabase_schema.sql`.
3. Open Project Settings / API Keys and copy the project URL and **publishable key**.
4. Put them in `supabase-config.js`:
   - `url: 'https://YOUR-PROJECT.supabase.co'`
   - `key: 'sb_publishable_...'`
5. Host this folder on an HTTPS static host such as GitHub Pages.
6. Open the same website on your laptop/iPad/phone.
7. On the first device, open Settings → Cloud Sync, save the connection, create an account and sign in.
8. On every other device, use the same Supabase URL/key and sign in with the same account.

### Important security rule
Never put a Supabase secret/service-role key in `supabase-config.js` or browser code. The browser should use only the publishable/anon key. The database RLS policies in `supabase_schema.sql` restrict each account to its own planner row.

### Existing V3 data
If V3 data exists in the browser under `stayflow-v3`, V4 migrates it into `stayflow-v4`. When the cloud account has no planner row yet, V4 uploads that local data as the first cloud copy.

### Important behavior
This first V4 version syncs the planner as one JSON document per account. It is excellent for one owner using several devices. If two devices edit the same field at exactly the same time, the most recently saved copy wins. A later version can add field-level conflict resolution and multi-user/team permissions.

## Hosting
GitHub Pages can publish static HTML/CSS/JS from a repository. Use HTTPS; PWA/service-worker features require a secure context.

## Reminders
The current browser reminder feature still depends on the app/browser being able to run notifications. True reminders while the app is completely closed should be added later with server-side scheduled push/email/SMS.
