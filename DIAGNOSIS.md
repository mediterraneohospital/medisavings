# MediSavings — 22 September 2026

Base main: 71f81a39b93c5fe6a25bf0c3ec40609392b5dfbc.

No Supabase data or schema was modified. GitHub write attempt returned 403 Resource not accessible by integration; production has not been changed.

## Findings

- SQL and the public REST read both confirm 81 rows / 112099.80 for 2025 and 93 rows / 111972.94 for 2026 H1. A further 2024 row contains 6019.65.
- The screenshot's 113172.57 exactly equals the sum of the legacy material_changes fields. js/list.js discards the periods query error and falls back to these fields; the empty periods map simultaneously produces 0 for 2025. The original failed request/cache state is not available, so its underlying cause cannot be established retrospectively.
- Current production js/list.js matches main. A fresh browser loaded periods successfully, but displayed 98050.00 for 2025 because find() includes only the first row per material, and 230092.39 overall because it also includes 2024 despite the 2025 + H1 2026 label.
- Latest commit only adds accent-insensitive search in index.html; it does not change aggregates.
- Original sw.js is network-first, not cache-first. Its fixed v1 cache is populated only at installation, never refreshed or cleaned, and may serve obsolete static files on network failures. Cache alone is not proven to have caused the screenshot.

## Ready-to-commit replacements

Replace index.html, js/list.js and sw.js at exactly those repository paths. Do not upload js/list.js as root list.js (the root copy is not loaded by index).

- Period reads are paginated and checked; failed reads show unavailable totals instead of legacy totals or zero.
- 2025 sums every matching row. Header total includes only 2025 and the exact existing 2026 H1 period. Material cards retain their all-period totals and badges.
- Script URL is versioned. New worker activates immediately, removes only old medisavings caches, refreshes same-app static files from network without HTTP cache, and never intercepts Supabase requests. No localStorage or database data is deleted.
- Edit-mode code and accent normalization are unchanged. Sorting is preserved. Clearing filters also hides the search-clear button.

## Verification

Local browser with the unchanged public Supabase configuration visibly shows 65 changes, 112099.80 for 2025 and 224072.74 combined. Search for γαζα returns four Γάζα entries. A–Ω and Ω–Α buttons work; clearing restores 65 entries and A–Ω. Aggregate and failure-path checks pass using the real period response. Edit-mode source is unchanged; dialog interaction was not verified. Production verification after upload remains pending because write access was denied.

After upload and Pages deployment, reload index.html and confirm the above amounts. Existing already-open pages need a reload to run the new script.
