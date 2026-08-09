import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createArtConfig } from '../tools/art/config';
import { agnesRequestFor, AGNES_CAPABILITIES, ratioForDimensions } from '../tools/art/providers/agnes';
import { generateImage } from '../tools/art/apiClient';

const fixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'agnes-success-base64.json');

describe('Agnes provider contract', () => {
  it('declares the provider capability boundary', () => {
    expect(AGNES_CAPABILITIES).toEqual({
      nativeNegativePrompt: false,
      exactDimensions: false,
      aspectRatio: true,
      base64Output: true,
      urlOutput: true,
    });
  });

  it.each([
    [768, 1024, '3:4'],
    [1536, 864, '16:9'],
    [512, 512, '1:1'],
  ])('maps %sx%s to provider ratio %s', (width, height, ratio) => {
    expect(ratioForDimensions(width, height)).toBe(ratio);
  });

  it('sends Agnes minimal request body and rejects legacy unsupported top-level fields', async () => {
    const fixture = await fs.readFile(fixturePath, 'utf8');
    const config = createArtConfig(process.cwd(), { IMAGE_API_KEY: 'test-secret', IMAGE_API_MODEL: 'agnes-image-2.1-flash' });
    let requestUrl = '';
    let requestInit: RequestInit | undefined;
    const result = await generateImage(config, {
      model: 'agnes-image-2.1-flash',
      prompt: 'urban survival scout',
      negativePrompt: 'text, watermark',
      width: 768,
      height: 1024,
      requestedRatio: '3:4',
    }, async (input, init) => {
      requestUrl = String(input);
      requestInit = init;
      return new Response(fixture, { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const body = JSON.parse(String(requestInit?.body)) as Record<string, unknown>;
    expect(requestUrl).toBe(config.baseUrl);
    expect(requestInit?.method).toBe('POST');
    expect((requestInit?.headers as Record<string, string>).Authorization).toBe('Bearer test-secret');
    expect(body).toMatchObject({ model: 'agnes-image-2.1-flash', size: '1K', ratio: '3:4', return_base64: true });
    expect(String(body.prompt)).toContain('Avoid: text, watermark');
    expect(body).not.toHaveProperty('response_format');
    expect(body).not.toHaveProperty('negative_prompt');
    expect(body).not.toHaveProperty('width');
    expect(body).not.toHaveProperty('height');
    expect(body).not.toHaveProperty('n');
    expect(result.mimeType).toBe('image/png');
    expect(result.bytes.byteLength).toBeGreaterThan(100);
  });

  it('builds the same minimal request body directly for contract inspection', () => {
    expect(agnesRequestFor({ model: 'agnes-image-2.1-flash', prompt: 'x', width: 1536, height: 864 })).toEqual({
      model: 'agnes-image-2.1-flash',
      prompt: 'x',
      size: '1K',
      ratio: '16:9',
      return_base64: true,
    });
  });

  it('keeps a non-standard requested ratio explicit instead of inventing dimensions', () => {
    expect(agnesRequestFor({ model: 'm', prompt: 'x', width: 4, height: 3 })).toMatchObject({ ratio: '4:3', size: '1K' });
  });

  it('does not add an empty negative prompt to the provider prompt', () => {
    expect(agnesRequestFor({ model: 'm', prompt: 'x', negativePrompt: '  ', width: 1, height: 1 }).prompt).toBe('x');
  });

  it.each(['base64', 'image'] as const)('parses Agnes %s payload fields', async (field) => {
    const fixture = await fs.readFile(fixturePath, 'utf8');
    const config = createArtConfig(process.cwd(), { IMAGE_API_KEY: 'test-secret' });
    const result = await generateImage(config, { model: config.model, prompt: 'x', width: 512, height: 512 }, async () => {
      return new Response(JSON.stringify({ data: [{ [field]: JSON.parse(fixture).data[0].b64_json }] }), { status: 200 });
    });
    expect(result.mimeType).toBe('image/png');
  });

  it('reports a missing API key before making a request', async () => {
    const config = createArtConfig(process.cwd(), {});
    await expect(generateImage(config, { model: config.model, prompt: 'x', width: 1, height: 1 }, async () => new Response('{}'))).rejects.toThrow('IMAGE_API_KEY');
  });

  it('classifies a structured Agnes auth error without leaking credentials', async () => {
    const config = createArtConfig(process.cwd(), { IMAGE_API_KEY: 'test-secret' });
    await expect(generateImage(config, { model: config.model, prompt: 'x', width: 1, height: 1 }, async () => new Response(JSON.stringify({ error: { message: 'invalid token sk-secret' } }), { status: 401 }))).rejects.toMatchObject({ details: { category: 'auth', retryable: false, status: 401 } });
  });
});
