# Phase 4A-2.3 Prompt Audit

Audited the exact Agnes request payload prompt after the provider adapter is applied. All seven planned requests have an empty negative prompt and no synthetic `Avoid:` suffix.

| Task | Strategy | Revision | Preflight hash | Forbidden-token result |
| --- | --- | ---: | --- | ---: |
| `world_event/rain/illustration` | `environment-positive-only` | 3 | `1f97bc209fbbc6fc0debdf6675e3959f0d3c355db28f1ca235b5ef31797a2e2d` | 0 |
| `zone/residential/background` | `environment-positive-only` | 1 | `9c5600f64c97a4dbdfb163e93550a86759c57b46a4201e973ae38c72f49f1f84` | 0 |
| `zone/factory/background` | `environment-positive-only` | 1 | `94dc02aa8fef45c1ba2dee0259029e31a3a0f1cd6093417243b9f1c55b9089a4` | 0 |
| `zone/forest/background` | `environment-positive-only` | 1 | `2126353261005efb99059bd7ab230408ab9aa1b3214732f6b20ebd3715951430` | 0 |
| `zone/lab/background` | `environment-positive-only` | 1 | `16eb9bc6cff58880933a81eda9a837678201c672e509656f051d67551f97476e` | 0 |
| `item/water/icon` | `item-positive-only` | 1 | `ea7b7ad47701d18974fe8a5f74f7f8ad29112345573ab570e08c355339c2fa38` | 0 |
| `item/energy_drink/icon` | `item-positive-only` | 1 | `795b221c9804c89f4c9a8098475710d5e95df99d2a83f1f2b6adfe242a5de38b` | 0 |

Environment audits cover person-related tokens. Item audits cover category pollution, UI/scenery contamination and real-brand/label vocabulary. Rain additionally audits disaster and danger narrative vocabulary. Reports may use review language; only provider-facing `body.prompt` is restricted.
