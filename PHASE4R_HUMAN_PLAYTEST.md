# Phase 4R Human Playtest

Status: **NEEDS-HUMAN-PLAYTEST**

This checklist is intentionally not an automated acceptance claim. It covers
the visible local-access explanations and the four representative chains.

## Desktop exploration

- [ ] Start a new game and move to Factory.
- [ ] Confirm the Assembly Line is visibly locked and shows a public hint that
      the Machine Shop must be activated first.
- [ ] Use the Machine Shop through the visible formal interaction.
- [ ] Confirm the unlock feedback appears and the Assembly Line becomes
      searchable without exposing hidden exact loot.
- [ ] Search the Assembly Line and confirm the result is finite and immediate.

## Tool and material semantics

- [ ] In Underground, verify the Service Room explains its wire requirement.
- [ ] With two wire units in one stack, use the Service Room once and confirm
      exactly one unit remains.
- [ ] Confirm the Sealed Passage becomes available after the repair.
- [ ] In Laboratory, provide a field kit, repair the Analysis Terminal, and
      confirm the field kit remains available afterward.

## Local discovery chain

- [ ] In Residential, search the Basement Storage first.
- [ ] Confirm the Apartment Block changes from locked to searchable only after
      that discovery.
- [ ] Confirm no remote zone shows exact hidden loot or private depletion.

## NPC observation

- [ ] Observe an NPC with a committed craft goal route toward a locked local
      source.
- [ ] Confirm the NPC performs visible movement and formal search/interaction
      actions rather than teleporting or receiving debug grants.
- [ ] If the destination becomes unavailable remotely, confirm the NPC waits or
      takes a legal fallback and does not thrash its objective every turn.

## AF1 information boundary and compatibility

- [ ] From outside Laboratory, toggle/observe no exact remote disabled,
      repaired, charges, last-use, or private facility-event detail in the
      objective, decision, or event presentation; after entering Laboratory,
      confirm local facility state can change the legal action.
- [ ] From outside Factory, confirm Assembly Line's remote objective is the
      same whether its hidden lock runtime is changed; after entering Factory,
      confirm the local lock is authoritative.
- [ ] With an Engineer at Station and no battery, confirm the legacy repair
      interaction remains available and does not invent/consume a battery.
- [ ] With an Engineer at Warehouse and no field kit, confirm the secure-storage
      unlock interaction still remains unavailable.

## Red-line checks

- [ ] Confirm a zero-stamina actor cannot repair, unlock, activate, or search.
- [ ] Confirm a terminal result screen does not advance time or mutate a
      landmark when an interaction is attempted.
- [ ] Confirm existing Apex/Wild behavior remains present and no new boss or
      victory semantics appear in the UI.

## Auditor notes

- [ ] Record browser/device dimensions and seed used.
- [ ] Record any confusing hint, stale status, unexpected route, or visual
      overflow here before independent acceptance.
