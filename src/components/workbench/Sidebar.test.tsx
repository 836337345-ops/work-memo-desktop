// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';

const setup = () => {
  const props = { categories: [{ id: 'promotion', name: '推广', sortOrder: 0 }], filters: { status: 'all' as const, date: 'all' as const, categoryId: undefined }, trash: false, calendar: false, onDateFilter: vi.fn(), onCategory: vi.fn(), onStatus: vi.fn(), onTrash: vi.fn(), onShowAll: vi.fn(), onOpenCalendar: vi.fn(), onManageCategories: vi.fn(), onOpenBackup: vi.fn(), onOpenExport: vi.fn() };
  render(<Sidebar {...props} />);
  return props;
};
afterEach(cleanup);
beforeEach(() => localStorage.clear());

describe('V2 工作台导航', () => {
  it('按状态、时间、分类顺序显示筛选入口', () => {
    setup();
    const labels = screen.getAllByRole('button').map((button) => button.textContent);
    expect(labels.findIndex((label) => label?.startsWith('状态'))).toBeLessThan(labels.findIndex((label) => label?.startsWith('时间')));
    expect(labels.findIndex((label) => label?.startsWith('时间'))).toBeLessThan(labels.findIndex((label) => label?.startsWith('分类')));
    expect(screen.queryByRole('button', { name: '全部时间' })).toBeNull();
  });

  it('状态、时间和分类入口均可通过按钮触发', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: '进行中' }));
    fireEvent.click(screen.getByRole('button', { name: /^时间/ }));
    fireEvent.click(screen.getByRole('button', { name: '历史' }));
    fireEvent.click(screen.getByRole('button', { name: /^分类/ }));
    fireEvent.click(screen.getByRole('button', { name: '推广' }));
    expect(props.onStatus).toHaveBeenCalledWith('doing');
    expect(props.onDateFilter).toHaveBeenCalledWith('history');
    expect(props.onCategory).toHaveBeenCalledWith('promotion');
  });

  it('提供醒目的显示全部入口', () => {
    const props = setup();
    const button = screen.getByRole('button', { name: '显示全部' });
    expect(button.className).toContain('sidebar-show-all');
    fireEvent.click(button);
    expect(props.onShowAll).toHaveBeenCalledTimes(1);
  });

  it('提供工作日历入口', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: '工作日历' }));
    expect(props.onOpenCalendar).toHaveBeenCalledTimes(1);
  });
});
