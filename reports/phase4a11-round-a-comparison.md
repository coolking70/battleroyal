# Phase 4A-1.1 Round A Comparison

| Asset | v1 observed issue | v2 architecture change | v2 technical result |
| --- | --- | --- | --- |
| Scout | Rifle on back | Character-only sheet, binoculars-only equipment, explicit weapon-free constraints | API once; validation passed; human review pending |
| School | Central person/silhouettes | Zone-only inheritance, zero-human constraints, calm lower-center constraint | API once; validation passed; human review pending |
| Bandage | Ruins/HUD/frame/arrows | Item-only inheritance, exactly-one-object and neutral-backdrop constraints | API once; validation passed; human review pending |
| Blackout | Armed person/rain/HUD | Event-only inheritance, zero-person/weapon/rain and powerless-light constraints | API once; validation passed; human review pending |

The v2 generation changed the prompt and cache hash. This table records technical architecture and observed history; it does not claim that visual compliance is complete.
