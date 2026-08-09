import fs from 'node:fs/promises';
import path from 'node:path';
import type { ArtConfig, BuiltPrompt, ImageGenerationResult } from './types';
import { sha256Bytes } from './hash';
import { validateImageBytes } from './validator';

export interface CacheEntry {
  hash: string;
  imagePath: string;
  metadataPath: string;
  mimeType: string;
  bytes: number;
  actualWidth: number;
  actualHeight: number;
}

function extensionForMime(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  return 'jpg';
}

export async function findCacheEntry(config: ArtConfig, hash: string, built?: BuiltPrompt): Promise<CacheEntry | null> {
  const dir = path.join(config.cacheDir, hash);
  try {
    const metadata = JSON.parse(await fs.readFile(path.join(dir, 'metadata.json'), 'utf8')) as {
      hash?: string;
      contentHash?: string;
      mimeType?: string;
      bytes?: number;
      requestedWidth?: number;
      requestedHeight?: number;
      requestedRatio?: string;
      actualWidth?: number;
      actualHeight?: number;
    };
    const entries = await fs.readdir(dir);
    const imageName = entries.find((entry) => entry.startsWith('image.'));
    if (!imageName || typeof metadata.mimeType !== 'string') return null;
    const imagePath = path.join(dir, imageName);
    const bytes = await fs.readFile(imagePath);
    if (!built || metadata.requestedWidth === undefined) return null;
    const validation = validateImageBytes(bytes, built.task);
    if (validation.status !== 'passed' || metadata.hash !== hash || metadata.contentHash !== sha256Bytes(bytes) || metadata.requestedWidth !== built.width || metadata.requestedHeight !== built.height || metadata.requestedRatio !== built.requestedRatio || metadata.mimeType !== validation.mimeType || metadata.actualWidth !== validation.actualWidth || metadata.actualHeight !== validation.actualHeight || metadata.bytes !== bytes.byteLength) return null;
    return {
      hash,
      imagePath,
      metadataPath: path.join(dir, 'metadata.json'),
      mimeType: metadata.mimeType,
      bytes: bytes.byteLength,
      actualWidth: validation.actualWidth!,
      actualHeight: validation.actualHeight!,
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
  const validation = validateImageBytes(result.bytes, built.task);
  const actualMimeType = validation.mimeType ?? result.mimeType;
  const imageName = `image.${extensionForMime(actualMimeType)}`;
  const imagePath = path.join(dir, imageName);
  for (const entry of await fs.readdir(dir)) {
    if (entry.startsWith('image.')) await fs.rm(path.join(dir, entry), { force: true });
  }
  await fs.writeFile(imagePath, result.bytes);
  const metadataPath = path.join(dir, 'metadata.json');
  await fs.writeFile(
    metadataPath,
    JSON.stringify(
      {
        hash,
        taskId: built.task.id,
        model: built.model,
        requestedWidth: built.width,
        requestedHeight: built.height,
        requestedRatio: built.requestedRatio,
        actualWidth: validation.actualWidth,
        actualHeight: validation.actualHeight,
        contentHash: sha256Bytes(result.bytes),
        prompt: built.prompt,
        negativePrompt: built.negativePrompt,
        styleProfileVersion: built.styleProfileVersion,
        mimeType: actualMimeType,
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
    mimeType: actualMimeType,
    bytes: result.bytes.byteLength,
    actualWidth: validation.actualWidth ?? 0,
    actualHeight: validation.actualHeight ?? 0,
  };
}

export { extensionForMime };
