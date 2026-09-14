# StayFlow Pro V5 Cloud

A cloud-synced staycation operations planner for GitHub Pages + Supabase.

## Added in this upgrade
- Today's schedule now has **Done/Undo** and **Remove** controls.
- Finished meetings are visibly marked completed.
- Separate **Business** and **Personal** finance tabs.
- Business revenue includes confirmed booking revenue plus manually entered business revenue.
- Monthly finance reports with revenue, expenses and net.
- Calendar export for schedules/reminders using `.ics` with a 10-minute calendar alarm.
- Browser reminder alarm sound plus browser notifications when supported.
- Quick Note and Notes typing are protected from accidental rerender/realtime overwrite while typing.
- Optional local website password/lock per browser/device.
- Supabase sign-out uses local scope so signing out on one device does not intentionally sign out the other devices.
- Service-worker cache version bumped so GitHub Pages devices receive the upgrade.

## Calendar/alarm limitation
A static website cannot directly control the iOS/Android system Calendar database. StayFlow exports an `.ics` event with a calendar alarm; the device's Calendar app can then manage the alarm. Browser alarms/notifications are reliable only while the browser/PWA is allowed to run and notification permissions are enabled.

## Cloud
Supabase stores the planner JSON in `public.planner_data`. Existing RLS policies keep each user's row private. No new SQL table is required for this upgrade because finance data remains inside the existing JSON document.
