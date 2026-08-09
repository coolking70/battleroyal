# Phase 4A-4.4 Review

## Scout

Scout Combat v3 is formally approved and published at `/assets/characters/scout/combat.png`. The two earlier duplicated-binocular candidates remain rejected and preserved in local review history. Runtime fallback behavior was checked against the published path and the existing VisualImage fallback contract.

## Batch decision state

The three new candidates are technically valid but intentionally **pending**. The generated images were inspected visually:

- Fighter: the matched glove pair, one glove per hand, defensive guard and readiness read clearly.
- Engineer: the raised hand is empty and the tool belt reads; human review must confirm that the secured wrench is the intended single static signature rather than an ambiguous belt-tool cluster.
- Medic: cautious posture and identity read; the waist pouch is not clearly visible in the crop, so the candidate requires an explicit human decision.

No candidate was automatically approved, rejected or rerolled. No batch Combat slot was published. The review package keeps Decision and Notes blank for each candidate:

`output/art-review/phase4a44-combat-batch/README.md`

The package also includes the three PNG candidates and `index.json`; the output directory is intentionally local/ignored production review state.
