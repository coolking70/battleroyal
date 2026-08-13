import type { ItemDef } from '../core/types';

/** Research notes are a world-source raw material, never a starting grant. */
export const PHASE4O_RESEARCH_RAW_IDS = ['research_notes'] as const;

export const PHASE4O_ITEMS: ItemDef[] = [
  {
    id: 'research_notes',
    name: '研究笔记',
    category: 'material',
    craftTier: 'raw',
    description: '研究所与医院遗留的实验记录，记载着异常样本的处理方法。',
    value: 10,
    stackable: true,
    maxStack: 5,
  },
  {
    id: 'extraction_beacon',
    name: '撤离信标',
    category: 'objective',
    craftTier: 'final',
    description: '在车站启动后能召来撤离窗口的信标。',
    value: 45,
    stackable: true,
    maxStack: 2,
  },
  {
    id: 'anomaly_sample',
    name: '异常样本',
    category: 'component',
    craftTier: 'component',
    description: '以野外生化树脂为核心封存的未稳定样本。',
    value: 25,
    stackable: true,
    maxStack: 5,
  },
  {
    id: 'stabilized_sample',
    name: '稳定样本',
    category: 'component',
    craftTier: 'component',
    description: '完成初步稳定化处理、可安全交付的样本。',
    value: 38,
    stackable: true,
    maxStack: 5,
  },
  {
    id: 'research_package',
    name: '研究成果包',
    category: 'objective',
    craftTier: 'final',
    description: '把异常样本、研究笔记与电路封装成可提交的成果。',
    value: 62,
    stackable: true,
    maxStack: 2,
  },
];
