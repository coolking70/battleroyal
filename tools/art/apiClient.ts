import { ArtPipelineError, type ArtConfig, type GenerationError, type ImageGenerationRequest, type ImageGenerationResult } from './types';
import { requireApiKey } from './config';

type FetchLike = typeof fetch;

function errorForStatus(status: number, message: string): GenerationError {
  if (status === 401 || status === 403) return { category: 'auth', retryable: false, status, message };
  if (status === 429) return { category: 'rate_limit', retryable: true, status, message };
  return {
    category: 'provider',
    retryable: status === 502 || status === 503 || status >= 500,
    status,
    message,
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

async function parseResponse(response: Response, fetchImpl: FetchLike, config: ArtConfig): Promise<ImageGenerationResult> {
  const raw = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new ArtPipelineError({
      category: 'invalid_response',
      retryable: false,
      status: response.status,
      message: 'Image provider returned non-JSON response.',
    });
  }
  if (!response.ok) {
    const providerMessage =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'object' && body.error
        ? String((body.error as Record<string, unknown>).message ?? 'provider request failed')
        : `provider request failed with HTTP ${response.status}`;
    throw new ArtPipelineError(errorForStatus(response.status, providerMessage.slice(0, 300)));
  }

  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const data = Array.isArray(record.data) ? record.data[0] : record;
  const item = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const base64 = stringField(item.b64_json) ?? stringField(item.base64) ?? stringField(item.image);
  const remoteUrl = stringField(item.url) ?? stringField(record.url);
  const providerRequestId =
    stringField(item.id) ?? stringField(record.id) ?? response.headers.get('x-request-id') ?? undefined;
  const revisedPrompt = stringField(item.revised_prompt) ?? stringField(record.revised_prompt) ?? undefined;

  if (base64) {
    const decoded = decodeBase64(base64);
    const mimeType = decoded.mimeType ?? response.headers.get('content-type')?.split(';')[0] ?? null;
    if (!mimeType?.startsWith('image/')) {
      throw new ArtPipelineError({
        category: 'invalid_response',
        retryable: false,
        message: 'Image provider returned base64 data without a supported image MIME type.',
      });
    }
    return { mimeType, bytes: decoded.bytes, providerRequestId, revisedPrompt };
  }

  if (remoteUrl) {
    let downloaded: Response;
    try {
      downloaded = await fetchImpl(remoteUrl, { signal: AbortSignal.timeout(config.requestTimeoutMs) });
    } catch {
      throw new ArtPipelineError({ category: 'download', retryable: true, message: 'Failed to download generated image.' });
    }
    if (!downloaded.ok) {
      throw new ArtPipelineError({
        category: 'download',
        retryable: downloaded.status === 502 || downloaded.status === 503 || downloaded.status >= 500,
        status: downloaded.status,
        message: `Failed to download generated image (HTTP ${downloaded.status}).`,
      });
    }
    const bytes = Buffer.from(await downloaded.arrayBuffer());
    const mimeType = mimeFromBytes(bytes) ?? downloaded.headers.get('content-type')?.split(';')[0] ?? null;
    if (!mimeType?.startsWith('image/')) {
      throw new ArtPipelineError({ category: 'invalid_response', retryable: false, message: 'Downloaded result is not an image.' });
    }
    return { mimeType, bytes, providerRequestId, revisedPrompt };
  }

  throw new ArtPipelineError({
    category: 'invalid_response',
    retryable: false,
    message: 'Image provider response contained neither base64 image data nor a URL.',
  });
}

export async function generateImage(
  config: ArtConfig,
  request: ImageGenerationRequest,
  fetchImpl: FetchLike = fetch,
): Promise<ImageGenerationResult> {
  const apiKey = requireApiKey(config);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  try {
    let response: Response;
    try {
      response = await fetchImpl(config.baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          prompt: request.prompt,
          negative_prompt: request.negativePrompt,
          size: `${request.width}x${request.height}`,
          width: request.width,
          height: request.height,
          response_format: 'b64_json',
          n: 1,
          ...(request.seed === undefined ? {} : { seed: request.seed }),
        }),
        signal: controller.signal,
      });
    } catch (error) {
      const message = error instanceof DOMException && error.name === 'AbortError' ? 'Image provider request timed out.' : 'Network error while calling image provider.';
      throw new ArtPipelineError({ category: 'network', retryable: true, message });
    }
    return await parseResponse(response, fetchImpl, config);
  } finally {
    clearTimeout(timeout);
  }
}
