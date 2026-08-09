# Phase 4A-2 Publish Report

## Formal Round A

Published exactly three approved AI assets:

- `character/scout/portrait` → `/assets/characters/scout/portrait.png`
- `zone/school/background` → `/assets/zones/school/background.png`
- `item/bandage/icon` → `/assets/items/bandage/icon.png`

Manifest hash after publish: `1a9d9d04fd1274190eb4a1b851644b2d3690c5d5e3e6ecbddf796304aab016a1`.

`world_event/blackout/illustration` is absent from the Manifest because the frozen v4 candidate was rejected and v5 remains pending. The second `npm run art:publish` returned `NO CHANGES: no new approved assets to publish`.

## Provenance

`art/approved-assets.json` contains exactly the three published task IDs and the exact approved candidate hashes recorded in `PHASE4A2_BASELINE.md`.

## Runtime closure

The runtime selector tests cover the official Scout, School and Bandage paths, the SVG fallback for unapproved Blackout, and the official → SVG → emoji image failure chain. See `reports/phase4a2-runtime-verification.md`.
