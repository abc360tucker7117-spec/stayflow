# Supabase browser SDK

## Bundled UI fonts

Fredoka (Google Fonts v17) and Nunito (v32), Latin variable WOFF2 files, are served locally for offline use. Their SIL Open Font License notices are included in `fredoka-OFL.txt` and `nunito-OFL.txt`.

Bundled `@supabase/supabase-js` version 2.116.0, retrieved from the official package on jsDelivr:
https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/dist/umd/supabase.js

Bundling avoids a runtime CDN dependency and lets the static app open offline. The SDK still requires connectivity to sync account data. See LICENSE-supabase.txt.
