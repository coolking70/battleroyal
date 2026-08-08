import { ArtPipelineError, type ArtConfig, type ImageGenerationRequest, type ImageGenerationResult, type ProviderCapabilities } from '../types';
import { requireApiKey } from '../config';

export const AGNES_CAPABILITIES: ProviderCapabilities = {
  nativeNegativePrompt: false,
  exactDimensions: false,
  aspectRatio: true,
  base64Output: true,
  urlOutput: true,
};

export interface AgnesRequestBody {
  model: string;
  prompt: string;
  size: '1K';
  ratio: string;
  return_base64: true;
}

export function ratioForDimensions(width: number, height: number): string {
  const ratio = width / height;
  if (Math.abs(ratio - 3 / 4) < 0.04) return '3:4';
  if (Math.abs(ratio - 16 / 9) < 0.04) return '16:9';
  if (Math.abs(ratio - 1) < 0.04) return '1:1';
  return `${width}:${height}`;
}

export function agnesRequestFor(request: ImageGenerationRequest): AgnesRequestBody {
  const negative = request.negativePrompt?.trim();
  const prompt = negative ? `${request.prompt}\n\nAvoid: ${negative}` : request.prompt;
  return {
    model: request.model,
    prompt,
    size: '1K',
    ratio: request.requestedRatio ?? ratioForDimensions(request.width, request.height),
    return_base64: true,
  };
}

function mimeFromBytes(bytes: Buffer): string | null {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return 'image/jpeg';
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (bytes.subarray(0, 6).toString('ascii') === 'GIF89a' || bytes.subarray(0, 6).toString('ascii') === 'GIF87a') return 'image/gif';
  return null;
}

function decodeBase64(value: string): { mimeType: string | null; bytes: Buffer } {
  const match = value.match(/^data:([^;,]+);base64,(.+)$/s);
  const bytes = Buffer.from(match ? match[2] : value, 'base64');
  return { mimeType: match?.[1] ?? mimeFromBytes(bytes), bytes };
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function errorForStatus(status: number, message: string) {
  if (status === 401 || status === 403) return { category: 'auth' as const, retryable: false, status, message };
  if (status === 429) return { category: 'rate_limit' as const, retryable: true, status, message };
  return { category: 'provider' as const, retryable: status === 502 || status === 503 || status >= 500, status, message };
}

async function parseAgnesResponse(response: Response, fetchImpl: typeof fetch, config: ArtConfig): Promise<ImageGenerationResult> {
  const raw = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new ArtPipelineError({ category: 'invalid_response', retryable: false, status: response.status, message: 'Agnes returned non-JSON response.' });
  }
  if (!response.ok) {
    const error = body && typeof body === 'object' && 'error' in body && typeof body.error === 'object' && body.error
      ? String((body.error as Record<string, unknown>).message ?? 'Agnes request failed')
      : `Agnes request failed with HTTP ${response.status}`;
    throw new ArtPipelineError(errorForStatus(response.status, error.slice(0, 300)));
  }
  const record = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const data = Array.isArray(record.data) ? record.data[0] : record;
  const item = data && typeof data === 'object' ? data as Record<string, unknown> : {};
  const base64 = stringField(item.b64_json) ?? stringField(item.base64) ?? stringField(item.image);
  const remoteUrl = stringField(item.url) ?? stringField(record.url);
  const providerRequestId = stringField(item.id) ?? stringField(record.id) ?? response.headers.get('x-request-id') ?? undefined;
  const revisedPrompt = stringField(item.revised_prompt) ?? stringField(record.revised_prompt) ?? undefined;
  if (base64) {
    const decoded = decodeBase64(base64);
    const mimeType = decoded.mimeType ?? response.headers.get('content-type')?.split(';')[0] ?? null;
    if (!mimeType?.startsWith('image/')) throw new ArtPipelineError({ category: 'invalid_response', retryable: false, message: 'Agnes base64 response has no supported image MIME type.' });
    return { mimeType, bytes: decoded.bytes, providerRequestId, revisedPrompt };
  }
  if (remoteUrl) {
    let downloaded: Response;
    try {
      downloaded = await fetchImpl(remoteUrl, { signal: AbortSignal.timeout(config.requestTimeoutMs) });
    } catch {
      throw new ArtPipelineError({ category: 'download', retryable: true, message: 'Failed to download Agnes image URL.' });
    }
    if (!downloaded.ok) throw new ArtPipelineError({ category: 'download', retryable: downloaded.status >= 500, status: downloaded.status, message: `Failed to download Agnes image (HTTP ${downloaded.status}).` });
    const bytes = Buffer.from(await downloaded.arrayBuffer());
    const mimeType = mimeFromBytes(bytes) ?? downloaded.headers.get('content-type')?.split(';')[0] ?? null;
    if (!mimeType?.startsWith('image/')) throw new ArtPipelineError({ category: 'invalid_response', retryable: false, message: 'Agnes URL response is not an image.' });
    return { mimeType, bytes, providerRequestId, revisedPrompt };
  }
  throw new ArtPipelineError({ category: 'invalid_response', retryable: false, message: 'Agnes response has neither base64 image data nor URL.' });
}

export const agnesProvider = {
  name: 'agnes' as const,
  capabilities: AGNES_CAPABILITIES,
  async generate(config: ArtConfig, request: ImageGenerationRequest, fetchImpl: typeof fetch = fetch): Promise<ImageGenerationResult> {
    const apiKey = requireApiKey(config);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
    try {
      const body = agnesRequestFor(request);
      if (process.env.IMAGE_API_DEBUG_REQUEST === '1') {
        console.log(JSON.stringify({ url: config.baseUrl, model: body.model, size: body.size, ratio: body.ratio, return_base64: body.return_base64, promptLength: body.prompt.length }));
      }
      let response: Response;
      try {
        response = await fetchImpl(config.baseUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (error) {
        const message = error instanceof DOMException && error.name === 'AbortError' ? 'Agnes request timed out.' : 'Network error while calling Agnes.';
        throw new ArtPipelineError({ category: 'network', retryable: true, message });
      }
      return await parseAgnesResponse(response, fetchImpl, config);
    } finally {
      clearTimeout(timeout);
    }
  },
};

export type AgnesProvider = typeof agnesProvider;
