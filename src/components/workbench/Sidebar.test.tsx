// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { confirm } from '@tauri-apps/plugin-dialog';
import { api } from '../../api';
import { Sidebar } from './Sidebar';

vi.mock('../../api', () => ({ api: { createCategory: vi.fn(), renameCategory: vi.fn(), deleteCategory: vi.fn(), reorderCategories: vi.fn() } }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ confirm: vi.fn() }));
const categories = [{ id: 'promotion', name: '推广', sortOrder: 0 }, { id: 'customer', name: '客户', sortOrder: 1 }];
const setup = (inputCategories = categories) => {
  const categories = inputCategories;
  const props = { categories, workbenchName: '工作台', filters: { status: 'all' as const, date: 'all' as const, categoryId: undefined }, trash: false, calendar: false, onDateFilter: vi.fn(), onCategory: vi.fn(), onStatus: vi.fn(), onTrash: vi.fn(), onShowAll: vi.fn(), onShowDoing: vi.fn(), onOpenCalendar: vi.fn(), onBeforeCategoryChange: vi.fn().mockResolvedValue(true), onCategoriesChanged: vi.fn().mockResolvedValue(undefined), onOpenBackup: vi.fn(), onOpenExport: vi.fn(), onOpenWorkbenchNameSettings: vi.fn(), autostartEnabled: false, autostartReady: true, autostartBusy: false, autostartError: '', onToggleAutostart: vi.fn() };
  render(<Sidebar {...props} />); return props;
};
const openCategories = () => fireEvent.click(screen.getByRole('button', { name: /^分类/ }));
afterEach(cleanup); beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); vi.mocked(confirm).mockResolvedValue(true); });

describe('V2.13 左栏分类', () => {
  it('保留工作列表和进度筛选', () => {
    const props = setup(); fireEvent.click(screen.getByRole('button', { name: '工作列表' })); fireEvent.click(screen.getByRole('button', { name: '全部进度' }));
    expect(props.onShowAll).toHaveBeenCalledTimes(1); expect(props.onStatus).toHaveBeenCalledWith('all');
  });

  it('保留时间、分类筛选、日历、名称设置和自启动入口', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: /^时间/ }));
    fireEvent.click(screen.getByRole('button', { name: '历史' }));
    fireEvent.click(screen.getByRole('button', { name: /^分类/ }));
    fireEvent.click(screen.getByRole('button', { name: '推广' }));
    fireEvent.click(screen.getByRole('button', { name: '工作日历' }));
    fireEvent.click(screen.getByRole('button', { name: '修改' }));
    fireEvent.click(screen.getByRole('switch', { name: '开机自启动' }));
    expect(props.onDateFilter).toHaveBeenCalledWith('history');
    expect(props.onCategory).toHaveBeenCalledWith('promotion');
    expect(props.onOpenCalendar).toHaveBeenCalledTimes(1);
    expect(props.onOpenWorkbenchNameSettings).toHaveBeenCalledTimes(1);
    expect(props.onToggleAutostart).toHaveBeenCalledTimes(1);
  });

  it('新增入口只打开对话框，取消不保留输入，成功后关闭', async () => {
    setup(); openCategories(); expect(screen.queryByLabelText('新分类名称')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '新增分类' })); fireEvent.change(screen.getByLabelText('分类名称'), { target: { value: '新分类' } }); fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.queryByRole('dialog')).toBeNull(); fireEvent.click(screen.getByRole('button', { name: '新增分类' })); expect((screen.getByLabelText('分类名称') as HTMLInputElement).value).toBe('');
    vi.mocked(api.createCategory).mockResolvedValue([...categories, { id: 'new', name: '新分类', sortOrder: 2 }]); fireEvent.change(screen.getByLabelText('分类名称'), { target: { value: '新分类' } }); fireEvent.click(screen.getByRole('button', { name: '添加' }));
    await waitFor(() => expect(api.createCategory).toHaveBeenCalledWith('新分类')); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('新增失败保留输入和中文错误', async () => {
    setup(); fireEvent.click(screen.getByRole('button', { name: '新增分类' })); vi.mocked(api.createCategory).mockRejectedValue(new Error('分类名称不能重复。')); fireEvent.change(screen.getByLabelText('分类名称'), { target: { value: '推广' } }); fireEvent.click(screen.getByRole('button', { name: '添加' }));
    expect((await screen.findByRole('alert')).textContent).toContain('分类名称不能重复'); expect((screen.getByLabelText('分类名称') as HTMLInputElement).value).toBe('推广');
  });

  it('同一行提供改名、删除和拖拽把手，筛选点击不触发拖拽', () => {
    const props = setup(); openCategories(); const row = screen.getByText('推广').closest('.sidebar-category-row') as HTMLElement;
    expect(row.firstElementChild?.className).toContain('category-drag-handle'); expect(row.lastElementChild?.className).toContain('category-actions'); expect(row.textContent).toContain('改名'); expect(row.textContent).toContain('删除'); expect(row.textContent).not.toContain('↑');
    fireEvent.click(screen.getByText('推广')); expect(props.onCategory).toHaveBeenCalledWith('promotion'); expect(api.reorderCategories).not.toHaveBeenCalled();
    expect(row.querySelector('.category-rename')).toBeTruthy(); expect(row.querySelector('.danger-text')).toBeTruthy();
  });

  it('向下拖拽预览和最终排序均放在目标后方', async () => {
    const props = setup(); openCategories(); const first = screen.getByText('推广').closest('.sidebar-category-row') as HTMLElement; const second = screen.getByText('客户').closest('.sidebar-category-row') as HTMLElement; const handle = first.querySelector('.category-drag-handle') as HTMLButtonElement;
    fireEvent.dragStart(handle, { dataTransfer: { effectAllowed: '' } }); fireEvent.dragOver(second); expect(second.className).toContain('is-drag-after'); fireEvent.drop(second);
    await waitFor(() => expect(api.reorderCategories).toHaveBeenCalledWith(['customer', 'promotion'])); expect(props.onCategoriesChanged).toHaveBeenCalled();
    vi.clearAllMocks(); fireEvent.dragStart(handle, { dataTransfer: { effectAllowed: '' } }); fireEvent.dragEnd(handle); expect(api.reorderCategories).not.toHaveBeenCalled(); fireEvent.dragStart(handle, { dataTransfer: { effectAllowed: '' } }); fireEvent.drop(first); expect(api.reorderCategories).not.toHaveBeenCalled();
  });

  it('向上拖拽预览和最终排序均放在目标前方', async () => {
    setup(); openCategories(); const first = screen.getByText('推广').closest('.sidebar-category-row') as HTMLElement; const second = screen.getByText('客户').closest('.sidebar-category-row') as HTMLElement;
    fireEvent.dragStart(second.querySelector('.category-drag-handle') as HTMLButtonElement, { dataTransfer: { effectAllowed: '' } }); fireEvent.dragOver(first); expect(first.className).toContain('is-drag-before'); fireEvent.drop(first);
    await waitFor(() => expect(api.reorderCategories).toHaveBeenCalledWith(['customer', 'promotion']));
  });

  it('排序失败保持原顺序并显示错误', async () => {
    setup(); openCategories(); const first = screen.getByText('推广').closest('.sidebar-category-row') as HTMLElement; const second = screen.getByText('客户').closest('.sidebar-category-row') as HTMLElement; vi.mocked(api.reorderCategories).mockRejectedValue(new Error('排序保存失败。'));
    fireEvent.dragStart(first.querySelector('.category-drag-handle') as HTMLButtonElement, { dataTransfer: { effectAllowed: '' } }); fireEvent.dragOver(second); fireEvent.drop(second);
    expect((await screen.findByRole('alert')).textContent).toContain('排序保存失败'); expect(Array.from(document.querySelectorAll('.sidebar-category-row .nav-link')).map((node) => node.textContent)).toEqual(['推广', '客户']);
  });

  it('分类删除取消不调用接口', async () => {
    setup(); openCategories();
    vi.mocked(confirm).mockResolvedValueOnce(false);
    fireEvent.click(screen.getByText('推广').closest('.sidebar-category-row')!.querySelector('.danger-text') as HTMLButtonElement);
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(api.deleteCategory).not.toHaveBeenCalled();
  });

  it('空白分类不提交，展开状态具备可访问标记', () => {
    setup();
    const status = screen.getByRole('button', { name: /^进度/ });
    expect(status.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(status);
    expect(status.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: '新增分类' }));
    fireEvent.click(screen.getByRole('button', { name: '添加' }));
    expect(api.createCategory).not.toHaveBeenCalled();
  });
});
