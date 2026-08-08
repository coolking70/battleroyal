import type { Stats } from 'node:fs';

export type ArtCategory = 'character' | 'zone' | 'item' | 'world_event';
export type ArtTaskStatus = 'planned' | 'generated' | 'approved' | 'rejected';
export type ValidationStatus = 'passed' | 'failed';
export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface ArtTask {
  id: string;
  category: ArtCategory;
  entityId: string;
  variant: string;
  width: number;
  height: number;
  promptTemplate: string;
  styleProfile: string;
  revision: number;
  status: ArtTaskStatus;
  alphaRequired?: boolean;
}

export interface BuiltPrompt {
  task: ArtTask;
  prompt: string;
  negativePrompt: string;
  model: string;
  width: number;
  height: number;
  styleProfileVersion: string;
}

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  model: string;
  seed?: number;
}

export interface ImageGenerationResult {
  mimeType: string;
  bytes: Buffer;
  providerRequestId?: string;
  revisedPrompt?: string;
}

export type GenerationErrorCategory =
  | 'auth'
  | 'rate_limit'
  | 'provider'
  | 'network'
  | 'invalid_response'
  | 'download';

export interface GenerationError {
  category: GenerationErrorCategory;
  retryable: boolean;
  message: string;
  status?: number;
}

export class ArtPipelineError extends Error {
  readonly details: GenerationError;

  constructor(details: GenerationError) {
    super(details.message);
    this.name = 'ArtPipelineError';
    this.details = details;
  }
}

export interface ValidationResult {
  status: ValidationStatus;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  errors: string[];
}

export interface CandidateMetadata {
  taskId: string;
  hash: string;
  contentHash: string;
  model: string;
  generatedAt: string;
  width: number;
  height: number;
  prompt: string;
  negativePrompt: string;
  styleProfileVersion: string;
  mimeType: string;
  bytes: number;
  imagePath: string;
  publicPath: string;
  validationStatus: ValidationStatus;
  validationErrors: string[];
  reviewStatus: ReviewStatus;
  reviewReason?: string;
  providerRequestId?: string;
  revisedPrompt?: string;
  source: 'api' | 'cache';
}

export interface ArtReviewRecord {
  taskId: string;
  candidateHash: string;
  status: Exclude<ReviewStatus, 'pending'>;
  reason?: string;
  reviewedAt: string;
}

export interface ArtManifest {
  version: 1;
  characters: Record<string, Record<'portrait' | 'injured' | 'combat', string | null>>;
  zones: Record<string, Record<'background' | 'warning' | 'restricted', string | null>>;
  items: Record<string, string | null>;
  worldEvents: Record<string, string | null>;
}

export interface ArtVersion {
  pipelineVersion: 1;
  publishedAt: string;
  manifestHash: string;
  taskRevision: string;
}

export interface ArtConfig {
  rootDir: string;
  baseUrl: string;
  apiKey: string | null;
  model: string;
  cacheDir: string;
  candidateDir: string;
  publicAssetsDir: string;
  manifestPath: string;
  reviewsPath: string;
  requestTimeoutMs: number;
}

export interface ImageFileInfo extends Stats {
  path: string;
}
