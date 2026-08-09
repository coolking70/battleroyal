# Phase 4A-4.5.1 Hash Semantics

The three identifiers are intentionally independent:

```text
candidateHash
= immutable Candidate identifier

promptHash
= SHA256(canonical generation input)

contentHash
= SHA256(exact raw image bytes)

cache key
= promptHash / generation-input hash
```

`candidateHash` does not imply `contentHash` and does not imply `promptHash`, even when a legacy first Candidate ID happens to equal the prompt hash. Duplicate Candidates may use `<promptHash>-<timestamp>` as their immutable ID. They can share a promptHash and still have different contentHash values when their image bytes differ.

The canonical generation input remains `promptHashInput(built)`, serialized deterministically and hashed with lower-case SHA-256. Cache lookup and prompt reports use `generationInputHash(built)`.

`contentHash` is computed only by `sha256Bytes(Buffer)` over the bytes written to Candidate/cache/public files. It is never computed from base64 text, file paths, prompts, JSON metadata, dimensions or provider response JSON.
