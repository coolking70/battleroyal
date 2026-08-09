# Phase 4A-2.2 Provider Prompt Audit

Audit target: the exact `body.prompt` assembled by `agnesRequestFor`, with the Agnes negative prompt field represented by an empty value and therefore no synthetic `Avoid:` suffix.

| Task | Strategy | Revision | Preflight hash | Forbidden token count | Result |
| --- | --- | ---: | --- | ---: | --- |
| `zone/hospital/background` | `environment-positive-only` | 2 | `1d7b9c89ce95e5738c4b43d7c1828d5df806ba58b07d7e919a357728def475b5` | 0 | PASS |
| `item/medkit/icon` | `item-positive-only-unmarked` | 2 | `56c73dde328a31f004dc449e0d1e1ac4af0d1f0b616de6906eca99757b5f829d` | 0 | PASS |
| `world_event/rain/illustration` | `environment-positive-only` | 2 | `871d1b146011fb7747ca52665d9a152992c87d1a343f23d21807259b506ae95c` | 0 | PASS |

## Token policies

- Hospital/Rain forbidden environment tokens: `person`, `people`, `human`, `character`, `survivor`, `patient`, `doctor`, `nurse`, `pedestrian`, `crowd`, `silhouette`.
- Medkit forbidden marking tokens: `cross`, `logo`, `emblem`, `symbol`, `brand`, `red cross`.
- Reports and review README files may mention these review terms; the audit applies only to the provider-facing prompt body.

## Positive anchors

- Hospital: `vacant medical waiting hall`, `completely empty waiting chairs`, `unattended diagnostic machines`, `closed reception windows`.
- Rain: `deserted rain-soaked city street`, `empty sidewalks`, `heavy rainstorm`, `large puddles`.
- Medkit: `portable emergency supply case`, `off-white hard shell`, `muted green accent panels`, `plain blank front surfaces`.

Offline payload-capture tests verify that the actual Agnes request body equals the built prompt and contains zero forbidden tokens for each of the three tasks.
