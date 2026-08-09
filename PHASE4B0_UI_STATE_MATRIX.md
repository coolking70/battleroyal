# Phase 4B-0 UI State Matrix

| State | Main visual | Character art | Zone visual | Primary action area | Secondary panel | Alert | Log |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal exploration | Zone scene + current-zone card | Portrait | Scene + Safe label | Search / Rest / Move | Inventory | None or countdown | History only |
| Low stamina | Same scene, resource emphasis | Portrait | Same | Legal actions only; costs prominent | Inventory/Craft subordinate | Low-resource cue | Action result |
| Injured | Scene darkened/urgent edge | Injured visible at perceptible size | Current zone status | Heal / flee / move priority | Consumables first | HP danger text | Damage/heal |
| Active encounter | Encounter focus card | Player Combat + enemy Combat/Injured | Scene dimmed, not removed | Attack / Guard / Skill / Flee | Consumables/equipment allowed by current rules | Encounter + statuses | Recent combat |
| Active world event | Event treatment attached to scene | Current state | Scope-aware overlay/badge | Affected cost/legality visible | Planning impact | Event label + duration | World category |
| Zone warning | Amber scene overlay | Current state | Warning icon/pattern/label | Move priority + countdown | Map route | Urgent countdown | Zone warning |
| Restricted zone | Hazard scene overlay | Injured if threshold | Restricted icon/pattern/label | Move / survival action | Consumables | Damage-per-turn | Zone damage |
| Craftable item | Scene remains primary | Current state | No change | Craft output action | Goal + item card | Materials complete | Craft result |
| Inventory full | Scene dimmed behind decision card | Current state | Current zone | Replace/drop/abandon | Inventory choices | Pickup decision | Item/pickup |
| Game over | Result visual | Result state art | End-zone context | Restart / menu | Stats/history | Verdict | Timeline |
| Victory | Result visual | Victory/portrait closure | End-zone context | Restart / menu | Stats/history | Strong verdict | Timeline |

Core rule: the matrix describes presentation of existing facts only; it does
not authorize new hidden information or rules.
