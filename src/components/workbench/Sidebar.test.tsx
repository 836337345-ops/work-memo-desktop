// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { confirm } from '@tauri-apps/plugin-dialog';
import { api } from '../../api';
import { Sidebar } from './Sidebar';

vi.mock('../../api', () => ({ api: { createCategory: vi.fn(), renameCategory: vi.fn(), deleteCategory: vi.fn(), reorderCategories: vi.fn() } }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ confirm: vi.fn() }));

const setup = () => {
  const props = { categories: [{ id: 'promotion', name: '推广', sortOrder: 0 }], workbenchName: '工作台', filters: { status: 'all' as const, date: 'all' as const, categoryId: undefined }, trash: false, calendar: false, onDateFilter: vi.fn(), onCategory: vi.fn(), onStatus: vi.fn(), onTrash: vi.fn(), onShowAll: vi.fn(), onShowDoing: vi.fn(), onOpenCalendar: vi.fn(), onBeforeCategoryChange: vi.fn().mockResolvedValue(true), onCategoriesChanged: vi.fn().mockResolvedValue(undefined), onOpenBackup: vi.fn(), onOpenExport: vi.fn(), onOpenWorkbenchNameSettings: vi.fn(), autostartEnabled: false, autostartReady: true, autostartBusy: false, autostartError: '', onToggleAutostart: vi.fn() };
  render(<Sidebar {...props} />); return props;
};
afterEach(cleanup); beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); vi.mocked(confirm).mockResolvedValue(true); });

describe('V2.13 左栏', () => {
  it('提供工作列表、进度筛选和日历入口', () => {
    const props = setup();
    expect(screen.queryByRole('button', { name: '全部' })).toBeNull();
    expect(document.querySelector('.sidebar-show-doing')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '工作列表' }));
    fireEvent.click(screen.getByRole('button', { name: '全部进度' }));
    expect(props.onShowAll).toHaveBeenCalledTimes(1); expect(props.onStatus).toHaveBeenCalledWith('all');
  });

  it('在分类区域直接新增、改名和删除', async () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: '新增分类' }));
    fireEvent.change(screen.getByLabelText('新分类名称'), { target: { value: '客户' } });
    vi.mocked(api.createCategory).mockResolvedValue([{ id: 'promotion', name: '推广', sortOrder: 0 }, { id: 'customer', name: '客户', sortOrder: 1 }]);
    fireEvent.click(screen.getByRole('button', { name: '添加' }));
    await waitFor(() => expect(api.createCategory).toHaveBeenCalledWith('客户'));
    fireEvent.click(screen.getByRole('button', { name: '改名' }));
    fireEvent.change(screen.getByLabelText('分类名称'), { target: { value: '市场推广' } });
    vi.mocked(api.renameCategory).mockResolvedValue([{ id: 'promotion', name: '市场推广', sortOrder: 0 }]);
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(api.renameCategory).toHaveBeenCalledWith('promotion', '市场推广'));
    vi.mocked(api.deleteCategory).mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: '删除' }));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    await waitFor(() => expect(api.deleteCategory).toHaveBeenCalledWith('promotion'));
    expect(props.onCategoriesChanged).toHaveBeenCalled();
  });
});
