import { isSafeAssetPath, setAssetManifest, type AssetManifest } from './visualAssets';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAssetValue(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && isSafeAssetPath(value));
}

function isSlotMap(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return Object.values(value).every((entry) => isAssetValue(entry));
}

function isCharacterOrZoneMap(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return Object.values(value).every((entry) => isSlotMap(entry));
}

/** 最小 Manifest schema 校验；非法资产只会触发 fallback，不会阻断游戏启动。 */
export function parseAssetManifest(value: unknown): AssetManifest | null {
  if (!isRecord(value) || value.version !== 1) return null;
  if (!isCharacterOrZoneMap(value.characters)) return null;
  if (!isCharacterOrZoneMap(value.zones)) return null;
  if (!isRecord(value.items) || !Object.values(value.items).every(isAssetValue)) return null;
  if (!isRecord(value.worldEvents) || !Object.values(value.worldEvents).every(isAssetValue)) return null;
  return value as unknown as AssetManifest;
}

/** 启动时加载正式资产；404、网络错误、坏 JSON、坏 schema 均安全降级。 */
export async function loadAssetManifest(): Promise<AssetManifest | null> {
  setAssetManifest(null);
  try {
    const response = await fetch('/assets/manifest.json');
    if (!response.ok) return null;
    const parsed = parseAssetManifest(await response.json());
    if (!parsed) return null;
    setAssetManifest(parsed);
    return parsed;
  } catch {
    return null;
  }
}
