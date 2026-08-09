# Phase 4B-0 Search UX Specification

## Required state sequence

```text
Search available → action pressed → short in-place feedback → result card
→ inventory/ground/encounter continuation → historical log entry
```

## Result distinctions

| Result | Immediate treatment | Log treatment |
| --- | --- | --- |
| Item found | Level 2 item card/toast with icon, item name, quantity and destination | `ITEM_FOUND` / pickup event remains in history |
| Nothing found | Level 1 neutral “区域已搜空/没有找到” microfeedback with noise result if legal | Keep the existing search log |
| Encounter | Level 3 focus shift to Encounter layout; do not make it look like a normal search toast | Keep `ENCOUNTER_STARTED` and combat entries |
| Event-related modification | Level 2 event modifier badge attached to the result, with affected rule text | Keep world/zone event log |

No new image or animation asset is needed. Use existing item/Zone/event art,
CSS transition and text. The Search button must retain visible cost and disabled
reason. Search behavior and RNG remain frozen.

Status: current toast/log behavior is `RUNTIME-VERIFIED`; proposed result-state
separation is `HUMAN-PLAYTEST-NEEDED`.
