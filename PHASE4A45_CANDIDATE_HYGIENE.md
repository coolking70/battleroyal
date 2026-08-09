# Phase 4A-4.5 Candidate Hygiene

The read-only audit found 54 candidate metadata records:

| Status | Count |
| --- | ---: |
| approved | 35 |
| pending | 10 |
| rejected | 9 |

All 35 current approved hashes are the unique provenance sources referenced by the 35 official Manifest entries. Pending and rejected historical candidates share task public-path conventions but their hashes are not current provenance sources; therefore they do not leak into the Manifest. No candidate files were deleted.

The rejected Scout Combat v1 and v2 hashes remain present and rejected:

- `80109ee0510cc4132aa26518dfa1d37d59b0ebb4df5daddc57e1a88bb6fed7c1`
- `752052e828e7708ebc010457bb9eca11e718a7ec91e18e63dd8b133ad11f6159`

Other pending candidates are classified per task in the machine-readable [candidate hygiene report](reports/phase4a45-candidate-hygiene.json); unresolved pending items remain pending rather than being guessed as rejected.
