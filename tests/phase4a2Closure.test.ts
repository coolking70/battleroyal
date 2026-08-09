import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildPrompt } from '../tools/art/promptBuilder';
import { loadTasks } from '../tools/art/taskPlanner';
import { promptPolicyFor } from '../tools/art/promptPolicies';
import {
  getCharacterVisual,
  getItemVisual,
  getWorldEventVisual,
  getZoneVisual,
  setAssetManifest,
  type AssetManifest,
} from '../src/ui/visualAssets';

const B1_TASKS = [
  'character/fighter/portrait',
  'character/engineer/portrait',
  'character/medic/portrait',
  'zone/hospital/background',
  'item/medkit/icon',
  'world_event/rain/illustration',
] as const;

afterEach(() => setAssetManifest(null));

describe('Phase 4A-4 formalization closure', () => {
  it('publishes exactly thirty-five AI slots after remaining Combat formalization', async () => {
    const manifest = JSON.parse(await fs.readFile(path.join(process.cwd(), 'public/assets/manifest.json'), 'utf8')) as AssetManifest;
    expect(manifest.characters.scout?.portrait).toBe('/assets/characters/scout/portrait.png');
    expect(manifest.characters.scout?.injured).toBe('/assets/characters/scout/injured.png');
    expect(manifest.characters.scout?.combat).toBe('/assets/characters/scout/combat.png');
    expect(manifest.characters.fighter?.portrait).toBe('/assets/characters/fighter/portrait.png');
    expect(manifest.characters.engineer?.portrait).toBe('/assets/characters/engineer/portrait.png');
    expect(manifest.characters.medic?.portrait).toBe('/assets/characters/medic/portrait.png');
    expect(manifest.zones.school?.background).toBe('/assets/zones/school/background.png');
    expect(manifest.zones.hospital?.background).toBe('/assets/zones/hospital/background.png');
    expect(manifest.zones.residential?.background).toBe('/assets/zones/residential/background.png');
    expect(manifest.zones.factory?.background).toBe('/assets/zones/factory/background.png');
    expect(manifest.zones.forest?.background).toBe('/assets/zones/forest/background.png');
    expect(manifest.zones.lab?.background).toBe('/assets/zones/lab/background.png');
    expect(manifest.items.bandage).toBe('/assets/items/bandage/icon.png');
    expect(manifest.items.medkit).toBe('/assets/items/medkit/icon.png');
    expect(manifest.items.water).toBe('/assets/items/water/icon.png');
    expect(manifest.items.energy_drink).toBe('/assets/items/energy_drink/icon.png');
    expect(manifest.items.battery).toBe('/assets/items/battery/icon.png');
    expect(manifest.items.iron).toBe('/assets/items/iron/icon.png');
    expect(manifest.items.wood).toBe('/assets/items/wood/icon.png');
    expect(manifest.items.iron_pipe).toBe('/assets/items/iron_pipe/icon.png');
    expect(manifest.items.stone_axe).toBe('/assets/items/stone_axe/icon.png');
    expect(manifest.items.simple_bow).toBe('/assets/items/simple_bow/icon.png');
    expect(manifest.items.simple_armor).toBe('/assets/items/simple_armor/icon.png');
    expect(manifest.items.plate_armor).toBe('/assets/items/plate_armor/icon.png');
    expect(manifest.worldEvents.blackout).toBe('/assets/world-events/blackout/illustration.png');
    expect(manifest.worldEvents.emergency_broadcast).toBe('/assets/world-events/emergency_broadcast/illustration.png');
    expect(manifest.worldEvents.medical_alert).toBe('/assets/world-events/medical_alert/illustration.png');
    expect(manifest.worldEvents.research_anomaly).toBe('/assets/world-events/research_anomaly/illustration.png');
    expect(manifest.worldEvents.citywide_unrest).toBe('/assets/world-events/citywide_unrest/illustration.png');
    expect(Object.values(manifest.characters).flatMap((entry) => Object.values(entry)).filter(Boolean)).toHaveLength(12);
    expect(Object.values(manifest.zones).flatMap((entry) => Object.values(entry)).filter(Boolean)).toHaveLength(6);
    expect(Object.values(manifest.items).filter(Boolean)).toHaveLength(12);
    expect(Object.values(manifest.worldEvents).filter(Boolean)).toHaveLength(5);
  });

  it('keeps provenance limited to the thirty-five approved formal AI tasks', async () => {
    const provenance = JSON.parse(await fs.readFile(path.join(process.cwd(), 'art/approved-assets.json'), 'utf8')) as { assets: Record<string, { candidateHash: string }> };
    expect(Object.keys(provenance.assets).sort()).toEqual([
      'character/engineer/combat',
      'character/engineer/injured',
      'character/engineer/portrait',
      'character/fighter/combat',
      'character/fighter/injured',
      'character/fighter/portrait',
      'character/medic/combat',
      'character/medic/injured',
      'character/medic/portrait',
      'character/scout/combat',
      'character/scout/injured',
      'character/scout/portrait',
      'item/bandage/icon',
      'item/battery/icon',
      'item/energy_drink/icon',
      'item/iron/icon',
      'item/iron_pipe/icon',
      'item/medkit/icon',
      'item/plate_armor/icon',
      'item/simple_armor/icon',
      'item/simple_bow/icon',
      'item/stone_axe/icon',
      'item/water/icon',
      'item/wood/icon',
      'world_event/blackout/illustration',
      'world_event/citywide_unrest/illustration',
      'world_event/emergency_broadcast/illustration',
      'world_event/medical_alert/illustration',
      'world_event/research_anomaly/illustration',
      'zone/factory/background',
      'zone/forest/background',
      'zone/hospital/background',
      'zone/lab/background',
      'zone/residential/background',
      'zone/school/background',
    ]);
    expect(provenance.assets['character/scout/portrait']?.candidateHash).toBe('2cad771df6a1017996e2aa3ef3f1dabc03b0fcb9756c3a005ed86006128093fd');
    expect(provenance.assets['character/scout/injured']?.candidateHash).toBe('ccb0f5d7e17d097f94e60a5109b898f9fc4bbcaf4ac82b74bb296a31f29c1b51');
    expect(provenance.assets['character/fighter/injured']?.candidateHash).toBe('bdfbd88d5ad6b746586decb62227b5f4d92676dbded3ac16c624a1efc7d3e61e');
    expect(provenance.assets['character/engineer/injured']?.candidateHash).toBe('a696243e0873e7e44e352c27721a25e6ff558b5027482beffe89ca95792352d5');
    expect(provenance.assets['character/medic/injured']?.candidateHash).toBe('804ea57b335ffd9b0f8557d3ce81e72e8b6071038aa396c8a244b7f97c8d8154');
    expect(provenance.assets['character/fighter/portrait']?.candidateHash).toBe('33b377a42b0a9a827fed7d3c8701dbe40e70893bc517a6500090a0e1febf8218');
    expect(provenance.assets['character/engineer/portrait']?.candidateHash).toBe('12989865f752e70e7716b2881c3bfa5dbe5546a9c0ec7694705b38be30101979');
    expect(provenance.assets['character/medic/portrait']?.candidateHash).toBe('6a1d891c1597e51d3ea26cab3c63a514994a4ed3d026f3f5f5e675a47eb8ec59');
    expect(provenance.assets['zone/school/background']?.candidateHash).toBe('c475891838381390cf9e837cbf3745971c3e834d95650e5ec98ed8bb29e053c7');
    expect(provenance.assets['item/bandage/icon']?.candidateHash).toBe('3e4d2edadc1b0cd8e2664be2224e1effa663c8fc01d61a170e5f7e4b6c9a09bb');
    expect(provenance.assets['item/medkit/icon']?.candidateHash).toBe('56c73dde328a31f004dc449e0d1e1ac4af0d1f0b616de6906eca99757b5f829d');
    expect(provenance.assets['item/water/icon']?.candidateHash).toBe('ea7b7ad47701d18974fe8a5f74f7f8ad29112345573ab570e08c355339c2fa38');
    expect(provenance.assets['item/energy_drink/icon']?.candidateHash).toBe('795b221c9804c89f4c9a8098475710d5e95df99d2a83f1f2b6adfe242a5de38b');
    expect(provenance.assets['item/battery/icon']?.candidateHash).toBe('1d7473b3470be8f86f43c2b76f21911cc2055153b7d09fa323acf901c42d5ee6');
    expect(provenance.assets['item/iron/icon']?.candidateHash).toBe('d8aa7a6d3643de2ae2bdc3b7c363fbec6f72524eebf69a6ef043a55d3595f68c');
    expect(provenance.assets['item/wood/icon']?.candidateHash).toBe('88c4f10fdf7fb7267746ff391c3e5598df8bf5c08e4a4703fb1a8daeca1d0b56');
    expect(provenance.assets['item/iron_pipe/icon']?.candidateHash).toBe('8d857fea4bd00318942cba3df985a1f7cc014978d9978c6a6acdfe126231c920');
    expect(provenance.assets['item/stone_axe/icon']?.candidateHash).toBe('07749b21843468547d12600a18a8add393e10f983dd3440e7ac528a641ec1d96');
    expect(provenance.assets['item/simple_bow/icon']?.candidateHash).toBe('07db9c7697913d9ac8c24c09b255e6f9d72b54b1ed2df6369ae999a74eea028d');
    expect(provenance.assets['item/simple_armor/icon']?.candidateHash).toBe('e7fb2c86d17c42d4745d3019ab3f188d13591b66dfe46244882cdd6bc2e695e5');
    expect(provenance.assets['item/plate_armor/icon']?.candidateHash).toBe('865f8fc5cdcad4eb81aba4a2e712afb47f0b6c11be75455408c5f7cfcafc0af5');
    expect(provenance.assets['world_event/blackout/illustration']?.candidateHash).toBe('d813c5525288a419335cee2975ce1736f1cd5b49499ae9b05f71ad6a22130843');
    expect(provenance.assets['world_event/emergency_broadcast/illustration']?.candidateHash).toBe('07eed3b78bbf16ae30572b61987dcc498a58e446f421508150b291edcac23787');
    expect(provenance.assets['world_event/medical_alert/illustration']?.candidateHash).toBe('7950c827639922568f0a6f3949145ec60eb812734f847783dc7f3a1e4172c0c1');
    expect(provenance.assets['world_event/research_anomaly/illustration']?.candidateHash).toBe('f5a2bc2592f94510aac588abf30d5435ff6ab8d0fafe0cb3d0e2617df89c18e5');
    expect(provenance.assets['world_event/citywide_unrest/illustration']?.candidateHash).toBe('1c239f17af048a803cebca4ab7e186bcee5cf05843b508531e6c313390a46bde');
    expect(provenance.assets['zone/hospital/background']?.candidateHash).toBe('1d7b9c89ce95e5738c4b43d7c1828d5df806ba58b07d7e919a357728def475b5');
    expect(provenance.assets['zone/residential/background']?.candidateHash).toBe('9c5600f64c97a4dbdfb163e93550a86759c57b46a4201e973ae38c72f49f1f84');
    expect(provenance.assets['zone/factory/background']?.candidateHash).toBe('94dc02aa8fef45c1ba2dee0259029e31a3a0f1cd6093417243b9f1c55b9089a4');
    expect(provenance.assets['zone/forest/background']?.candidateHash).toBe('2126353261005efb99059bd7ab230408ab9aa1b3214732f6b20ebd3715951430');
    expect(provenance.assets['zone/lab/background']?.candidateHash).toBe('16eb9bc6cff58880933a81eda9a837678201c672e509656f051d67551f97476e');
  });

  it('selects all four published character visuals officially', async () => {
    const manifest = JSON.parse(await fs.readFile(path.join(process.cwd(), 'public/assets/manifest.json'), 'utf8')) as AssetManifest;
    setAssetManifest(manifest);
    expect(getCharacterVisual('scout').source).toBe('official');
    expect(getCharacterVisual('fighter').source).toBe('official');
    expect(getCharacterVisual('engineer').source).toBe('official');
    expect(getCharacterVisual('medic').source).toBe('official');
    expect(getZoneVisual('school').source).toBe('official');
    expect(getZoneVisual('hospital').source).toBe('official');
    expect(getZoneVisual('residential').source).toBe('official');
    expect(getZoneVisual('factory').source).toBe('official');
    expect(getZoneVisual('forest').source).toBe('official');
    expect(getZoneVisual('lab').source).toBe('official');
    expect(getItemVisual('bandage').source).toBe('official');
    expect(getItemVisual('medkit').source).toBe('official');
    expect(getItemVisual('water').source).toBe('official');
    expect(getItemVisual('energy_drink').source).toBe('official');
    for (const itemId of ['wood', 'iron', 'stone_axe', 'iron_pipe', 'simple_bow', 'simple_armor', 'plate_armor', 'battery']) {
      expect(getItemVisual(itemId).source).toBe('official');
    }
    expect(getWorldEventVisual('blackout').source).toBe('official');
    expect(getWorldEventVisual('blackout').image).toBe('/assets/world-events/blackout/illustration.png');
    for (const eventId of ['emergency_broadcast', 'medical_alert', 'research_anomaly', 'citywide_unrest'] as const) {
      expect(getWorldEventVisual(eventId).source).toBe('official');
      expect(getWorldEventVisual(eventId).image).toBe(`/assets/world-events/${eventId}/illustration.png`);
    }
    expect(getWorldEventVisual('rain').source).not.toBe('official');
    expect(getWorldEventVisual('rain').image).toBe('events/rain.svg');
  });

  it('falls through from an unavailable official slot to the local SVG source', () => {
    setAssetManifest({ version: 1, characters: { scout: { portrait: 'https://invalid.example/scout.png' } }, zones: {}, items: {}, worldEvents: {} });
    expect(getCharacterVisual('scout').source).toBe('svg');
    expect(getCharacterVisual('scout').image).toBe('characters/scout.svg');
  });
});

describe('Phase 4A-2 controlled Round B1 and Blackout v5 prompts', () => {
  it('contains exactly six B1 first-call tasks and no injured variants', async () => {
    const tasks = await loadTasks(process.cwd());
    expect(B1_TASKS).toHaveLength(6);
    expect(tasks.filter((task) => (B1_TASKS as readonly string[]).includes(task.id))).toHaveLength(6);
    expect(B1_TASKS.some((taskId) => taskId.includes('/injured/'))).toBe(false);
  });

  it.each([
    ['character/fighter/portrait', 'adult amateur boxing athlete', 'boxing wraps'],
    ['character/engineer/portrait', 'workshop repair technician', 'compact tool belt'],
    ['character/medic/portrait', 'community first-aid worker', 'first-aid pouch'],
  ] as const)('isolates %s around a civilian positive identity', async (taskId, descriptor, positiveAnchor) => {
    const task = (await loadTasks(process.cwd())).find((item) => item.id === taskId)!;
    const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    expect(built.sections.entityBrief).toContain(`Provider-facing visual identity: ${descriptor}`);
    expect(built.sections.entityBrief).toContain(positiveAnchor);
    expect(built.sections.entityBrief).not.toMatch(/military|soldier|tactical|combat armor/i);
  });

  it('keeps Hospital on the Phase 4A-2.2 environment-positive-only strategy', async () => {
    const task = (await loadTasks(process.cwd())).find((item) => item.id === 'zone/hospital/background')!;
    expect(task.promptStrategy).toBe('environment-positive-only');
    expect(promptPolicyFor(task).allowPeople).toBe(false);
  });

  it('keeps Medkit on the Phase 4A-2.2 item-positive-only-unmarked strategy', async () => {
    const task = (await loadTasks(process.cwd())).find((item) => item.id === 'item/medkit/icon')!;
    const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    expect(task.entityId).toBe('medkit');
    expect(task.promptStrategy).toBe('item-positive-only-unmarked');
    expect(built.sections.hardConstraints).toContain('single isolated object centered in frame');
    expect(built.sections.entityBrief).toContain('portable emergency supply case');
    expect(built.sections.entityBrief).not.toContain('bandage');
  });

  it('keeps Rain on the Phase 4A-2.3 provider-safe environment-positive-only strategy', async () => {
    const task = (await loadTasks(process.cwd())).find((item) => item.id === 'world_event/rain/illustration')!;
    const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    expect(task.promptStrategy).toBe('environment-positive-only');
    expect(task.revision).toBe(3);
    expect(built.sections.entityBrief).toContain('quiet city street during heavy summer rain');
    expect(built.sections.hardConstraints).toContain('heavy rainfall is the dominant visual texture');
  });

  it('locks Blackout v5 to one dim red beacon and a ceiling-free control-area composition', async () => {
    const task = (await loadTasks(process.cwd())).find((item) => item.id === 'world_event/blackout/illustration')!;
    const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    expect(task.revision).toBe(4);
    expect(built.sections.entityBrief).toContain('electrical control area');
    expect(built.sections.hardConstraints).toContain('ceiling is outside the frame');
    expect(built.sections.hardConstraints).toContain('ZERO CEILING LAMPS VISIBLE');
    expect(built.sections.hardConstraints).toContain('all electrical control panels are dark');
    expect(built.sections.hardConstraints).toContain('exactly one dim red emergency beacon is illuminated');
    expect(built.sections.hardConstraints).toContain('ZERO GREEN LIGHTS');
    expect(built.sections.hardConstraints).toContain('ZERO WHITE NORMAL LIGHTS');
    expect(built.sections.entityBrief).not.toMatch(/rain|weather|street|outdoor/i);
  });
});
