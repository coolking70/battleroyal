import crypto from 'node:crypto';
import type { BuiltPrompt } from './types';
import { promptHashInput } from './promptBuilder';

export const HASH_HEX_PATTERN = /^[a-f0-9]{64}$/;

/** SHA-256 over the exact bytes that will be persisted or compared. */
export function sha256Bytes(bytes: Buffer): string {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

/** Stable generation-input hash. This is the cache key and prompt provenance hash. */
export function generationInputHash(built: BuiltPrompt): string {
  return sha256Bytes(Buffer.from(JSON.stringify(promptHashInput(built)), 'utf8'));
}

export function isSha256Hex(value: unknown): value is string {
  return typeof value === 'string' && HASH_HEX_PATTERN.test(value);
}
