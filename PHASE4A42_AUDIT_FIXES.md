# Phase 4A-4.2 Audit Fixes

- Published only the user-approved Scout Injured candidate `ccb0f5d7e17d097f94e60a5109b898f9fc4bbcaf4ac82b74bb296a31f29c1b51`; formal assets increased from 27 to 28.
- Added full positive-only, revision-2 descriptors for Fighter, Engineer and Medic based on their approved portraits and design sheets.
- Added character prompt audits for actual Agnes payloads: forbidden vocabulary, internal task/entity IDs and reference-image claims all remain absent.
- Added a sequential injured batch runner with no retry/reroll and a two-consecutive-provider-rejection stop rule.
- Kept all new injured candidates pending and out of `public/assets/manifest.json` and `art/approved-assets.json`.
- No similarity, face recognition, biometric or embedding score was introduced.
- No `src/core/**` or `src/data/**` files were changed.
