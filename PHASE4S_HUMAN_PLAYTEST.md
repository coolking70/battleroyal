# Phase 4S Human Playtest

- Status: **NEEDS-HUMAN-PLAYTEST**
- Branch: `agent/phase4s-actor-knowledge-strategic-intent`
- Draft PR: [#26](https://github.com/coolking70/battleroyal/pull/26)
- Automated tests do not replace this visible-behavior review.

## Setup

Use a normal game for player-visible checks. Repeat selected scenarios with
`?debug=1` only when the checklist asks for last-known cognition evidence.
Record the seed, character, time, NPC name, expected behavior, observed
behavior, and PASS/FAIL for every item.

## Checklist

1. **Confirmed source failure has a stable fallback.** Observe an NPC reach and
   legally inspect an exhausted/unavailable source while it still needs the raw
   material. Confirm it does not immediately oscillate back to the same source
   and can choose another legal source or ordinary fallback.
2. **Strategic direction persists across ordinary turns.** In debug mode,
   observe several turns without a formal goal, recipe, Apex, or critical-health
   change. Confirm the intent type and `committedAt` remain stable rather than
   being recommitted each turn.
3. **Cautious threat response is coherent.** After a cautious NPC legally sees
   a strong contestant and flees, confirm its short-term route preference avoids
   the remembered danger zone when a legal alternative exists. It must not
   teleport or bypass movement rules.
4. **Public Apex produces actor-owned divergence.** After a public Apex spawn,
   compare an underprepared and a well-equipped NPC. A gear-up versus
   contest-Apex split is acceptable; both must use only the public lifecycle and
   their own readiness.
5. **No remote actor tracking.** After NPC A sees actor B in one zone, move B
   elsewhere while A is absent. In debug mode, confirm A retains the old
   last-seen zone/time until a legal revisit or public observation.
6. **No instant remote landmark knowledge.** Empty or change a landmark with the
   player while an NPC is remote. Confirm that NPC does not immediately react to
   exhaustion, loot count, lock, repair, charges, or last-use changes.
7. **Normal UI keeps private cognition private.** Without `?debug=1`, inspect
   route panels, map, event log, combat UI, and victory UI. Confirm no NPC private
   memory, intent, observation, remembered threat, or remembered loot appears.
8. **Debug view matches last-known semantics.** With `?debug=1`, compare intent,
   memory size/evictions, source failures, threats, and observation timestamps
   against actions actually witnessed. Stale entries must stay stale until a
   legal refresh, and one NPC must not inherit another NPC's memory.

## Result record

| Item | Seed / time / NPC | Result | Notes |
| --- | --- | --- | --- |
| 1 |  | PENDING |  |
| 2 |  | PENDING |  |
| 3 |  | PENDING |  |
| 4 |  | PENDING |  |
| 5 |  | PENDING |  |
| 6 |  | PENDING |  |
| 7 |  | PENDING |  |
| 8 |  | PENDING |  |

Final human status remains **NEEDS-HUMAN-PLAYTEST** until a human records all
eight results.
