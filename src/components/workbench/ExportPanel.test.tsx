// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { save } from '@tauri-apps/plugin-dialog';
import { api } from '../../api';
import { ExportPanel } from './ExportPanel';

vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn() }));
vi.mock('../../api', () => ({ api: { exportWorkItems: vi.fn() } }));

const categories = [{ id: 'promotion', name: '推广', sortOrder: 0 }, { id: 'event', name: '活动', sortOrder: 1 }];

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(save).mockResolvedValue('D:/isolated/工作事项汇总.txt');
  vi.mocked(api.exportWorkItems).mockResolvedValue({ path: 'D:/isolated/工作事项汇总.txt', itemCount: 2, categoryCount: 2 });
});

describe('V2.8 导出筛选', () => {
  it('只展示三种状态和六个时间选项，每组提供全选与反选', () => {
    render(<ExportPanel categories={categories} onClose={vi.fn()} />);
    expect(screen.queryByLabelText('待开展')).toBeNull();
    expect(screen.queryByLabelText('全部时间')).toBeNull();
    expect(screen.queryByLabelText('已逾期')).toBeNull();
    expect(screen.getAllByRole('checkbox')).toHaveLength(12);
    expect(screen.getByRole('button', { name: '状态全选' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '时间反选' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '分类全选' })).toBeTruthy();
  });

  it('任一维度反选至空时禁止打开保存位置并提示', async () => {
    render(<ExportPanel categories={categories} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '时间反选' }));
    fireEvent.click(screen.getByRole('button', { name: '选择位置并导出 TXT' }));
    expect((await screen.findByRole('alert')).textContent).toContain('每组至少选择一项');
    expect(save).not.toHaveBeenCalled();
    expect(api.exportWorkItems).not.toHaveBeenCalled();
  });

  it('三组全选映射为真正不限条件，部分时间则传递明确选项', async () => {
    const { unmount } = render(<ExportPanel categories={categories} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '选择位置并导出 TXT' }));
    await waitFor(() => expect(api.exportWorkItems).toHaveBeenCalledWith(expect.objectContaining({ statuses: [], dateFilters: [], categoryIds: [] })));

    unmount();
    vi.clearAllMocks();
    vi.mocked(save).mockResolvedValue('D:/isolated/部分时间.txt');
    vi.mocked(api.exportWorkItems).mockResolvedValue({ path: 'D:/isolated/部分时间.txt', itemCount: 1, categoryCount: 1 });
    render(<ExportPanel categories={categories} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '时间反选' }));
    const timeGroup = screen.getByRole('group', { name: '时间' });
    fireEvent.click(within(timeGroup).getByLabelText('今天'));
    fireEvent.click(screen.getByRole('button', { name: '选择位置并导出 TXT' }));
    await waitFor(() => expect(api.exportWorkItems).toHaveBeenCalledWith(expect.objectContaining({ dateFilters: ['today'] })));
  });

  it('三组反选后可分别恢复单项，导出只传递恢复的状态、时间和分类', async () => {
    render(<ExportPanel categories={categories} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '状态反选' }));
    fireEvent.click(screen.getByRole('button', { name: '时间反选' }));
    fireEvent.click(screen.getByRole('button', { name: '分类反选' }));

    expect(screen.getAllByRole('checkbox').every((checkbox) => !(checkbox as HTMLInputElement).checked)).toBe(true);
    fireEvent.click(screen.getByLabelText('进行中'));
    fireEvent.click(screen.getByLabelText('下周'));
    fireEvent.click(screen.getByLabelText('推广'));
    fireEvent.click(screen.getByRole('button', { name: '选择位置并导出 TXT' }));

    await waitFor(() => expect(api.exportWorkItems).toHaveBeenCalledWith(expect.objectContaining({
      statuses: ['doing'], dateFilters: ['nextWeek'], categoryIds: ['promotion'],
    })));
  });

  it('三组全选能从空选择恢复为不限条件', async () => {
    render(<ExportPanel categories={categories} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '状态反选' }));
    fireEvent.click(screen.getByRole('button', { name: '时间反选' }));
    fireEvent.click(screen.getByRole('button', { name: '分类反选' }));
    fireEvent.click(screen.getByRole('button', { name: '状态全选' }));
    fireEvent.click(screen.getByRole('button', { name: '时间全选' }));
    fireEvent.click(screen.getByRole('button', { name: '分类全选' }));
    fireEvent.click(screen.getByRole('button', { name: '选择位置并导出 TXT' }));

    await waitFor(() => expect(api.exportWorkItems).toHaveBeenCalledWith(expect.objectContaining({
      statuses: [], dateFilters: [], categoryIds: [],
    })));
  });

  it('分类异步载入且用户未操作时仍全选并导出为不限分类', async () => {
    const { rerender } = render(<ExportPanel categories={[]} onClose={vi.fn()} />);

    rerender(<ExportPanel categories={categories} onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getAllByRole('checkbox').slice(-3).every((checkbox) => (checkbox as HTMLInputElement).checked)).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: '选择位置并导出 TXT' }));
    await waitFor(() => expect(api.exportWorkItems).toHaveBeenCalledWith(expect.objectContaining({ categoryIds: [] })));
  });

  it('用户手动调整分类后，后续分类变化不覆盖其选择', () => {
    const { rerender } = render(<ExportPanel categories={categories} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '分类反选' }));

    rerender(<ExportPanel categories={[...categories, { id: 'notice', name: '通知', sortOrder: 2 }]} onClose={vi.fn()} />);

    expect(screen.getAllByRole('checkbox').slice(-4).every((checkbox) => !(checkbox as HTMLInputElement).checked)).toBe(true);
  });

  it('用户手动全选或勾选分类后，后续分类载入不会重置该选择', () => {
    const expandedCategories = [...categories, { id: 'notice', name: '通知', sortOrder: 2 }];
    const { rerender } = render(<ExportPanel categories={categories} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '分类全选' }));
    rerender(<ExportPanel categories={expandedCategories} onClose={vi.fn()} />);
    expect((screen.getByLabelText('推广') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('活动') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('未分类') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('通知') as HTMLInputElement).checked).toBe(false);

    fireEvent.click(screen.getByLabelText('推广'));
    rerender(<ExportPanel categories={[...expandedCategories, { id: 'gift', name: '礼品', sortOrder: 3 }]} onClose={vi.fn()} />);
    expect((screen.getByLabelText('推广') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('活动') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('通知') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('礼品') as HTMLInputElement).checked).toBe(false);
  });
});
