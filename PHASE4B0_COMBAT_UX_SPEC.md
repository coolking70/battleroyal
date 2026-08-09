# Phase 4B-0 Combat UX Specification

## Current legal information

The existing `EncounterPanel` can show:

- enemy name, known character identity, Combat/Injured visual, HP descriptor and
  HP bar;
- enemy weapon (because it is exposed by the current encounter rules), player
  attack and defense totals, and flee percentage;
- player Guard and EXPOSED state, enemy EXPOSED state, combat log;
- Quick / Normal / Heavy attack, shared-core hit chance, stamina cost and Heavy
  miss risk;
- character skill readiness/cooldown, Guard cost and free Flee action;
- the fact that inventory consumables/equipment remain available in combat.

## Recommended layout for Phase 4B-2

```text
[ PLAYER ]        [ ENCOUNTER STATE / LAST RESULT ]        [ ENEMY ]
portrait/combat   turn posture, log, risk, legal actions    combat/injured
HP + Stamina      quick / normal / heavy / guard / flee      known HP + weapon
Guard/EXPOSED     skill + cost + cooldown                   EXPOSED if known
```

This is a planning target only. The player side must use the same current
`player` fields already permitted by the rules. The enemy side must not add
hidden equipment, precise unknown HP, hidden skills, future actions, or remote
NPC data.

## Visual rules

- Entering an active encounter should promote the combat card to the stage's
  primary focus and dim/lock exploration actions.
- Keep the combat log as a short immediate history; route the full event stream
  to the Log tab.
- Make attack choice tradeoffs one scan: label, hit chance, stamina and Heavy
  risk must remain visible.
- Use Combat art at a perceptible size for both sides. Use Injured art when the
  existing HP threshold resolves it; do not add a fourth state.
- After Continue, restore focus to the next legal exploration action, not to a
  historical log line.

Status: current shell and enemy-side facts are `CODE-VERIFIED` and
`RUNTIME-VERIFIED`; the final visual balance is `HUMAN-PLAYTEST-NEEDED`.
