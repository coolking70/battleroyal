# Phase 4W Report — Optional LLM NPC Roleplay Layer

Branch: `agent/phase4w-optional-llm-npc-layer` (base: `a2dfac7`, main after PR #29)
Draft PR: "Phase 4W: add optional LLM NPC roleplay layer"

## Goal

A fully optional, default-OFF LLM roleplay layer that makes player-visible
NPC reactions feel human — strictly presentation-only:

existing deterministic NPC AI → formal NPC action / visible event →
player-visible sanitized context → optional async LLM flavor line →
presentation.

The LLM never decides gameplay commands, never touches StrategicIntent /
ActorKnowledgeMemory / GameState / RNG / combat numbers / time. Phase 4U's
NPC AI remains the only gameplay authority.

## Architecture

- `src/ui/npcLlm/types.ts` — sanitized context / provider contract / config.
- `src/ui/npcLlm/context.ts` — context built ONLY from player-visible inputs
  (NPC display name, visible zone name, visible encounter beat via Phase 4V
  `EncounterPresentationBeat`, locally witnessed `INCIDENT_CLAIMED`, and a
  personality→tone-hint mapping that never leaks internal labels).
  Includes a stable context fingerprint for stale-response binding.
- `src/ui/npcLlm/provider.ts` — output sanitizer (one ≤60-char Chinese line,
  ≤2 sentences, no Markdown/JSON/system chatter/numeric intel; anything else
  → null → silent fallback) + deterministic mock provider.
- `src/ui/npcLlm/openAiCompatibleProvider.ts` — OpenAI-compatible
  chat-completions adapter; the API key travels only in the Authorization
  header.
- `src/ui/npcLlm/roleplay.ts` — `useNpcRoleplayLine(provider, beatId,
  context)` orchestration hook + memory-only settings store.
- UI: `NpcRoleplaySettings` (menu screen, OFF by default),
  `EncounterHero.roleplayLine` (a small line near the enemy name),
  `GameScreen` wiring that derives the trigger from the latest visible enemy
  beat or a same-zone visible incident contest.

No HTTP anywhere in `src/core/**`; zero new dependencies.

## Privacy boundary

The provider payload contains exactly: npcName, zoneName, trigger,
beatTitle, tone, language. Twin-world test (W-4) proves identical visible
history + divergent hidden HP / inventory / StrategicIntent /
ActorKnowledgeMemory / real position → byte-identical context. W-5 asserts
the serialized payload never contains forbidden fields or any digits.

## Async & stale responses

Requests bind to (beatId, context fingerprint) with `AbortController` and a
4s timeout. Responses landing after the beat/encounter moved on are
discarded (W-7); duplicate calls for the same visible moment are suppressed;
nothing ever blocks player input.

## Secret handling

Default OFF. Endpoint/model/key live only in a browser-memory singleton
store — never localStorage, saves, GameEvents, URLs, rendered text or the
repo; no `VITE_*` baked secrets. Refresh clears the key (by design). W-8
verifies the key appears only in the outbound Authorization header.

## Determinism

Layer lives entirely in `src/ui/**`. OFF ⇒ provider null ⇒ zero remote calls
and gameplay identical to main (W-1). ON ⇒ only React state changes; the
authoritative GameState / formal action trace stay byte-identical for any
mock outputs (W-9).

## Fallback

OFF / no endpoint / no key / timeout / network / HTTP / malformed / empty /
over-long / numeric content → no flavor line, existing Phase 4V presentation
fully intact (W-6).

## Tests

`tests/phase4wLlmRoleplay.test.tsx` — 9 high-value cases:
W-1 OFF zero calls + byte-identical scripted runs; W-2 one sanitized call +
rendered line + no duplicate for the same beat; W-3 hidden/remote events →
zero calls; W-4 twin-world context equality; W-5 no forbidden payload fields
or digits; W-6 failures never touch GameState, formal action proceeds,
sanitizer rejects malformed/overlong/numeric; W-7 stale discard; W-8 key
privacy (save/events/localStorage/DOM/payload/wire); W-9 different mock
texts → identical authoritative state.

## Verification

typecheck PASS; 1790/1790 tests (122 files); build PASS; audit:save PASS;
audit:deps R1–R4 = 0; art:doctor/validate/audit:phase4a PASS;
art:security:browser (277 files) + art:security:repo (1054 files) PASS;
art:generate dry-run OK; 100-game CI quick simulation PASS. No core gameplay
runtime changes ⇒ no 500-game regression required.

## Human browser test items

1. Menu → "实验：NPC 角色扮演（LLM）" defaults OFF; game plays exactly as
   before with zero network calls (devtools network panel empty of LLM
   requests).
2. Enable + fill endpoint/model/key → encounter with a contestant NPC shows
   a short italic reaction line near the enemy name after enemy-side beats
   (start / hit / miss / guard / exposed / flee / resolved).
3. Wild encounters show no LLM line (no personality / tone source).
4. Kill the network or use a bogus endpoint → no line, no error toast,
   combat flow unaffected; key input is type=password and never echoed.
5. Refresh the page → key is gone, setting returns to memory default OFF
   state persistence is intentionally absent.
6. Stale check: end an encounter quickly after a slow endpoint response —
   the old line must not appear on the next opponent.

## Deferred

CORS-hostile endpoints (no backend/proxy this phase), rate limiting,
per-NPC voice memory, tone tuning beyond the static mapping.
