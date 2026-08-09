# Phase 4A-2 Audit Fixes

- Formal publish is limited to three explicitly approved Round A tasks; rejected Blackout is not published.
- Provenance and Manifest are checked as a three-slot closure, with the exact candidate hashes preserved.
- Publisher idempotency is covered by a three-asset publish test and the live second-publish `NO CHANGES` result.
- Runtime tests distinguish official, SVG, and emoji sources and cover the official-image failure path.
- Blackout v5 has a revision bump and explicit close control-area, no-ceiling, no-green/white-normal-light, black-display, and one-red-beacon constraints.
- B1 character prompts use civilian provider-facing descriptors and task-specific isolation policies; Hospital remains environment-only and Medkit remains an isolated item.
- Review export accepts an exact report containing intentionally unattempted B1 tasks and exports only the generated pending candidates.
- No API key is stored in source, reports, manifests, or the review packages.
