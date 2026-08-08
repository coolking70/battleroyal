# Phase 4 Audit Fixes

| ID | Finding | Resolution |
| --- | --- | --- |
| P4-P0-01 | Medic NPC still used bleeding as an independent emergency-treatment trigger. | Trigger now requires HP below 60% and a healing consumable; DoT alone is not sufficient. |
| P4-P0-02 | VisualImage could retain fallback/emoji stage across resource changes. | `useEffect` resets the stage when image, fallback, or emoji identity changes. |
| P4-SEC-01 | Provider credentials could accidentally cross into the browser boundary. | API adapter is isolated under `tools/art`, reads only `process.env.IMAGE_API_KEY`, and uses no `VITE_` secret. |
| P4-CACHE-01 | Repeated identical art jobs could spend provider quota again. | Stable prompt/task/model/style SHA-256 content hash and local cache provide cache hits. |
| P4-REVIEW-01 | Generated images could be mistaken for human-approved art. | Candidate metadata separates automatic validation from explicit review status. |
| P4-PUBLISH-01 | Unreviewed candidates could enter formal runtime assets. | Publisher accepts only validation-passed and review-approved candidates and validates the staged manifest. |
