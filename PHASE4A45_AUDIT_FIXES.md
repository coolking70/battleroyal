# Phase 4A-4.5 Audit Fixes

This closure applied only the minimum changes required to formalize the three human-approved Combat candidates and prove runtime/UI coverage.

- Approved Fighter, Engineer and Medic Combat by their exact supplied hashes; published the three slots atomically and verified idempotence with a second `NO CHANGES` publish.
- Added a read-only Phase 4A-4.5 audit for real game-data IDs, current Item ArtTasks, Manifest files, MIME/dimensions/bytes, provenance reverse mappings, candidate hygiene and runtime consumers.
- Added `resolveCharacterVisualState` as a derived UI selector. Injured wins below the existing 35% HP threshold; otherwise an active visible encounter selects Combat; healthy non-encounter state selects Portrait.
- Wired the selector into StatusBar, DebugPanel and EncounterPanel. Encounter visuals are limited to the already-visible opponent panel and do not reveal hidden NPC state.
- Kept the existing official → bundled SVG → emoji/color fallback and Rain fallback path. Unknown IDs remain safe.
- Updated stale formal-count assertions from 32 to the final 35 where they describe the published Manifest.
- Added closure tests, machine-readable audit reports, final command evidence and phase documentation.

No image API call, prompt revision, candidate deletion, gameplay/data rule change, save-schema change or balance change was made by this phase.
