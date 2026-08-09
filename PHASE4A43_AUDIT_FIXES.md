# Phase 4A-4.3 Audit Fixes

## Scope

Phase 4A-4.3 was executed from baseline commit `ebff421dcff410f113a5c670d6d77d993745ce74` with `src/core/**` and `src/data/**` frozen. The phase had two independent tracks:

- Track A formally published only the three already human-approved injured candidates for Fighter, Engineer and Medic.
- Track B generated exactly one Scout Combat canary, with no approval or publication.

## Audit findings and fixes

### 1. Formal injured closure

The three exact candidate hashes named by the phase prompt were approved and published:

| Character | Candidate hash | Result |
| --- | --- | --- |
| Fighter Injured | `bdfbd88d5ad6b746586decb62227b5f4d92676dbded3ac16c624a1efc7d3e61e` | approved and published |
| Engineer Injured | `a696243e0873e7e44e352c27721a25e6ff558b5027482beffe89ca95792352d5` | approved and published |
| Medic Injured | `804ea57b335ffd9b0f8557d3ce81e72e8b6071038aa396c8a244b7f97c8d8154` | approved and published |

The formal Manifest now contains 31 AI assets. The four character portraits and four injured variants are official. Existing zones, items and five official world events were preserved; Rain remains the provider-compatibility exception with runtime fallback and zero calls.

### 2. Combat canary isolation

The generator now has an explicit `character/scout/combat` canary path. It rejects phase-scope expansion, requires concurrency 1, refuses an existing candidate, uses no retry delay, and produces a report without approval or publish side effects. Fighter, Engineer and Medic Combat, all Injured tasks, Rain and all other unrelated tasks are excluded.

### 3. Equipment-neutral prompt policy

Combat state art is modeled as posture, expression, tension and motion. Fixed weapon or military/tactical equipment is not part of the character prompt. The dynamic-equipment audit rejects forbidden combat/equipment tokens in provider-facing prompts. Item/equipment visuals remain owned by the item/equipment systems.

### 4. Human-review boundary

Automatic validation records technical facts only. It does not score identity, auto-approve, auto-reject or reroll. The generated Scout candidate is pending. Its objective observation records binoculars near the face and another binocular set on the chest for human review; this observation did not trigger an automatic decision.

## Verification

- Full test suite: 1162/1162 PASS.
- Typecheck, build, save audit, dependency audit, offline art doctor, Manifest validation and repository/browser secret scans: PASS.
- 500-game PHASE4A43 regression: PASS.
- Production dependency audit (`npm audit --omit=dev`): 0 vulnerabilities.
- Review export: one pending Scout Combat candidate with blank Decision/Notes.
