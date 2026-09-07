import { describe, expect, it } from 'vitest';
import { buildCalendarGrid, dateKey, holidaysForYear, monthTitle, shiftMonth } from './calendar';

describe('工作日历工具', () => {
  it('生成周一开始的固定六周网格', () => {
    const grid = buildCalendarGrid(new Date(2026, 8, 1));
    expect(grid).toHaveLength(42);
    expect(grid[0].key).toBe('2026-08-31');
    expect(grid[0].date.getDay()).toBe(1);
    expect(grid[41].date.getDay()).toBe(0);
    expect(grid.filter((day) => day.inCurrentMonth)).toHaveLength(30);
  });

  it('支持月份切换和日期键', () => {
    const month = shiftMonth(new Date(2026, 0, 1), -1);
    expect(monthTitle(month)).toBe('2025年12月');
    expect(dateKey(new Date(2026, 8, 7))).toBe('2026-09-07');
  });

  it('合并同一天的多个节日名称', () => {
    expect(holidaysForYear(2020).get('2020-10-01')).toBe('中秋/国庆');
  });
});
