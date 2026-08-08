import { useState } from 'react';
import type { VisualSpec } from '../visualAssets';

interface VisualImageProps {
  visual: VisualSpec;
  alt: string;
  className?: string;
  role?: string;
}

type ImageStage = 'primary' | 'fallback' | 'emoji';

const localAssetUrls = import.meta.glob('../assets/**/*.svg', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

/**
 * 统一的正式图 → 本地 SVG → emoji 三级降级组件。
 * onError 只沿状态机向前推进，不会重新尝试已经失败的地址。
 */
export function VisualImage({ visual, alt, className, role }: VisualImageProps): JSX.Element {
  const [stage, setStage] = useState<ImageStage>(visual.image ? 'primary' : 'emoji');
  const fallback = visual.fallbackImage ?? null;
  const image = stage === 'fallback' ? fallback : stage === 'primary' ? visual.image : null;

  if (!image) {
    return (
      <span
        className={className}
        role={role}
        aria-label={alt}
        title={alt}
        style={{ color: visual.color }}
      >
        {visual.emoji}
      </span>
    );
  }

  const src = image.startsWith('/')
    ? image
    : localAssetUrls[`../assets/${image}`] ?? `/src/ui/assets/${image}`;
  return (
    <img
      className={className}
      src={src}
      alt={alt}
      role={role}
      onError={() => {
        if (stage === 'primary' && fallback) setStage('fallback');
        else setStage('emoji');
      }}
    />
  );
}
