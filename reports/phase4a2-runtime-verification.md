# Phase 4A-2 Runtime Verification

## Manifest-driven source selection

| Runtime lookup | Expected source | Result |
| --- | --- | --- |
| `getCharacterVisual('scout')` | official | PASS |
| `getZoneVisual('school')` | official | PASS |
| `getItemVisual('bandage')` | official | PASS |
| `getWorldEventVisual('blackout')` | local SVG fallback because no official slot exists | PASS |

The published Manifest points only to the three approved Round A paths. Blackout is not published.

## Failure fallback

The existing `VisualImage` contract and tests verify:

1. An official image is rendered when available.
2. An official image error switches once to the local SVG.
3. A subsequent SVG error removes the broken image and renders the emoji fallback.

## Automated coverage

The Phase 4A-2 closure suite covers the official/fallback mix, exact three-slot Manifest/provenance closure, Blackout non-publication, B1 task/prompt isolation, and Blackout v5 composition locks. The full test suite target is at least 670 tests.
