# Phase 4A-1 Baseline

- Branch: `agent/phase4-art-pipeline`
- Baseline commit: `59610868f2fbbfc492f4fd5482fda3faecd7a402`
- Pre-Phase4A-1 test count: 610.
- Current implementation state before this phase: Phase 4A-0 infrastructure PASS; published AI assets 0; `art/approved-assets.json` has an empty `assets` object; Manifest still contains the legacy `/assets/items/bandage.svg`.
- Live state reconciliation: the preceding live-provider confirmation already created two pending Scout candidates for one unique task (one `source=api`, one cache verification). This is recorded honestly rather than reset or deleted.
- API status: credential configured only in the local process; manual Agnes verification was working. No key is recorded here.

This phase keeps `src/core/**` and `src/data/**` frozen. The only allowed simulation change is the `--regression` CLI mode, which does not alter game rules.
