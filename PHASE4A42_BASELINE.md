# Phase 4A-4.2 Baseline

- Branch: `agent/phase4-art-pipeline`
- Baseline HEAD: `8b4bbc761f0207d2baeb3abdc2d57be34559afa3`
- Baseline tests: `1022`
- Baseline formal AI assets: `27`

## Formal assets at baseline

- Character portraits: Scout, Fighter, Engineer, Medic — official
- Zones: 6 — official
- Items: 12 — official
- World Events: Blackout, Emergency Broadcast, Medical Alert, Research Anomaly, Citywide Unrest — official
- Rain: provider compatibility blocked; runtime fallback active; zero calls in this phase

## Injured variant state at baseline

- Scout portrait: official
- Scout Injured: human approved, pending formal publication at phase start
- Fighter Injured: not generated
- Engineer Injured: not generated
- Medic Injured: not generated
- Character Combat variants: none

## Scope freeze

Phase 3 core/data behavior, combat, skills, NPCs, crafting, world-event logic, search, movement, restricted zones, saves and simulator remain frozen. No `src/core/**` or `src/data/**` changes are allowed.
