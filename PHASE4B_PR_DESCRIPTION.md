# PR Description Proposal — Phase 4B Closure

> Proposal only. This file does not create or edit a GitHub PR.

## Title

`feat: close Phase 4B visual UX and accessibility debt`

## Summary

Closes the final Phase 4B polish/accessibility work on top of the frozen
4B-1–4B-5 gameplay shell:

- adds keyboard-visible focus and reduced-motion safeguards;
- removes hover-only `title` explanations in favor of accessible/visible
  action context;
- isolates the opt-in DebugPanel from the fixed action rail;
- removes the redundant PlanningDrawer log tab while preserving the persistent
  history panel and adds drawer focus management;
- gives ResultScreen a final Zone + player visual using existing `VisualImage`
  assets and fallback behavior;
- preserves the 4B-4 default event-log privacy boundary;
- adds unit and clean-production browser evidence for all five viewports.

## Verification

- 64 test files / 1266 tests PASS
- clean `npm ci` and `npm run build` PASS
- all required save/dependency/art/security gates PASS
- 500-game `PHASE4B6` regression PASS
- `npm audit --omit=dev`: 0 vulnerabilities
- clean preview browser evidence: 5 viewports, 3 states, 0 console/page errors

## Integrity / scope

- 0 image-generation API calls
- 0 formal PNG changes; 35 assets byte-identical
- 0 Manifest/Candidate, `src/core/**`, `src/data/**`, rule, RNG, save-schema
  or version changes
- no GitHub PR mutation is part of this change

## Follow-up

Human playtest remains recommended for real-device touch/safe-area behavior,
screen-reader phrasing and long-session density. Those checks are explicitly
listed in `PHASE4C_CANDIDATES.md`.
