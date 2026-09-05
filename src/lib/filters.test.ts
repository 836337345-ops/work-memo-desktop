import { describe, expect, it } from 'vitest';
import { filterItems, isOverdue, matchesDateFilter, sortByDueDate } from './filters';
import type { WorkItem } from '../types';

const item = (dueDate: string | null, status: WorkItem['status'] = 'todo', createdAt = '2026-01-01T00:00:00Z'): WorkItem => ({
  id: dueDate ?? 'none', title: '测试', content: '', categoryId: null, dueDate, status, notes: '', followUps: [], progress: [], createdAt, updatedAt: createdAt, deletedAt: null,
});

describe('日期筛选', () => {
  it('以星期一开始计算本周和下周，并包含边界日期', () => {
    expect(matchesDateFilter(item('2026-09-07'), 'thisWeek', '2026-09-13')).toBe(true);
    expect(matchesDateFilter(item('2026-09-13'), 'thisWeek', '2026-09-13')).toBe(true);
    expect(matchesDateFilter(item('2026-09-14'), 'thisWeek', '2026-09-13')).toBe(false);
    expect(matchesDateFilter(item('2026-09-14'), 'nextWeek', '2026-09-13')).toBe(true);
  });

  it('逾期不包含已完成或暂停事项，且自定义日期包含边界', () => {
    expect(matchesDateFilter(item('2026-09-12'), 'overdue', '2026-09-13')).toBe(true);
    expect(matchesDateFilter(item('2026-09-12', 'done'), 'overdue', '2026-09-13')).toBe(false);
    expect(matchesDateFilter(item('2026-09-10'), 'custom', '2026-09-13', '2026-09-10', '2026-09-12')).toBe(true);
  });

  it('空日期排在最后，同日期按创建时间倒序', () => {
    const sorted = sortByDueDate([item(null), item('2026-09-14', 'todo', '2026-01-01T00:00:00Z'), item('2026-09-14', 'todo', '2026-02-01T00:00:00Z'), item('2026-09-13')]);
    expect(sorted.map((entry) => entry.dueDate)).toEqual(['2026-09-13', '2026-09-14', '2026-09-14', null]);
    expect(sorted[1].createdAt).toBe('2026-02-01T00:00:00Z');
  });

  it('可组合分类、状态与日期条件', () => {
    const matched = item('2026-09-13', 'doing'); matched.categoryId = 'promotion';
    const wrongStatus = item('2026-09-13', 'todo'); wrongStatus.categoryId = 'promotion';
    const wrongCategory = item('2026-09-13', 'doing'); wrongCategory.categoryId = 'package';
    expect(filterItems([matched, wrongStatus, wrongCategory], { dateFilter: 'today', categoryId: 'promotion', status: 'doing', today: '2026-09-13' })).toEqual([matched]);
  });

  it('仅待开展和进行中的过期事项显示为逾期', () => {
    expect(isOverdue(item('2026-09-12', 'todo'), '2026-09-13')).toBe(true);
    expect(isOverdue(item('2026-09-12', 'doing'), '2026-09-13')).toBe(true);
    expect(isOverdue(item('2026-09-12', 'done'), '2026-09-13')).toBe(false);
    expect(isOverdue(item('2026-09-12', 'paused'), '2026-09-13')).toBe(false);
  });
});
