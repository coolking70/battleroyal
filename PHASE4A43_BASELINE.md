# Phase 4A-4.3 Baseline

- Branch: `agent/phase4-art-pipeline`
- Baseline HEAD: `ebff421dcff410f113a5c670d6d77d993745ce74`
- Baseline tests: `1074`
- Baseline formal AI assets: `28`

## Baseline state

- Character portraits: Scout, Fighter, Engineer, Medic — official
- Character Injured: Scout official; Fighter, Engineer and Medic human-approved and pending formal publication
- Character Combat: Scout, Fighter, Engineer and Medic — null
- Zones: 6 official
- Items: 12 official
- World Events: 5 official; Rain provider compatibility blocked with runtime fallback and zero calls

## Phase scope

Track A will publish only the three approved Injured candidates, increasing formal assets from 28 to 31. Track B will generate only one Scout Combat canary. The canary remains pending and unpublished even if technically valid. No other Combat, Injured, Rain, World Event, Zone or Item generation is permitted.

Phase 3 core/data behavior, combat formulas, skills, NPCs, equipment, crafting, world events, movement, saves and simulation remain frozen. No `src/core/**` or `src/data/**` changes are allowed.
