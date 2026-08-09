# Phase 4A-4.5 Visual State Specification

`resolveCharacterVisualState` is a pure UI helper in `src/ui/characterVisualState.ts`. It derives a visual variant from the current `Combatant` HP and UI encounter context; it is not stored in `GameState`, saves or core data.

Precedence:

```text
hp / maxHp <= 0.35 → injured
otherwise active state.encounter → combat
otherwise → portrait
```

This preserves the existing StatusBar injured threshold. Encounter state is the existing `state.encounter`; no Core combat status was added. When an encounter ends, a healthy character returns to Portrait; a low-HP character remains Injured. The same resolver is used for the visible opponent in EncounterPanel, so NPCs are not permanently forced to Portrait and no remote HP information is exposed.

No `visualState`, `artState`, `injured_combat`, `critical`, `dead` or other fourth asset slot was added.
