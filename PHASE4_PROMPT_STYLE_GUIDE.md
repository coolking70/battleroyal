# Phase 4 Prompt and Style Guide

The master direction is original urban survival suspense × light anime semi-realism × cold strategy UI. It uses restrained desaturated colors, clear silhouettes, grounded lighting, subtle painterly texture, and UI-safe compositions.

Prompt construction reads, in order:

1. `art/style/master-style.md`
2. the category profile (`character-style.md`, `zone-style.md`, `item-style.md`, or `event-style.md`)
3. the character design sheet when applicable
4. the stable task brief and variant constraints
5. technical dimensions and UI readability constraints

The shared negative prompt is in `art/style/negative-prompt.txt`. It avoids text, watermarks, logos, malformed anatomy, blur, UI frames, recognizable commercial IP, and imitation of a living artist. Prompt output is saved under `reports/phase4-prompts/` so a future revision can be audited and reproduced.

Character injured variants preserve the normal character's clothing, hair, age, and signature prop; only light injury, fatigue, dust, or a small bandage changes. Zones contain no clear people and reserve low-complexity space for UI. Items are single centered objects. Events communicate atmosphere without revealing player coordinates or turning infrastructure into monsters.
