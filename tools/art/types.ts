import type { Stats } from 'node:fs';

export type ArtCategory = 'character' | 'zone' | 'item' | 'world_event';
export type ArtTaskStatus = 'planned' | 'generated' | 'approved' | 'rejected';
export type ValidationStatus = 'passed' | 'failed';
export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'superseded';
export type ProviderName = 'agnes';

export interface ProviderCapabilities {
  nativeNegativePrompt: boolean;
  exactDimensions: boolean;
  aspectRatio: boolean;
  base64Output: boolean;
  urlOutput: boolean;
}

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
  hardConstraints?: string[];
  avoid?: string[];
}

export interface BuiltPrompt {
  task: ArtTask;
  prompt: string;
  negativePrompt: string;
  model: string;
  width: number;
  height: number;
  requestedRatio: string;
  styleProfileVersion: string;
  sections: {
    renderStyle: string;
    categoryStyle: string;
    entityBrief: string;
    variant: string;
    hardConstraints: string;
    avoid: string;
  };
}

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  model: string;
  requestedRatio?: string;
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
  actualWidth: number | null;
  actualHeight: number | null;
  errors: string[];
}

export interface CandidateMetadata {
  taskId: string;
  hash: string;
  contentHash: string;
  promptHash: string;
  provider: ProviderName;
  model: string;
  generatedAt: string;
  requestedWidth: number;
  requestedHeight: number;
  requestedRatio: string;
  actualWidth: number;
  actualHeight: number;
  prompt: string;
  negativePrompt: string;
  styleProfileVersion: string;
  mimeType: string;
  actualMimeType: string;
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

export interface ApprovedAssetProvenance {
  candidateHash: string;
  contentHash: string;
  promptHash: string;
  model: string;
  provider: ProviderName;
  approvedAt: string;
  publicPath: string;
}

export interface ApprovedAssetsFile {
  version: 1;
  assets: Record<string, ApprovedAssetProvenance>;
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
  approvedAssetsPath: string;
  reviewsPath: string;
  requestTimeoutMs: number;
}

export interface ImageFileInfo extends Stats {
  path: string;
}
