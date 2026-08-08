import { agnesProvider } from './providers/agnes';
import type { ArtConfig, ImageGenerationRequest, ImageGenerationResult } from './types';

export async function generateImage(
  config: ArtConfig,
  request: ImageGenerationRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<ImageGenerationResult> {
  return agnesProvider.generate(config, request, fetchImpl);
}
