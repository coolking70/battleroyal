# Phase 4 Review and Publish Spec

## Candidate lifecycle

Every generated candidate starts as `pending`. Automatic validation must pass before approval. A reviewer can mark a candidate `approved` or `rejected`; approving a newer candidate for the same task marks the previous active approval `superseded`. There is exactly one active approved candidate per task.

The candidate metadata retains task id, candidate/content/prompt hashes, provider/model, requested and actual dimensions, requested ratio, actual MIME type, validation result, source, and review timestamps/reason.

## Approved provenance

`art/approved-assets.json` is the committed provenance record. It maps each task to the approved candidate hash, content hash, prompt hash, provider, model, approval time, and public path. Publishing never infers approval from an image file alone.

## Publish transaction

`art:publish` selects only passed, active approvals. It rejects duplicate active approvals, stages a complete public asset tree, copies approved images, validates the staged manifest, writes `manifest.json` and `art-version.json`, then swaps the tree. The old public tree is retained in the archive after success. If the swap or provenance replacement fails, the old tree and provenance are restored and the operation fails.

Publishing is idempotent: an unchanged manifest/provenance returns `NO CHANGES` and preserves `publishedAt`. With no approved candidates it performs no filesystem mutation.
