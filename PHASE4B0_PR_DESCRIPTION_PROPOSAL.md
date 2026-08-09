# PR #2 Description Proposal

## Phase 4A complete → Phase 4B planning ready

This branch closes the Phase 4A base-art and provenance-integrity work and
freezes the next runtime-visual implementation plan.

### Phase 4A closure

- 35 formal AI assets are published through Manifest + provenance.
- Character Portrait/Injured/Combat coverage is 4/4/4.
- Zone Background coverage is 6/6.
- Item Icon coverage is 12/12.
- World Event art is 5/6; Rain remains the documented runtime fallback.
- Candidate/public content integrity uses exact image bytes; prompt hash and
  content hash semantics are separated.
- The final Phase 4A suite is 57 files / 1236 tests before this planning phase.

### Phase 4B-0 outcome

- Audited every real UI surface, the gameplay flow and the asset visibility
  path using source evidence and a real browser run.
- Classified prototype UI debt with CODE/RUNTIME/HUMAN evidence labels.
- Selected the Hybrid Zone Presentation: the existing Zone Background becomes
  the main scene while a compact map/navigation layer preserves movement
  planning.
- Recommended CSS/icon/label/pattern overlays for Safe/Warning/Restricted;
  no new Zone AI variants are required at this stage.
- Specified Encounter, Search/Loot/Inventory/Craft, World Event, mobile,
  accessibility and feedback directions.
- Froze the next single implementation target:
  **Main Gameplay Visual Shell & Zone Visual Hierarchy**.

### Safety and scope

- Image API calls: 0 in Phase 4B-0.
- Formal public art: unchanged byte-for-byte.
- `src/core/**` and `src/data/**`: unchanged.
- No gameplay, balance, save, RNG, AI or event-rule changes.
- `package.json` and `GAME_VERSION` remain `0.3.2`.

### Verification

The full local gate and GitHub CI should remain the acceptance authority. The
Phase 4B-0 reports are the planning artifacts; implementation is intentionally
not included in this phase.
