# Version 15 — Finance cutoffs and blue sidebar design

- White backgrounds, black lettering, rounded Fredoka/Nunito fonts, and blue action buttons. Desktop sidebar retained; phone Menu opens the same navigation.
- Separate Business, Personal, and Loans charts. 1–15, 16–month end, full-month and inclusive custom date filters, with previous/next controls and remembered report dates.
- Transaction search, category/type filtering, selected-range CSV exports, and prior-period net comparison. Totals and graphs share the filters.
- Loan reports distinguish cutoff-end balances from current management balances. Historical totals exclude future payments; original scheduled installments remain separately labeled.
- Existing storage keys, schema version 13, record IDs, cloud connection and cloud table retained. A local recovery copy is created before the first v15 load of saved data. No live records or samples are bundled with the release.
- Bundled fonts support offline use. Cache bumped to v15; only application assets are cached.
- 34 automated checks pass, including date boundaries, leap years, cents, account separation, immutable reports, CSV escaping, historical loan balances, and existing sync/data-preservation checks.

# Version 14 — Personal planning and loan tracking

- Reservation navigation and dashboard metrics replaced by tasks, meetings, and long-term goals. Historical booking records remain in backups; finance now reports entered transactions only.
- Week, month, and agenda schedule views include tasks, routines, and goal deadlines.
- Tracker stores progress, accomplishment history, optional deadlines, and daily dashboard reminders.
- Finance > Loans supports monthly/yearly installments, repayment duration, payment history, remaining balance, and payment corrections.
- Loan totals are user-entered agreed repayments including fees/interest; this is not an interest or amortization calculator. Payments are separate from expense records to avoid silently duplicating existing entries.
- Google/Apple ICS calendar export includes recurring routines and 10-minute alarms. This release does not provide automatic two-way calendar synchronization.
- Live Manila date/time appears throughout the site. Existing notes, finance entries, properties, routines, guests, account connection, and backups remain compatible.
- Validation: 30 automated checks pass. Local browser checks cover goal creation/accomplishments, loan creation/payment/overpayment rejection, and responsive calendar layout.


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
