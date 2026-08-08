# Phase 4A-2 Prompt Compliance

## Blackout v5

- Task revision: 4.
- Prompt hash: `d813c5525288a419335cee2975ce1736f1cd5b49499ae9b05f71ad6a22130843`.
- Provider brief is a close/medium-close electrical control area in an underground public facility.
- Explicit locks include ceiling outside the frame, zero ceiling lamps, zero people/windows/exterior/weather/rain, black displays, dark control panels and indicator arrays, zero green/white normal lights, one dim red emergency beacon, and no HUD/interface/text.
- One provider call was made. Candidate remains pending; no automatic approval or publish.

## Controlled Round B1 preflight

The preflight contained exactly these six tasks and no injured variants:

| Task | Prompt hash | Isolation contract |
| --- | --- | --- |
| `character/fighter/portrait` | `f749da45350da7a2d069cb5b8ffdaab2815268dc558c3e8c43563189912c9b6c` | civilian boxing athlete, sport wraps, no weapon/military equipment |
| `character/engineer/portrait` | `77e02599e4b4798ff6d4668b26423bc37c6b1c7bfe7a2a5def2b48d2cdb52934` | civilian repair technician, small tool belt, no weapon/military equipment |
| `character/medic/portrait` | `63d01e7c952da6d1bec5d7880afdcd828e7a5cb10acf2defd677e6e4f0f8ea7c` | civilian emergency medical responder, medical pouch, no weapon/combat armor |
| `zone/hospital/background` | `353318f2797b0593a8bec11680868fde783f8e89a7c7b6836dc775f79a6efd06` | environment-only, zero humans/silhouettes |
| `item/medkit/icon` | `84113d1cd4fe9f11cb1ab27adb529fca4c32fbf57532588384235824b59c5fbd` | one isolated medkit object, separate from bandage |
| `world_event/rain/illustration` | `734d1a097d3a94f9c624e469b0601a4c2a2ffb87c406edc656159ab57ff82254` | rain event environment-only, zero people/weapons/HUD |

The first three character calls were made serially. All three generated images showed clear rifle/tactical/military contamination, reaching the stop threshold. Hospital, Medkit, and Rain were therefore intentionally not called. All generated B1 candidates remain pending.
