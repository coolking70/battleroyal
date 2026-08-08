# Phase 4 Art Pipeline

The production path is deliberately file-based and developer-only:

```text
Task → Prompt → SHA-256 hash → Cache → API → Candidate → Validation → Human Review → Publish → Manifest → Runtime
```

## Security boundary

`tools/art/apiClient.ts` is the only module that sends an image request. It reads `IMAGE_API_KEY` from the Node process environment and never writes the key to source, `public/`, metadata, reports, cache, browser storage, or the manifest. No `VITE_` variable is used. The React application has no import path into `tools/art`.

## Candidate and review state

Generation creates a candidate with `validationStatus` and `reviewStatus: pending`. Automatic validation checks file existence, supported image signature, decodability, dimensions/aspect ratio tolerance, minimum size, and optional alpha. A candidate cannot be approved when validation fails. `art:approve` and `art:reject` are explicit human actions; generation never marks a candidate approved.

## Cache and retry behavior

The SHA-256 input includes task id, final prompt, negative prompt, model, dimensions, revision, and style profile version. A cache hit avoids the provider call. `--force` bypasses the cache and the normal retry schedule is limited to 429, network, 502, and 503 errors. Batch generation is sequential by default, so an interrupted run resumes from existing cache entries.

## Publish behavior

`art:publish` considers only candidates with both `validationStatus=passed` and `reviewStatus=approved`. It stages the complete `public/assets` tree, validates every manifest reference, writes `manifest.json` and `art-version.json`, then swaps the staged directory into place while archiving the previous local tree under ignored `art/archive/`. Unapproved candidates are never written to the formal manifest.

## Commands

```bash
npm run art:doctor -- --offline
npm run art:prompt -- --task character/scout/portrait
npm run art:generate -- --category characters --dry-run
npm run art:list
npm run art:approve -- --task character/scout/portrait --candidate <hash>
npm run art:reject -- --task ... --candidate <hash> --reason "..."
npm run art:publish
npm run art:validate
```

The real provider call is intentionally separate:

```bash
npm run art:generate -- --task character/scout/portrait
```

The key must be supplied in the local environment and is never part of CI.
