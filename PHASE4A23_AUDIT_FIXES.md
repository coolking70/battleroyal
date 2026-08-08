# Phase 4A-2.3 Audit Fixes

- Added `environment-positive-only` and `item-positive-only` prompt strategies.
- Positive-only provider payloads use an empty `negativePrompt` and do not append `AVOID` blocks.
- Zone positive prompts use affirmative vacant-scene semantics without person tokens or `ZERO PEOPLE` wording.
- Item positive prompts describe only a generic isolated object and avoid category pollution, branding and readable text.
- Rain recovery uses a dedicated audit that rejects abandoned/disaster/danger narrative wording.
- Prompt audit routing was corrected so generic item tasks are not checked by the character audit.
- Prompt report routing and review export naming now cover the Phase 4A-2.3 B2 and Rain paths.
- Hash inputs remain explicit and stable; the historical Medkit positive-only hash input is preserved.
- No gameplay, save, combat, NPC, crafting or simulation rules were changed.

All six B2 prompt audits passed with zero forbidden-token findings. Rain's revised prompt also passed the local audit; the remaining block is the provider response, not a local prompt-audit failure.
