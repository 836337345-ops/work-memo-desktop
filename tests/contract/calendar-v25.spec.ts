import { describe, expect, it } from 'vitest';
import { buildCalendarGrid, holidaysForYear } from '../../src/components/workbench/calendar';

describe('V2.5 工作日历节日契约', () => {
  it('覆盖首期八类节日，并在同日合并中秋与国庆', () => {
    const holidays = holidaysForYear(2026);
    expect(holidays.get('2026-01-01')).toBe('元旦');
    expect(holidays.get('2026-02-17')).toBe('春节');
    expect(holidays.get('2026-04-05')).toBe('清明');
    expect(holidays.get('2026-05-01')).toBe('劳动节');
    expect(holidays.get('2026-05-10')).toBe('母亲节');
    expect(holidays.get('2026-06-19')).toBe('端午');
    expect(holidays.get('2026-09-25')).toBe('中秋');
    expect(holidays.get('2026-10-01')).toBe('国庆');
    expect(holidaysForYear(2020).get('2020-10-01')).toBe('中秋/国庆');
  });

  it('十二月六周格包含相邻年份的元旦，仍固定为周一开头的 42 格', () => {
    const grid = buildCalendarGrid(new Date(2026, 11, 1));
    expect(grid).toHaveLength(42);
    expect(grid[0].key).toBe('2026-11-30');
    expect(grid[0].date.getDay()).toBe(1);
    expect(grid.some((day) => day.key === '2027-01-01')).toBe(true);
  });
});
