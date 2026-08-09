# Phase 4A-2.2 Baseline

Captured before any Phase 4A-2.2 review mutation or provider request.

- Branch: `agent/phase4-art-pipeline`
- HEAD: `6c566e59d14deda46f24f63652af5b49128d705c`
- Baseline test count: 686 passing
- Existing formal AI asset count: 4
- Existing Manifest hash: `ad687fd5ff6172a7691e8e86bdbf05eea5b0b675edc5d251136b76d7852d74f7`
- Existing provider API candidates: 20 metadata records across the preserved candidate tree
- Pre-existing unrelated worktree changes: `reports/save-validation-audit.json` and `reports/save-validation-audit.md` (preserved unstaged)

## Existing formal AI assets

| Task | Candidate hash | Public path |
| --- | --- | --- |
| `character/scout/portrait` | `2cad771df6a1017996e2aa3ef3f1dabc03b0fcb9756c3a005ed86006128093fd` | `/assets/characters/scout/portrait.png` |
| `zone/school/background` | `c475891838381390cf9e837cbf3745971c3e834d95650e5ec98ed8bb29e053c7` | `/assets/zones/school/background.png` |
| `item/bandage/icon` | `3e4d2edadc1b0cd8e2664be2224e1effa663c8fc01d61a170e5f7e4b6c9a09bb` | `/assets/items/bandage/icon.png` |
| `world_event/blackout/illustration` | `d813c5525288a419335cee2975ce1736f1cd5b49499ae9b05f71ad6a22130843` | `/assets/world-events/blackout/illustration.png` |

## Phase 4A-2.1 candidates at baseline

The following candidates were technically validated and remained pending for this phase's human review:

| Task | Candidate hash | Baseline status |
| --- | --- | --- |
| `character/engineer/portrait` | `12989865f752e70e7716b2881c3bfa5dbe5546a9c0ec7694705b38be30101979` | pending; positive-only character review approved by the phase brief |
| `character/fighter/portrait` | `33b377a42b0a9a827fed7d3c8701dbe40e70893bc517a6500090a0e1febf8218` | pending; positive-only character review approved by the phase brief |
| `character/medic/portrait` | `6a1d891c1597e51d3ea26cab3c63a514994a4ed3d026f3f5f5e675a47eb8ec59` | pending; positive-only character review approved by the phase brief |
| `zone/hospital/background` | `80d603bfd8124a44919ffc590313448511686c51f2648850527c71e8268e9354` | pending; human review rejects multiple visible people |
| `item/medkit/icon` | `c52f6ec3dd935448b766a090fe32513d6c6b5a9bde3710dee101edb087e09108` | pending; human review rejects prominent red cross |
| `world_event/rain/illustration` | `5804105a6f017924222fa112126db9fc8d482dd0707ef0141c0ea09da0f83313` | pending; human review rejects visible person |

Older rejected character B1 candidates remain preserved as historical review records and are not eligible for publication.

## Scope freeze

This phase does not modify `src/core/**`, gameplay rules, combat, NPC, crafting, saves, simulation rules, or UI behavior. New Hospital, Medkit, and Rain candidates remain pending until independent human review; they are not auto-approved or published.
