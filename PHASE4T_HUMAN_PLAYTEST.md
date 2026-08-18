# Phase 4T Human Playtest

- Status: **NEEDS-HUMAN-PLAYTEST**
- Branch: `agent/phase4t-localized-incidents-opportunities`
- Draft PR: see `HANDOFF-TO-AUDITOR-PHASE4T.md`
- Automated tests do not replace this visible-behavior review.

## Setup

Play a normal game (try several seeds; the schedule is seed-derived so
different seeds give different local opportunities). Use `?debug=1` only when
a checklist item asks for last-known cognition or incident runtime evidence.
Record the seed, character, time, incident, and PASS/FAIL for every item.

The four incidents are: `factory_salvage` (工厂 · LOCAL), `hospital_emergency`
(医院 · PUBLIC), `underground_maintenance` (地下 · LOCAL), `lab_containment`
(研究所 · PUBLIC, 高风险).

## Checklist

1. **局内确实会出现动态 local opportunity。** Run several seeds and confirm
   that at least one incident activates within a match, that the activation
   time varies across seeds, and that the opportunity is genuinely local
   (tied to a specific zone), not a global modifier.
2. **事件不会感觉像传统「接任务」。** Confirm there is no quest log, no
   quest giver, no accept button, and no journal. The incident is something
   the world broadcasts or that you stumble into, and it ends by itself.
3. **Public incident 信息足够但不过度泄密。** After a `INCIDENT_ACTIVATED`
   broadcast (医院急诊窗口 / 研究所封堵失败), confirm the log and the
   「局部动态」panel tell you the incident name, zone, and coarse state —
   but never the remaining reward count, overlay charges, or who has already
   used it.
4. **Local-only incident 不会让远程 NPC 像开图。** In debug mode, watch a
   LOCAL incident (机修车间紧急抢救 / 地下维护窗口) stay completely absent
   from remote NPCs' incident memory until they physically enter the zone.
5. **Stale memory 行为看起来合理。** Learn an incident as active, leave the
   zone, and have it resolved/expired elsewhere (or wait for expiry). Confirm
   your panel keeps showing the last-known 「进行中」 until you legally
   revisit the zone or hear the public resolution, then it updates.
6. **NPC 不会因事件不断来回改目标。** In debug mode, find an NPC with a
   `respond_to_incident` intent and watch several turns. Confirm the intent
   type/target and `committedAt` stay stable while the incident remains
   active, and that the intent cleanly ends after resolution/expiry.
7. **两个角色争同一个 finite opportunity 不会复制奖励。** Watch (or force
   via debug position changes before the autonomous turn) two contestants
   reach the same reward incident. Confirm only the finite stacks exist, the
   second claim after exhaustion fails, and no duplicated item appears in
   either inventory.
8. **Expiry 后 UI/interaction 正常关闭.** After an incident expires, confirm
   the RESOLVE button disappears (or is disabled with a reason), searching
   the overridden landmark is locked again, and the overlay facility no
   longer offers extra charges.
9. **Terminal 后 incident 不继续变化.** Let the match end while an incident
   is ACTIVE. In debug mode, confirm the incident runtime, actor incident
   memory, and any incident intent are all frozen afterwards.
10. **Debug inspector 与 normal UI 完全隔离.** Confirm the
    `Incident runtime` / `Actor incident memory` sections exist only with
    `?debug=1`; the normal game shows only the coarse 「局部动态」 panel and
    never another actor's memory, intent, claims, or contention counters.

## Result record

| Item | Seed / time / incident | Result | Notes |
| --- | --- | --- | --- |
| 1 |  | PENDING |  |
| 2 |  | PENDING |  |
| 3 |  | PENDING |  |
| 4 |  | PENDING |  |
| 5 |  | PENDING |  |
| 6 |  | PENDING |  |
| 7 |  | PENDING |  |
| 8 |  | PENDING |  |
| 9 |  | PENDING |  |
| 10 |  | PENDING |  |

Final human status remains **NEEDS-HUMAN-PLAYTEST** until a human records all
ten results.
