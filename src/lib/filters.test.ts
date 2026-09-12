import { describe, expect, it } from 'vitest';
import { filterItems, isOverdue, matchesDateFilter, sortByDueDate } from './filters';
import type { WorkItem } from '../types';

const item = (dueDate: string | null, status: WorkItem['status'] = 'doing', createdAt = '2026-01-01T00:00:00Z'): WorkItem => ({
  id: dueDate ?? 'none', title: '测试', content: '', categoryId: null, dueDate, status, notes: '', followUps: [], isStarred: false, progress: [], createdAt, updatedAt: createdAt, deletedAt: null,
});

describe('日期筛选', () => {
  it('以星期一开始计算本周和下周，并包含边界日期', () => {
    expect(matchesDateFilter(item('2026-09-07'), 'thisWeek', '2026-09-13')).toBe(true);
    expect(matchesDateFilter(item('2026-09-13'), 'thisWeek', '2026-09-13')).toBe(true);
    expect(matchesDateFilter(item('2026-09-14'), 'thisWeek', '2026-09-13')).toBe(false);
    expect(matchesDateFilter(item('2026-09-14'), 'nextWeek', '2026-09-13')).toBe(true);
  });

  it('逾期不包含已完成或暂停事项', () => {
    expect(matchesDateFilter(item('2026-09-12'), 'overdue', '2026-09-13')).toBe(true);
    expect(matchesDateFilter(item('2026-09-12', 'done'), 'overdue', '2026-09-13')).toBe(false);
    expect(matchesDateFilter(item('2026-09-12', 'paused'), 'overdue', '2026-09-13')).toBe(false);
  });

  it('空日期排在最后，同日期按创建时间倒序', () => {
    const sorted = sortByDueDate([item(null), item('2026-09-14', 'doing', '2026-01-01T00:00:00Z'), item('2026-09-14', 'doing', '2026-02-01T00:00:00Z'), item('2026-09-13')]);
    expect(sorted.map((entry) => entry.dueDate)).toEqual(['2026-09-13', '2026-09-14', '2026-09-14', null]);
    expect(sorted[1].createdAt).toBe('2026-02-01T00:00:00Z');
  });

  it('星标始终置前，同一星标组沿用原有日期排序', () => {
    const starred = item(null); starred.id = 'starred'; starred.isStarred = true;
    const early = item('2026-09-13'); early.id = 'early';
    expect(sortByDueDate([starred, early]).map((entry) => entry.id)).toEqual(['starred', 'early']);
  });

  it('历史包含所有状态的已过截止日期事项，关键词仍可叠加', () => {
    const finished = item('2026-09-12', 'done'); finished.title = '已归档方案';
    const paused = item('2026-09-11', 'paused'); paused.title = '已暂停活动';
    const today = item('2026-09-13', 'doing'); today.title = '今天事项';
    expect(filterItems([finished, paused, today], { dateFilter: 'history', query: '方案', today: '2026-09-13' })).toEqual([finished]);
    expect(matchesDateFilter(paused, 'history', '2026-09-13')).toBe(true);
  });

  it('仅进行中的过期事项显示为逾期', () => {
    expect(isOverdue(item('2026-09-12', 'doing'), '2026-09-13')).toBe(true);
    expect(isOverdue(item('2026-09-12', 'done'), '2026-09-13')).toBe(false);
    expect(isOverdue(item('2026-09-12', 'paused'), '2026-09-13')).toBe(false);
  });

  it('下月筛选能跨越年份', () => {
    expect(matchesDateFilter(item('2027-01-01'), 'nextMonth', '2026-12-15')).toBe(true);
    expect(matchesDateFilter(item('2026-12-31'), 'nextMonth', '2026-12-15')).toBe(false);
  });
});
