import type { ArtConfig, ImageGenerationRequest, ImageGenerationResult, ProviderCapabilities, ProviderName } from '../types';

export interface ImageProvider {
  readonly name: ProviderName;
  readonly capabilities: ProviderCapabilities;
  generate(
    config: ArtConfig,
    request: ImageGenerationRequest,
    fetchImpl?: typeof fetch,
  ): Promise<ImageGenerationResult>;
}
