import { percent } from '../../utils/format';

interface BarProps {
  value: number;
  max: number;
  kind: 'hp' | 'stamina';
}

/** 生命 / 体力条 */
export function Bar({ value, max, kind }: BarProps): JSX.Element {
  const ratio = max > 0 ? value / max : 0;
  const low = ratio > 0 && ratio < 0.3;
  return (
    <div className={`bar bar-${kind}${low ? ' is-low' : ''}`} role="presentation">
      <i style={{ width: `${percent(value, max)}%` }} />
    </div>
  );
}
