# Andrei's Business Hub

A responsive staycation operations workspace for GitHub Pages and Supabase.

## Version 13

See CHANGELOG.md for the redesign and functional fixes. The existing `stayflow-v4` browser storage key and `public.planner_data` cloud table remain in use. No new SQL migration is needed. `supabase-config.js` is unchanged.

## Run and check locally

Use Node.js 20 or newer:

```
node preview.cjs
node --test tests/core.test.cjs tests/cloud.test.cjs tests/service-worker.test.cjs
```

Open http://127.0.0.1:4173. Browser testing should use this local origin, never sample bookings in a real signed-in workspace. No sample data is shipped. Service worker registration is skipped on localhost to avoid interfering with development.

## Publish

GitHub Pages serves the files in the repository root. Push to the configured `main` branch. Keep index.html, styles.css, core.js, app.js, cloud.js, vendor/, icon.svg, manifest.webmanifest, supabase-config.js and sw.js together. The `.nojekyll` file enables ordinary static hosting.

After an update, refresh each device. Old clients should be updated before editing because they do not implement conditional cloud writes. The app reports Version 13 in Settings.

## Data and recovery

- An automatic local recovery copy is created before converting older saved data. It does not change the cloud schema.
- Backups are available under Settings. Recovery copies are local to the browser that created them.
- Use the same cloud account on all devices. On first association, differing device and cloud data require a choice instead of silently overwriting either copy.
- Independent device changes merge; overlapping changes need review. Network or write failures retain local edits and show an error.
- Outstanding balances from old partially paid bookings remain unknown until the actual deposit amount is entered.
- Confirmed booking amounts contribute to booked revenue in their check-in month. Manual booking-payment entries would double-count revenue and should not be added.
- All schedule entries use Asia/Manila (UTC+8). Existing local date/time strings are interpreted in this business timezone.
- A device lock is a convenience feature, not encryption or a replacement for cloud authentication and database row-level security.
- Browser reminders need the app running. Exported calendar items contain a ten-minute alarm; the device calendar controls its actual delivery.

## Verification

26 automated checks cover booking validation, balances, date arithmetic, routine completion, reports, migration, merge conflicts, conditional writes, account switching and offline cache boundaries. Manual browser tests cover property and booking creation, date validation, linked turnover tasks, decimal finance entries and month selection, routine completion, note persistence, and phone/iPad layouts.

Real authenticated cross-device sync requires the owner's signed-in session. Tests use a simulated cloud service and do not inspect or modify live account records.
