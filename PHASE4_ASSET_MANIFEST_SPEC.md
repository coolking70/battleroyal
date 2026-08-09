# Phase 4 Asset Manifest Specification

The runtime schema remains version `1`:

```json
{
  "version": 1,
  "characters": { "scout": { "portrait": null, "injured": null, "combat": null } },
  "zones": { "school": { "background": null, "warning": null, "restricted": null } },
  "items": { "bandage": null },
  "worldEvents": { "blackout": null }
}
```

Only browser-local `/assets/...` paths are allowed. Manifest entries never contain model, provider, prompt, cache paths, file-system paths, or secrets. `art:publish` updates only approved candidates and validates all referenced files before the atomic tree swap. The companion `public/assets/art-version.json` records the pipeline version, publish time, manifest hash, and task revision.

The runtime reads the manifest once and uses official → SVG → emoji fallback. An official 404 cannot mutate the manifest or call the provider. Character status selects `portrait` or `injured` at HP ≤ 35%; combat, zone warning/restricted, and effects slots remain available for later phases.
