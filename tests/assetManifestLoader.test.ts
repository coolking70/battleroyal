import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadAssetManifest,
  parseAssetManifest,
} from '../src/ui/assetManifestLoader';
import {
  getAssetManifest,
  getCharacterVisual,
  setAssetManifest,
} from '../src/ui/visualAssets';

const validManifest = {
  version: 1,
  characters: { scout: { portrait: '/assets/test/scout.svg' } },
  zones: { school: { background: null } },
  items: { bandage: '/assets/items/bandage.svg' },
  worldEvents: { rain: null },
};

afterEach(() => {
  setAssetManifest(null);
  vi.unstubAllGlobals();
});

describe('正式 Asset Manifest loader', () => {
  it('200 + 合法 schema 会写入运行时注册表', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => validManifest }));
    const loaded = await loadAssetManifest();
    expect(loaded?.version).toBe(1);
    expect(getAssetManifest()).toEqual(validManifest);
    expect(getCharacterVisual('scout').image).toBe('/assets/test/scout.svg');
  });

  it('404 会清空注册表并安全返回 null', async () => {
    setAssetManifest(validManifest);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    expect(await loadAssetManifest()).toBeNull();
    expect(getAssetManifest()).toBeNull();
  });

  it('网络失败与非法 JSON 都不会阻断启动', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await loadAssetManifest()).toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => { throw new Error('bad json'); },
    }));
    expect(await loadAssetManifest()).toBeNull();
  });

  it('错误版本、错误根结构和危险路径都会被拒绝', () => {
    expect(parseAssetManifest({ ...validManifest, version: 2 })).toBeNull();
    expect(parseAssetManifest({ ...validManifest, characters: [] })).toBeNull();
    expect(parseAssetManifest({
      ...validManifest,
      items: { bandage: 'https://evil.example/bandage.svg' },
    })).toBeNull();
    expect(parseAssetManifest({
      ...validManifest,
      items: { bandage: 'javascript:alert(1)' },
    })).toBeNull();
  });

  it('Manifest 只允许本地 /assets 路径，所有四类入口都可被 loader 提供', () => {
    const parsed = parseAssetManifest(validManifest);
    expect(parsed).not.toBeNull();
    expect(parsed?.characters.scout?.portrait).toBe('/assets/test/scout.svg');
    expect(parsed?.zones.school?.background).toBeNull();
    expect(parsed?.items.bandage).toBe('/assets/items/bandage.svg');
    expect(parsed?.worldEvents.rain).toBeNull();
  });

  it('即使测试注入了危险路径，visual getter 也不会把它交给 UI', () => {
    setAssetManifest({
      ...validManifest,
      characters: { scout: { portrait: 'data:text/html,pwned' } },
    });
    expect(getCharacterVisual('scout').image).toBe('characters/scout.svg');
  });
});
