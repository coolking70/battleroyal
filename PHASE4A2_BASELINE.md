# Phase 4A-2 Baseline

Date: 2026-08-09

## Formal Round A decisions

The human review decision for the frozen Round A candidates is:

| Task | Candidate hash | Decision |
| --- | --- | --- |
| `character/scout/portrait` | `2cad771df6a1017996e2aa3ef3f1dabc03b0fcb9756c3a005ed86006128093fd` | APPROVE |
| `zone/school/background` | `c475891838381390cf9e837cbf3745971c3e834d95650e5ec98ed8bb29e053c7` | APPROVE |
| `item/bandage/icon` | `3e4d2edadc1b0cd8e2664be2224e1effa663c8fc01d61a170e5f7e4b6c9a09bb` | APPROVE |
| `world_event/blackout/illustration` | `bbf6b831c8cf9ec9548c82269e2be6f03a9821d8c80b631615e0e9a5a02d2671` | REGENERATE / REJECT |

Blackout v4 rejection reason: `Human review: normal ceiling lights and powered indicators remain visible; image does not read clearly as a blackout.`

Only the three approved tasks may enter the formal Manifest in this phase. Blackout remains absent from the published Manifest until a later human approval.

## Controlled Round B1 scope

Round B1 is limited to exactly six serial first-call tasks:

1. `character/fighter/portrait`
2. `character/engineer/portrait`
3. `character/medic/portrait`
4. `zone/hospital/background`
5. `item/medkit/icon`
6. `world_event/rain/illustration`

The healing consumable is `item/medkit/icon`: it is a high-frequency healing item distinct from the already frozen bandage asset. No injured variants or other unlisted tasks are included.

All Round B1 candidates remain pending and are excluded from publishing.

## API budget

The planned live budget is seven first calls total: one Blackout v5 regeneration plus six B1 calls. Generation is serial and does not use `--force`.

## Pre-publish state

Before the formal publish operation, the public Manifest contains only the legacy bandage SVG fallback and `art/approved-assets.json` contains no AI provenance entries. The pre-publish Manifest hash is `594159c184c97fc693003deee94a2d57df0db45bd86cf98dcf1f1484f531084d`.
