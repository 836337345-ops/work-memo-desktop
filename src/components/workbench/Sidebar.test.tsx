// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';

const setup = () => {
  const props = { categories: [{ id: 'promotion', name: '推广', sortOrder: 0 }], activeFilter: null, trash: false, onDateFilter: vi.fn(), onCategory: vi.fn(), onStatus: vi.fn(), onTrash: vi.fn(), onManageCategories: vi.fn(), onOpenBackup: vi.fn(), onOpenExport: vi.fn() };
  render(<Sidebar {...props} />);
  return props;
};
afterEach(cleanup);

describe('V2 工作台导航', () => {
  it('按状态、时间、分类顺序显示筛选入口', () => {
    setup();
    const labels = screen.getAllByRole('button').map((button) => button.textContent);
    expect(labels.indexOf('待开展')).toBeLessThan(labels.indexOf('全部时间'));
    expect(labels.indexOf('全部时间')).toBeLessThan(labels.indexOf('全部分类'));
  });

  it('状态、时间和分类入口均可通过按钮触发', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: '进行中' }));
    fireEvent.click(screen.getByRole('button', { name: '历史' }));
    fireEvent.click(screen.getByRole('button', { name: '推广' }));
    expect(props.onStatus).toHaveBeenCalledWith('doing');
    expect(props.onDateFilter).toHaveBeenCalledWith('history');
    expect(props.onCategory).toHaveBeenCalledWith('promotion');
  });
});
