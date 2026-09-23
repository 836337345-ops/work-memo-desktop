// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error Vitest 在 Node 环境读取样式契约。
import { readFileSync } from 'node:fs';
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
afterEach(cleanup); beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn() }); vi.mocked(confirm).mockResolvedValue(true); });

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

  it('同一行提供图片把手、改和×，筛选点击不触发拖拽', () => {
    const props = setup(); openCategories(); const row = screen.getByText('推广').closest('.sidebar-category-row') as HTMLElement;
    expect(row.firstElementChild?.className).toContain('category-drag-handle'); expect(row.querySelector('.category-drag-handle img')).toBeTruthy(); expect(row.lastElementChild?.className).toContain('category-actions'); expect(row.textContent).toContain('改'); expect(row.textContent).toContain('×'); expect(screen.getByRole('button', { name: '删除 推广' })).toBeTruthy();
    fireEvent.click(screen.getByText('推广')); expect(props.onCategory).toHaveBeenCalledWith('promotion'); expect(api.reorderCategories).not.toHaveBeenCalled();
    expect(row.querySelector('.category-rename')).toBeTruthy(); expect(row.querySelector('.danger-text')).toBeTruthy();
    const css = readFileSync('src/components/workbench/sidebar.css', 'utf8'); expect(css).toMatch(/\.category-actions \{[^}]*gap: 0/); expect(css).toMatch(/\.category-actions button \{[^}]*padding: 4px 2px/); expect(css).toMatch(/\.category-rename \{ color: #2563eb/);
  });

  it('Pointer 向下拖拽预览和最终排序均放在目标后方', async () => {
    const props = setup(); openCategories(); const first = screen.getByText('推广').closest('.sidebar-category-row') as HTMLElement; const second = screen.getByText('客户').closest('.sidebar-category-row') as HTMLElement; const handle = first.querySelector('.category-drag-handle') as HTMLButtonElement;
    vi.mocked(document.elementFromPoint).mockReturnValue(second); fireEvent.pointerDown(handle, { pointerId: 1 }); expect(first.className).toContain('is-dragging'); fireEvent.pointerMove(handle, { pointerId: 1, clientX: 3, clientY: 3 }); expect(first.className).toContain('is-dragging'); expect(second.className).toContain('is-drag-after'); fireEvent.pointerUp(handle, { pointerId: 1 }); expect(first.className).not.toContain('is-dragging'); expect(second.className).not.toContain('is-drag-after');
    await waitFor(() => expect(api.reorderCategories).toHaveBeenCalledWith(['customer', 'promotion'])); expect(props.onCategoriesChanged).toHaveBeenCalled();
    vi.clearAllMocks(); fireEvent.pointerDown(handle, { pointerId: 2 }); expect(first.className).toContain('is-dragging'); fireEvent.pointerCancel(handle, { pointerId: 2 }); expect(first.className).not.toContain('is-dragging'); expect(api.reorderCategories).not.toHaveBeenCalled(); vi.mocked(document.elementFromPoint).mockReturnValue(first); fireEvent.pointerDown(handle, { pointerId: 3 }); fireEvent.pointerMove(handle, { pointerId: 3, clientX: 3, clientY: 3 }); fireEvent.pointerUp(handle, { pointerId: 3 }); expect(api.reorderCategories).not.toHaveBeenCalled();
  });

  it('Pointer 向上拖拽预览和最终排序均放在目标前方', async () => {
    setup(); openCategories(); const first = screen.getByText('推广').closest('.sidebar-category-row') as HTMLElement; const second = screen.getByText('客户').closest('.sidebar-category-row') as HTMLElement;
    vi.mocked(document.elementFromPoint).mockReturnValue(first); const handle = second.querySelector('.category-drag-handle') as HTMLButtonElement; fireEvent.pointerDown(handle, { pointerId: 1 }); fireEvent.pointerMove(handle, { pointerId: 1, clientX: 3, clientY: 3 }); expect(first.className).toContain('is-drag-before'); fireEvent.pointerUp(handle, { pointerId: 1 });
    await waitFor(() => expect(api.reorderCategories).toHaveBeenCalledWith(['customer', 'promotion']));
  });

  it('排序失败保持原顺序并显示错误', async () => {
    setup(); openCategories(); const first = screen.getByText('推广').closest('.sidebar-category-row') as HTMLElement; const second = screen.getByText('客户').closest('.sidebar-category-row') as HTMLElement; vi.mocked(api.reorderCategories).mockRejectedValue(new Error('排序保存失败。'));
    vi.mocked(document.elementFromPoint).mockReturnValue(second); const handle = first.querySelector('.category-drag-handle') as HTMLButtonElement; fireEvent.pointerDown(handle, { pointerId: 1 }); fireEvent.pointerMove(handle, { pointerId: 1, clientX: 3, clientY: 3 }); fireEvent.pointerUp(handle, { pointerId: 1 });
    expect((await screen.findByRole('alert')).textContent).toContain('排序保存失败'); expect(Array.from(document.querySelectorAll('.sidebar-category-row .nav-link')).map((node) => node.textContent)).toEqual(['推广', '客户']);
  });

  it('分类删除取消不调用接口', async () => {
    setup(); openCategories();
    vi.mocked(confirm).mockResolvedValueOnce(false);
    fireEvent.click(screen.getByText('推广').closest('.sidebar-category-row')!.querySelector('.danger-text') as HTMLButtonElement);
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(api.deleteCategory).not.toHaveBeenCalled();
  });

  it('改名和删除操作不会误触拖拽排序', async () => {
    setup(); openCategories(); const row = screen.getByText('推广').closest('.sidebar-category-row') as HTMLElement;
    vi.mocked(api.renameCategory).mockResolvedValue([{ id: 'promotion', name: '市场推广', sortOrder: 0 }, categories[1]]);
    fireEvent.click(row.querySelector('.category-rename') as HTMLButtonElement); fireEvent.change(screen.getByLabelText('分类名称'), { target: { value: '市场推广' } }); fireEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(api.renameCategory).toHaveBeenCalledWith('promotion', '市场推广'));
    vi.mocked(confirm).mockResolvedValueOnce(false); fireEvent.click(row.querySelector('.danger-text') as HTMLButtonElement);
    await waitFor(() => expect(confirm).toHaveBeenCalled()); expect(api.reorderCategories).not.toHaveBeenCalled();
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
