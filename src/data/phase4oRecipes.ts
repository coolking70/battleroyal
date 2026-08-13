import type { Recipe } from '../core/types';

export const PHASE4O_RECIPES: Recipe[] = [
  {
    id: 'r_extraction_beacon',
    name: '撤离信标',
    ingredients: [{ itemId: 'battery_pack', count: 1 }, { itemId: 'reinforced_frame', count: 1 }],
    outputItemId: 'extraction_beacon',
    outputCount: 1,
    description: '为转发器加上承重框架，组成可携带信标。',
  },
  {
    id: 'r_anomaly_sample',
    name: '异常样本',
    ingredients: [{ itemId: 'bio_resin', count: 1 }, { itemId: 'research_notes', count: 1 }],
    outputItemId: 'anomaly_sample',
    outputCount: 1,
    description: '依据研究笔记封存一份野外生化树脂。',
  },
  {
    id: 'r_stabilized_sample',
    name: '稳定样本',
    ingredients: [{ itemId: 'anomaly_sample', count: 1 }, { itemId: 'chemical_mix', count: 1 }],
    outputItemId: 'stabilized_sample',
    outputCount: 1,
    description: '用药剂混合物稳定异常样本。',
  },
  {
    id: 'r_research_package',
    name: '研究成果包',
    ingredients: [{ itemId: 'stabilized_sample', count: 1 }, { itemId: 'research_notes', count: 1 }, { itemId: 'circuit', count: 1 }],
    outputItemId: 'research_package',
    outputCount: 1,
    description: '完成封装并整理出可在研究所提交的成果包。',
  },
];
