import path from 'node:path';
import type { ArtConfig } from './types';

const DEFAULT_BASE_URL = 'https://apihub.agnes-ai.com/v1/images/generations';
const DEFAULT_MODEL = 'agnes-image-2.1-flash';

export function createArtConfig(rootDir = process.cwd(), env = process.env): ArtConfig {
  const publicAssetsDir = path.join(rootDir, 'public', 'assets');
  return {
    rootDir,
    baseUrl: env.IMAGE_API_BASE_URL?.trim() || DEFAULT_BASE_URL,
    apiKey: env.IMAGE_API_KEY?.trim() || null,
    model: env.IMAGE_API_MODEL?.trim() || DEFAULT_MODEL,
    cacheDir: path.join(rootDir, '.art-cache'),
    candidateDir: path.join(rootDir, 'art', 'candidates'),
    publicAssetsDir,
    manifestPath: path.join(publicAssetsDir, 'manifest.json'),
    approvedAssetsPath: path.join(rootDir, 'art', 'approved-assets.json'),
    reviewsPath: path.join(rootDir, 'art', 'reviews.json'),
    requestTimeoutMs: Number(env.IMAGE_API_TIMEOUT_MS) || 120_000,
  };
}

export function hasUsableApiConfig(config: ArtConfig): boolean {
  return Boolean(config.apiKey && /^https?:\/\//.test(config.baseUrl) && config.model);
}

export function requireApiKey(config: ArtConfig): string {
  if (!config.apiKey) {
    throw new Error('IMAGE_API_KEY is not configured; set it in the local environment only.');
  }
  return config.apiKey;
}
