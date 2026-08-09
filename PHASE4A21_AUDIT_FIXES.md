# Phase 4A-2.1 Audit Fixes

- Added an explicit `character-positive-only` prompt strategy scoped to three character portraits.
- Removed character design-sheet and all generic/category negative content from that strategy.
- Added final Agnes payload auditing for forbidden character tokens, internal IDs, entity IDs, and design-sheet headings.
- Added `npm run art:prompt-audit` for offline preflight.
- Bumped Engineer, Fighter, and Medic revisions so the positive-only hashes cannot reuse old contaminated candidates.
- Formally approved/published Blackout v5 and formally rejected the three old contaminated B1 character candidates.
- Kept all new character and non-character candidates pending; no new asset was added to the Manifest.
- Kept Zone/Item/Event standard prompt behavior unchanged.
