import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ArtConfig, BuiltPrompt, ImageGenerationResult } from './types';
import { promptHashInput } from './promptBuilder';

export interface CacheEntry {
  hash: string;
  imagePath: string;
  metadataPath: string;
  mimeType: string;
  bytes: number;
}

function extensionForMime(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  return 'jpg';
}

export function contentHash(built: BuiltPrompt): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(promptHashInput(built)))
    .digest('hex');
}

export async function findCacheEntry(config: ArtConfig, hash: string): Promise<CacheEntry | null> {
  const dir = path.join(config.cacheDir, hash);
  try {
    const metadata = JSON.parse(await fs.readFile(path.join(dir, 'metadata.json'), 'utf8')) as {
      mimeType?: string;
      bytes?: number;
    };
    const entries = await fs.readdir(dir);
    const imageName = entries.find((entry) => entry.startsWith('image.'));
    if (!imageName || typeof metadata.mimeType !== 'string') return null;
    return {
      hash,
      imagePath: path.join(dir, imageName),
      metadataPath: path.join(dir, 'metadata.json'),
      mimeType: metadata.mimeType,
      bytes: metadata.bytes ?? (await fs.stat(path.join(dir, imageName))).size,
    };
  } catch {
    return null;
  }
}

export async function saveCache(
  config: ArtConfig,
  hash: string,
  built: BuiltPrompt,
  result: ImageGenerationResult,
): Promise<CacheEntry> {
  const dir = path.join(config.cacheDir, hash);
  await fs.mkdir(dir, { recursive: true });
  const imageName = `image.${extensionForMime(result.mimeType)}`;
  const imagePath = path.join(dir, imageName);
  await fs.writeFile(imagePath, result.bytes);
  const metadataPath = path.join(dir, 'metadata.json');
  await fs.writeFile(
    metadataPath,
    JSON.stringify(
      {
        hash,
        taskId: built.task.id,
        model: built.model,
        width: built.width,
        height: built.height,
        prompt: built.prompt,
        negativePrompt: built.negativePrompt,
        styleProfileVersion: built.styleProfileVersion,
        mimeType: result.mimeType,
        bytes: result.bytes.byteLength,
        providerRequestId: result.providerRequestId,
        revisedPrompt: result.revisedPrompt,
      },
      null,
      2,
    ),
  );
  return {
    hash,
    imagePath,
    metadataPath,
    mimeType: result.mimeType,
    bytes: result.bytes.byteLength,
  };
}

export { extensionForMime };
