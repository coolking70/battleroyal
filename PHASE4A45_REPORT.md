# Phase 4A-4.5 Report

> Integrity note: This closure was finalized by Phase 4A-4.5.1, which added true image-byte provenance hashing.

## Scope and decision

Phase 4A-4.5 closes the Base Art production track. No image generation was performed in this phase: provider/API calls = **0**. `src/core/**`, `src/data/**`, gameplay rules, save schema and balance were not changed.

The baseline was 32 formal AI assets. The three explicitly human-approved Combat candidates were approved exactly as supplied and then published:

| Task | Approved candidate hash |
| --- | --- |
| `character/fighter/combat` | `e0add26bee2964f26a21df410662eed4500598b866b69eb53ab3b345980b2d7f` |
| `character/engineer/combat` | `771016954288f55552af415eaf25071a66d7906a1cf8a998997b4d1310f4509e` |
| `character/medic/combat` | `46b13f1437678d9e0da8fe127513514fa965acb72a4b530e22e8d0feedad01c8` |

`art:validate` passed and the second `art:publish` returned `NO CHANGES`. The final formal set is **35** assets:

- Characters: 12/12 official — Scout, Fighter, Engineer and Medic each have Portrait, Injured and Combat.
- Zones: 6/6 official backgrounds; Warning and Restricted remain optional future variants.
- Items: 12/12 current Item ArtTasks official.
- World events: 5 official; Rain remains fallback-only under the documented provider compatibility exception.

## Runtime closure

Added the pure derived `resolveCharacterVisualState` resolver. Its precedence is `injured > combat > portrait`; it is not persisted in `GameState`. StatusBar and the visible EncounterPanel now use the resolver, so Combat and Injured visuals are reachable through real UI consumers without exposing hidden remote NPC state. Existing official → local SVG → emoji/color fallback remains active, including Rain.

## Evidence

- Phase 4A audit: Manifest coverage, provenance reverse audit, candidate hygiene and runtime usage all PASS.
- Candidate store: 54 records — approved 35, pending 10, rejected 9. Historical rejected/pending records remain preserved; no current-hash leakage was found.
- Full test suite: **56 files, 1211/1211 tests PASS**.
- Typecheck, build, save audit, dependency layering audit, offline art doctor, Manifest validation, browser/repository secret scans and production `npm audit --omit=dev` all PASS.
- 500-game `PHASE4A45` regression completed with 500/500 games and engine/regression PASS; the existing role-balance result remains observation-only under the project’s regression policy.

## Conclusion

**PHASE 4A BASE ART PRODUCTION = COMPLETE**, with Rain explicitly recorded as a conditional provider exception and runtime fallback. No Phase 4B work was started.
