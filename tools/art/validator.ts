import fs from 'node:fs/promises';
import path from 'node:path';
import type { ArtConfig, ArtManifest, ArtTask, ValidationResult } from './types';

const SUPPORTED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MAX_DIMENSION = 8192;

export interface ImageInspection {
  mimeType: string;
  width: number;
  height: number;
  alpha: boolean;
}

export function inspectImageBytes(bytes: Buffer): ImageInspection | null {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.length >= 26) {
    return {
      mimeType: 'image/png',
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
      alpha: bytes[25] === 4 || bytes[25] === 6,
    };
  }
  if (bytes.subarray(0, 6).toString('ascii') === 'GIF89a' || bytes.subarray(0, 6).toString('ascii') === 'GIF87a') {
    return { mimeType: 'image/gif', width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8), alpha: false };
  }
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') {
    const kind = bytes.subarray(12, 16).toString('ascii');
    if (kind === 'VP8X' && bytes.length >= 30) {
      const width = 1 + bytes[24]! + (bytes[25]! << 8) + (bytes[26]! << 16);
      const height = 1 + bytes[27]! + (bytes[28]! << 8) + (bytes[29]! << 16);
      return { mimeType: 'image/webp', width, height, alpha: (bytes[20]! & 0x10) !== 0 };
    }
    if (kind === 'VP8 ' && bytes.length >= 30) {
      return { mimeType: 'image/webp', width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff, alpha: false };
    }
    if (kind === 'VP8L' && bytes.length >= 25) {
      const bits = bytes.readUInt32LE(21);
      return { mimeType: 'image/webp', width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff), alpha: true };
    }
  }
  if (bytes.subarray(0, 2).equals(Buffer.from([255, 216]))) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1]!;
      offset += 2;
      if (marker === 0xd8 || marker === 0xd9) continue;
      const length = bytes.readUInt16BE(offset);
      if (marker >= 0xc0 && marker <= 0xc3) {
        return { mimeType: 'image/jpeg', height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5), alpha: false };
      }
      offset += length;
    }
  }
  return null;
}

export function validateImageBytes(
  bytes: Buffer,
  task: Pick<ArtTask, 'category' | 'width' | 'height' | 'alphaRequired'>,
): ValidationResult {
  const errors: string[] = [];
  if (bytes.byteLength < 100) errors.push('file is smaller than 100 bytes');
  const info = inspectImageBytes(bytes);
  if (!info) {
    return { status: 'failed', mimeType: null, actualWidth: null, actualHeight: null, errors: [...errors, 'unsupported or undecodable image'] };
  }
  if (!SUPPORTED_MIME.has(info.mimeType)) errors.push(`unsupported MIME: ${info.mimeType}`);
  if (info.width < 1 || info.height < 1) errors.push('image dimensions must be positive');
  if (info.width > MAX_DIMENSION || info.height > MAX_DIMENSION) errors.push(`image dimensions exceed ${MAX_DIMENSION}px safety limit`);
  const expectedRatio = task.width / task.height;
  const actualRatio = info.width / info.height;
  if (Math.abs(actualRatio - expectedRatio) / expectedRatio > 0.05) errors.push(`aspect ratio ${actualRatio.toFixed(4)} exceeds 5% tolerance`);
  const floor = resolutionFloor(task.category);
  if (info.width < floor.width || info.height < floor.height) errors.push(`actual resolution ${info.width}x${info.height} is below ${floor.width}x${floor.height} floor`);
  if (task.alphaRequired && !info.alpha) errors.push('transparent alpha channel is required');
  return {
    status: errors.length === 0 ? 'passed' : 'failed',
    mimeType: info.mimeType,
    actualWidth: info.width,
    actualHeight: info.height,
    errors,
  };
}

function resolutionFloor(category: ArtTask['category']): { width: number; height: number } {
  switch (category) {
    case 'character': return { width: 700, height: 900 };
    case 'zone': return { width: 1000, height: 550 };
    case 'item': return { width: 512, height: 512 };
    case 'world_event': return { width: 700, height: 390 };
  }
}

export function isSafePublishedPath(value: string): boolean {
  return value.startsWith('/assets/') && !value.includes('..') && !value.includes('\\') && !value.includes('//');
}

function slotShape(value: unknown, slots: string[]): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([key, entry]) => slots.includes(key) && (entry === null || (typeof entry === 'string' && isSafePublishedPath(entry))));
}

export async function validateManifest(config: ArtConfig, manifest: ArtManifest): Promise<string[]> {
  const errors: string[] = [];
  if (manifest.version !== 1) errors.push('manifest version must remain 1');
  if (!manifest.characters || typeof manifest.characters !== 'object' || !Object.values(manifest.characters).every((value) => slotShape(value, ['portrait', 'injured', 'combat']))) errors.push('invalid character slots');
  if (!manifest.zones || typeof manifest.zones !== 'object' || !Object.values(manifest.zones).every((value) => slotShape(value, ['background', 'warning', 'restricted']))) errors.push('invalid zone slots');
  for (const [kind, entries] of [['items', manifest.items], ['worldEvents', manifest.worldEvents]] as const) {
    for (const [id, value] of Object.entries(entries ?? {})) {
      if (value !== null && (!isSafePublishedPath(value) || !(await fileExists(path.join(config.publicAssetsDir, value.slice('/assets/'.length)))))) {
        errors.push(`${kind}.${id} references a missing or unsafe file`);
      }
    }
  }
  for (const [kind, entries, slots] of [
    ['characters', manifest.characters, ['portrait', 'injured', 'combat']],
    ['zones', manifest.zones, ['background', 'warning', 'restricted']],
  ] as const) {
    for (const [id, values] of Object.entries(entries ?? {})) {
      if (!slotShape(values, [...slots])) {
        errors.push(`${kind}.${id} has invalid slot values`);
        continue;
      }
      for (const [slot, value] of Object.entries(values)) {
        if (typeof value === 'string' && !(await fileExists(path.join(config.publicAssetsDir, value.slice('/assets/'.length))))) {
          errors.push(`${kind}.${id}.${slot} references a missing file`);
        }
      }
    }
  }
  return errors;
}

export async function validateImageFile(filePath: string, task: ArtTask): Promise<ValidationResult> {
  try {
    const bytes = await fs.readFile(filePath);
    return validateImageBytes(bytes, task);
  } catch {
    return { status: 'failed', mimeType: null, actualWidth: null, actualHeight: null, errors: ['file does not exist or is unreadable'] };
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
