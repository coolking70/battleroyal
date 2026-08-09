/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { VisualImage } from '../src/ui/components/VisualImage';
import type { VisualSpec } from '../src/ui/visualAssets';

let root: Root;
let container: HTMLDivElement;

const official: VisualSpec = {
  emoji: '🔭',
  color: '#2f6f8f',
  label: '侦察员',
  image: '/assets/characters/scout/portrait.webp',
  fallbackImage: 'characters/scout.svg',
  source: 'official',
};

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(visual: VisualSpec): void {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(<VisualImage visual={visual} alt="测试视觉" className="visual-test" />);
  });
}

function update(visual: VisualSpec): void {
  act(() => {
    root.render(<VisualImage visual={visual} alt="测试视觉" className="visual-test" />);
  });
}

function expectLocalSvg(src: string | null | undefined, assetPath: string): void {
  expect(src).toBeTruthy();
  // Vite 5 emits a URL while Vite 8 may inline small SVGs as data URLs; both
  // are the same local SVG fallback and neither is the official raster asset.
  expect(src?.includes(assetPath) || src?.startsWith('data:image/svg+xml')).toBe(true);
}

describe('VisualImage 三级 fallback', () => {
  it('正式图片成功时只渲染正式图片', () => {
    render(official);
    const image = container.querySelector('img');
    expect(image?.getAttribute('src')).toBe('/assets/characters/scout/portrait.webp');
    expect(container.textContent).not.toContain('🔭');
  });

  it('正式图片失败后只降级到 SVG，不重试正式图', async () => {
    render(official);
    const first = container.querySelector('img');
    await act(async () => {
      first?.dispatchEvent(new Event('error'));
    });
    const fallback = container.querySelector('img');
    expectLocalSvg(fallback?.getAttribute('src'), 'characters/scout.svg');
    expect(fallback?.getAttribute('src')).not.toContain('portrait.webp');
  });

  it('SVG 失败后降级到 emoji，且不再保留 broken img', async () => {
    render(official);
    await act(async () => {
      container.querySelector('img')?.dispatchEvent(new Event('error'));
    });
    await act(async () => {
      container.querySelector('img')?.dispatchEvent(new Event('error'));
    });
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('🔭');
  });

  it('没有任何图片时直接显示 emoji fallback', () => {
    render({ emoji: '🧪', color: '#3f8f7a', label: '测试', image: null, source: 'emoji' });
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('🧪');
  });

  it('official 失败后切换到新资源时会重新尝试新资源的 official 图片', async () => {
    render(official);
    await act(async () => {
      container.querySelector('img')?.dispatchEvent(new Event('error'));
    });
    expectLocalSvg(container.querySelector('img')?.getAttribute('src'), 'characters/scout.svg');

    const next: VisualSpec = {
      emoji: '🧪',
      color: '#3f8f7a',
      label: '研究所',
      image: '/assets/zones/lab/background.webp',
      fallbackImage: 'zones/lab.svg',
      source: 'official',
    };
    update(next);
    await act(async () => Promise.resolve());
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      '/assets/zones/lab/background.webp',
    );
  });

  it('emoji 阶段切换到带 official 图片的新资源时会恢复图片阶段', async () => {
    render(official);
    await act(async () => {
      container.querySelector('img')?.dispatchEvent(new Event('error'));
    });
    await act(async () => {
      container.querySelector('img')?.dispatchEvent(new Event('error'));
    });
    expect(container.querySelector('img')).toBeNull();

    update({
      emoji: '🧪',
      color: '#3f8f7a',
      label: '研究所',
      image: '/assets/zones/lab/background.webp',
      fallbackImage: 'zones/lab.svg',
      source: 'official',
    });
    await act(async () => Promise.resolve());
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      '/assets/zones/lab/background.webp',
    );
  });
});
