# Phase 4A-4 Event Production Specification

## Provider contract

- Provider: Agnes `agnes-image-2.1-flash`
- Endpoint: `/v1/images/generations`
- Requested size: `768x432`; requested ratio: `16:9`
- Agnes output is accepted at `1312x736` when the technical validator passes.
- `negativePrompt` is empty. The actual provider body must contain no `Avoid:` section.
- One normal call per task, sequentially, with no force/reroll.

## E1 order

1. `world_event/emergency_broadcast/illustration`
2. `world_event/medical_alert/illustration`
3. `world_event/research_anomaly/illustration`
4. `world_event/citywide_unrest/illustration`

Rain is not in the planner and must receive zero calls. If two provider content rejections occur within the first three tasks, the remaining tasks stop. A content rejection produces no candidate and is not retried; one rejection alone does not stop the batch.

## Positive briefs

- Emergency Broadcast: unattended civic communications room, public-address speaker, communications console, abstract signal bars/geometric blocks, amber warning beacon; no readable text, map or coordinates.
- Medical Alert: hospital emergency supply station, off-white cases, muted green panels and a status beacon; no cross, logo or emblem.
- Research Anomaly: contained instrument anomaly inside a research chamber, sealed glass apparatus, blue-violet disturbance and abstract waveforms; no monster, magic or portal.
- Citywide Unrest: disordered city intersection, displaced barriers, overturned bins, scattered paper and warning beacons; no riot/protest/crowd/battle/soldier/weapon/fire/explosion/political logos.

The positive briefs are environmental event illustrations only: no person/crowd tokens, no UI semantics, no internal IDs, and no readable text.
