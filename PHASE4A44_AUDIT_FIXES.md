# Phase 4A-4.4 Audit Fixes

- Generalized Combat prompt auditing from Scout-only binocular rules to role-specific wearable/static signature contracts.
- Added explicit Engineer transition rejection for holding, raising, swinging, repairing and reaching for tools.
- Added explicit Medic transition rejection for pouch interaction, healing, treatment and bandage language.
- Added posture-only checks for Fighter, Engineer and Medic, including empty-hand contracts where required.
- Added the ordered batch runner with one call per task, concurrency 1, no force/reroll, no auto-approval and no auto-publication.
- Added content-rejection stop behavior: if Fighter and Engineer are both provider-rejected, Medic is skipped.
- Added report, prompt-report routing, review export names/checklists and 22 meaningful batch tests.
- Updated closure assertions for Scout Combat publication and the 32-asset formal total.

No `src/core/**` or `src/data/**` files were changed. No gameplay mechanics, balance rules or runtime combat logic were changed.
