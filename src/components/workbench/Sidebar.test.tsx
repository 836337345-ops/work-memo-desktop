// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error Node 类型并非前端生产依赖；Vitest 在 Node 环境中读取样式契约。
import { readFileSync } from 'node:fs';
import { Sidebar } from './Sidebar';

const setup = () => {
  const props = { categories: [{ id: 'promotion', name: '推广', sortOrder: 0 }], workbenchName: '工作台', filters: { status: 'all' as const, date: 'all' as const, categoryId: undefined }, trash: false, calendar: false, onDateFilter: vi.fn(), onCategory: vi.fn(), onStatus: vi.fn(), onTrash: vi.fn(), onShowAll: vi.fn(), onShowDoing: vi.fn(), onOpenCalendar: vi.fn(), onManageCategories: vi.fn(), onOpenBackup: vi.fn(), onOpenExport: vi.fn(), onOpenWorkbenchNameSettings: vi.fn() };
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
    expect(screen.queryByRole('button', { name: '待开展' })).toBeNull();
    expect(screen.getByRole('button', { name: /^时间/ }).textContent).toContain('时间 · 全部时间');
    expect(screen.getByRole('button', { name: /^分类/ }).textContent).toContain('分类 · 全部分类');
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

  it('提供显示进行中工作的快捷入口', () => {
    const props = setup();
    const button = screen.getByRole('button', { name: '显示进行中工作' });
    fireEvent.click(button);
    expect(props.onShowDoing).toHaveBeenCalledTimes(1);
  });

  it('提供工作日历入口', () => {
    const props = setup();
    const calendar = screen.getByRole('button', { name: '工作日历' });
    const showAll = screen.getByRole('button', { name: '显示全部' });
    expect(calendar.compareDocumentPosition(showAll) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(calendar.closest('.sidebar-bottom')).toBeNull();
    fireEvent.click(calendar);
    expect(props.onOpenCalendar).toHaveBeenCalledTimes(1);
  });

  it('在侧栏顶部显示可截断的工作台名称和修改入口，并保留日历激活态', () => {
    const props = setup();
    cleanup();
    props.workbenchName = '这是一个用于验证侧栏布局的三十字工作台名称示例内容';
    props.calendar = true;
    render(<Sidebar {...props} />);
    const name = screen.getByText(props.workbenchName);
    expect(name.className).toContain('sidebar-workbench-name');
    expect(screen.getByRole('button', { name: '修改' }).className).toContain('sidebar-workbench-settings');
    expect(screen.getByRole('button', { name: '工作日历' }).className).toContain('active');
    fireEvent.click(screen.getByRole('button', { name: '修改' }));
    expect(props.onOpenWorkbenchNameSettings).toHaveBeenCalledTimes(1);
  });

  it('将修改入口保持为蓝色文字按钮，不回退为绿色主色', () => {
    const css = readFileSync('src/components/workbench/sidebar.css', 'utf8');
    expect(css).toMatch(/\.sidebar-workbench-settings \{[^}]*color: #2563eb/);
    expect(css).toMatch(/\.sidebar-workbench-settings:hover, \.sidebar-workbench-settings:focus-visible \{[^}]*color: #1d4ed8/);
    expect(css).not.toMatch(/\.sidebar-workbench-settings \{[^}]*color: var\(--primary\)/);
  });
});
