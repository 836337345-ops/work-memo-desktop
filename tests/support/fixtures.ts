import type { Category, ItemInput, WorkItem } from '../../src/types';

export const QA_NOW = '2026-09-06T09:00:00.000Z';

export const qaCategories: Category[] = [
  { id: 'cat-promotion', name: '推广', sortOrder: 0 },
  { id: 'cat-event', name: '活动', sortOrder: 1 },
  { id: 'cat-package', name: '包装', sortOrder: 2 },
];

export const launchInput: ItemInput = {
  title: '秋季新盘样板间开放推广',
  content: '协调海报、渠道物料与到访动线。',
  categoryId: 'cat-promotion',
  dueDate: '2026-09-14',
  status: 'doing',
  notes: '只使用虚构的地产推广事项作为测试数据。',
  followUps: [{ id: 'follow-1', text: '确认渠道海报尺寸', done: false }],
};

export const launchItem: WorkItem = {
  ...launchInput,
  id: 'item-autumn-launch',
  createdAt: QA_NOW,
  updatedAt: QA_NOW,
  deletedAt: null,
  progress: [{ id: 'progress-1', content: '已收集三家渠道的物料清单。', createdAt: QA_NOW }],
};

export const itemInput = (overrides: Partial<ItemInput> = {}): ItemInput => ({
  ...launchInput,
  followUps: launchInput.followUps.map((followUp) => ({ ...followUp })),
  ...overrides,
});
