import { describe, expect, it } from 'vitest';
import { filterItems, isOverdue } from '../../src/lib/filters';
import { emptyItem, STATUS_LABELS, type WorkItem } from '../../src/types';

const makeItem = (overrides: Partial<WorkItem>): WorkItem => ({
  id: 'v28-item',
  title: 'V2.8 虚构验收事项',
  content: '仅用于隔离测试。',
  categoryId: null,
  dueDate: '2026-09-07',
  status: 'doing',
  notes: '',
  followUps: [],
  progress: [],
  createdAt: '2026-09-01T09:00:00.000Z',
  updatedAt: '2026-09-01T09:00:00.000Z',
  deletedAt: null,
  ...overrides,
});

describe('V2.8 状态公共契约', () => {
  it('新事项默认进行中，公开状态不再包含待开展', () => {
    expect(emptyItem().status).toBe('doing');
    expect(STATUS_LABELS).toEqual({ doing: '进行中', done: '已完成', paused: '已暂停' });
    expect(STATUS_LABELS).not.toHaveProperty('todo');
  });

  it('逾期只适用于截止日期早于今天的进行中事项', () => {
    const today = '2026-09-08';
    expect(isOverdue(makeItem({ status: 'doing' }), today)).toBe(true);
    expect(isOverdue(makeItem({ status: 'done' }), today)).toBe(false);
    expect(isOverdue(makeItem({ status: 'paused' }), today)).toBe(false);
    expect(isOverdue(makeItem({ status: 'doing', dueDate: '2026-09-08' }), today)).toBe(false);
  });

  it('进行中筛选不会混入已完成或已暂停事项', () => {
    const items = [
      makeItem({ id: 'doing', status: 'doing' }),
      makeItem({ id: 'done', status: 'done' }),
      makeItem({ id: 'paused', status: 'paused' }),
    ];
    expect(filterItems(items, { status: 'doing', dateFilter: 'all' }).map((item) => item.id)).toEqual(['doing']);
  });
});
