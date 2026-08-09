# Phase 4A-2.2 Audit Fixes

- Added strategy-aware prompt construction for character, environment and unmarked-item positive-only paths.
- Added exact Provider payload audits for environment and item marking vocabularies.
- Added prompt hash inputs for strategy, positive traits, positive composition, revision, style profile and final prompt for all new positive-only candidates.
- Kept the standard prompt path and the four existing published assets unchanged.
- Added formal rejection records for the old Hospital, Medkit and Rain candidates.
- Added 57 Phase 4A-2.2 tests; the complete suite is 742/742.
- Added prompt preflight and recovery evidence without exposing the API key.

No `src/core/**` files or gameplay rules were changed.
