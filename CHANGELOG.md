# Version 13 — Business Hub redesign

- Warm white and forest-green visual design with grouped navigation, touch-friendly controls, and phone navigation to every section.
- Today combines arrivals, departures, meetings, tasks, cleaning and recurring routines. Completion is tracked per routine and date.
- Attention panel identifies unpaid balances, unknown legacy deposits, pending reservations, overlapping/invalid records and overdue tasks.
- Booking detail drawer, booking edits, actual deposit amounts, payment balance, source tracking and linked turnover tasks.
- Property timeline with exact check-in/out times, turnover markers, month calendar and mobile agenda. Nights count calendar dates correctly.
- Property editing updates linked reservations/tasks when a unit is renamed. Referenced units cannot be deleted accidentally.
- Separate business/personal reports retain the selected month and support cents. Booked revenue is labeled separately from cash received.
- Local data keys, cloud project configuration, account session, optional device lock and the existing planner_data schema remain compatible.
- Automatic backup before legacy migration, imports, record deletion and cloud conflict resolution. Recovery copies can be downloaded.
- Cloud sync uses conditional updates, three-way merging and explicit conflict review. Failed or pending writes are never labeled synced.
- Save and sync feedback, bounded network requests, offline app assets and safe service worker caching limited to site files.

No database migration is required. For cross-device use, refresh every device to Version 13 before editing so old clients do not bypass the new conflict checks.
