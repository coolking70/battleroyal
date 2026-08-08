import fs from 'node:fs/promises';
import path from 'node:path';
import type { ArtConfig, ArtReviewRecord, CandidateMetadata } from './types';

async function walkMetadata(dir: string): Promise<CandidateMetadata[]> {
  const output: CandidateMetadata[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return output;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) output.push(...(await walkMetadata(fullPath)));
    else if (entry.name.endsWith('.json') && entry.name !== 'reviews.json') {
      try {
        output.push(JSON.parse(await fs.readFile(fullPath, 'utf8')) as CandidateMetadata);
      } catch {
        // A malformed candidate is reported by art:list rather than crashing the whole CLI.
      }
    }
  }
  return output;
}

export async function listCandidates(config: ArtConfig): Promise<CandidateMetadata[]> {
  return walkMetadata(config.candidateDir);
}

async function readReviews(config: ArtConfig): Promise<ArtReviewRecord[]> {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(config.reviewsPath, 'utf8'));
    return Array.isArray(parsed) ? (parsed as ArtReviewRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeReviews(config: ArtConfig, records: ArtReviewRecord[]): Promise<void> {
  await fs.mkdir(path.dirname(config.reviewsPath), { recursive: true });
  await fs.writeFile(config.reviewsPath, JSON.stringify(records, null, 2));
}

export async function reviewCandidate(
  config: ArtConfig,
  taskId: string,
  candidateHash: string,
  status: 'approved' | 'rejected',
  reason?: string,
): Promise<CandidateMetadata> {
  const candidates = await listCandidates(config);
  const candidate = candidates.find((item) => item.taskId === taskId && item.hash === candidateHash);
  if (!candidate) throw new Error(`candidate not found: ${taskId} / ${candidateHash}`);
  if (status === 'approved' && candidate.validationStatus !== 'passed') {
    throw new Error('cannot approve a candidate whose automatic validation failed');
  }
  const metadataPath = path.join(config.rootDir, candidate.imagePath.replace(/\.[^.]+$/, '.json'));
  candidate.reviewStatus = status;
  if (reason) candidate.reviewReason = reason;
  await fs.writeFile(metadataPath, JSON.stringify(candidate, null, 2));
  const reviews = await readReviews(config);
  reviews.push({ taskId, candidateHash, status, ...(reason ? { reason } : {}), reviewedAt: new Date().toISOString() });
  await writeReviews(config, reviews);
  return candidate;
}
