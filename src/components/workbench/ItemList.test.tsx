// @vitest-environment jsdom
import { createRef } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { ItemList } from './ItemList';
import type { ItemInput, ItemListHandle, WorkItem } from '../../types';

vi.mock('../../api', () => ({ api: { updateItem: vi.fn(), addProgress: vi.fn() } }));

const base: WorkItem = { id: 'one', title: '联系客户', content: '确认本周合作方案', categoryId: 'promotion', dueDate: '2000-01-01', status: 'todo', notes: '优先电话沟通', followUps: [{ id: 'f1', text: '确认联系人', done: false }], progress: [{ id: 'p1', content: '完整进度文本不可截断', createdAt: '2026-01-01T00:00:00Z' }], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', deletedAt: null };
const categories = [{ id: 'promotion', name: '推广', sortOrder: 0 }];
const saved = (input: ItemInput, overrides: Partial<WorkItem> = {}): WorkItem => ({ ...base, ...input, updatedAt: '2026-01-02T00:00:00Z', ...overrides });
const props = () => ({ items: [base], categories, selectedId: null, onSelect: vi.fn(), onChanged: vi.fn(), onError: vi.fn() });

afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); vi.mocked(api.updateItem).mockImplementation(async (_id, input) => saved(input)); });

describe('V2.2 可折叠事项卡', () => {
  it('定位事项会滚动标记并展开目标卡片，不触发选择', () => {
    const next = props();
    render(<ItemList {...next} revealItemId="one" />);
    expect(screen.getByRole('button', { name: '收起事项' })).toBeTruthy();
    expect(screen.getByRole('article', { name: '事项：联系客户' }).classList.contains('is-revealed')).toBe(true);
    expect(next.onSelect).not.toHaveBeenCalled();
  });

  it('同一事项重复定位仍可再次展开，未知事项不会报错', () => {
    const next = props();
    const view = render(<ItemList {...next} revealItemId="one" />);
    fireEvent.click(screen.getByRole('button', { name: '收起事项' }));
    view.rerender(<ItemList {...next} revealItemId={null} />);
    view.rerender(<ItemList {...next} revealItemId="one" />);
    expect(screen.getByRole('button', { name: '收起事项' })).toBeTruthy();
    cleanup();
    expect(() => render(<ItemList {...next} revealItemId="missing" />)).not.toThrow();
    expect(screen.getByRole('button', { name: '展开事项' })).toBeTruthy();
  });

  it('默认收起仍显示标题栏、类别日期、完整最新进度、状态和详情入口', () => {
    const next = props();
    render(<ItemList {...next} />);
    expect(screen.getByText('联系客户')).toBeTruthy();
    expect(screen.getByText('推广 · 2000年1月1日')).toBeTruthy();
    expect(screen.getByText('完整进度文本不可截断')).toBeTruthy();
    expect(screen.getByLabelText('联系客户的状态')).toBeTruthy();
    expect(screen.getByRole('button', { name: '修改编辑' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '展开事项' })).toBeTruthy();
    expect(screen.getByText('逾期')).toBeTruthy();
    expect(screen.queryByText('确认本周合作方案')).toBeNull();
  });

  it('最新进度正文保留原有换行', () => {
    const next = props();
    const item = { ...base, progress: [{ ...base.progress[0], content: '第一行\n第二行' }] };
    const { container } = render(<ItemList {...next} items={[item]} />);
    const progress = container.querySelector('.item-card__progress-full') as HTMLElement;
    expect(progress.textContent).toBe('第一行\n第二行');
  });

  it('展开后显示情况、跟进和只读备注，标题类别日期仍不可编辑', () => {
    render(<ItemList {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: '展开事项' }));
    expect(screen.getByText('确认本周合作方案')).toBeTruthy();
    expect((screen.getByLabelText('跟进内容') as HTMLInputElement).value).toBe('确认联系人');
    expect(screen.getByText('优先电话沟通')).toBeTruthy();
    expect(screen.queryByLabelText('联系客户的标题')).toBeNull();
    expect(screen.queryByLabelText('联系客户的情况')).toBeNull();
    expect(screen.queryByLabelText('联系客户的备注')).toBeNull();
    expect(screen.queryByRole('button', { name: '一键完成' })).toBeNull();
  });

  it('详情编辑器回传同一事项的新版本时同步最新进度与状态', () => {
    const next = props();
    const view = render(<ItemList {...next} />);
    const external = { ...base, status: 'done' as const, updatedAt: '2026-01-04T00:00:00Z', progress: [{ id: 'p3', content: '详情编辑器更新的进度', createdAt: '2026-01-04T00:00:00Z' }, ...base.progress] };
    view.rerender(<ItemList {...next} items={[external]} />);
    expect((screen.getByLabelText('联系客户的状态') as HTMLSelectElement).value).toBe('done');
    expect(screen.getByText('详情编辑器更新的进度')).toBeTruthy();
  });

  it('点击进度标题显示输入，提交成功只隐藏输入并保持卡片展开', async () => {
    vi.mocked(api.addProgress).mockResolvedValue(saved(base, { progress: [{ id: 'p2', content: '刚完成回访', createdAt: '2026-01-02T00:00:00Z' }, ...base.progress] }));
    render(<ItemList {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: '展开事项' }));
    fireEvent.click(screen.getByText('最新进度'));
    fireEvent.change(screen.getByLabelText('新增进度'), { target: { value: '刚完成回访' } });
    fireEvent.click(screen.getByRole('button', { name: '提交新进度' }));
    await waitFor(() => expect(api.addProgress).toHaveBeenCalledWith('one', '刚完成回访'));
    await waitFor(() => expect(screen.queryByLabelText('新增进度')).toBeNull());
    expect(screen.getByRole('button', { name: '收起事项' })).toBeTruthy();
    expect(screen.getByText('刚完成回访')).toBeTruthy();
  });

  it('收起态点击最新进度正文也能显示输入，成功后保持收起', async () => {
    vi.mocked(api.addProgress).mockResolvedValue(saved(base, { progress: [{ id: 'p2', content: '收起态新增进度', createdAt: '2026-01-02T00:00:00Z' }, ...base.progress] }));
    render(<ItemList {...props()} />);
    fireEvent.click(screen.getByText('完整进度文本不可截断'));
    fireEvent.change(screen.getByLabelText('新增进度'), { target: { value: '收起态新增进度' } });
    fireEvent.click(screen.getByRole('button', { name: '提交新进度' }));
    await waitFor(() => expect(screen.queryByLabelText('新增进度')).toBeNull());
    expect(screen.getByRole('button', { name: '展开事项' })).toBeTruthy();
  });

  it('进度提交失败保留输入并保持展开', async () => {
    vi.mocked(api.addProgress).mockRejectedValueOnce(new Error('进度暂不可写'));
    render(<ItemList {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: '展开事项' }));
    fireEvent.click(screen.getByText('最新进度'));
    const input = screen.getByLabelText('新增进度') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '需要保留的进度' } });
    fireEvent.click(screen.getByRole('button', { name: '提交新进度' }));
    expect((await screen.findByRole('alert')).textContent).toContain('进度暂不可写');
    expect(input.value).toBe('需要保留的进度');
    expect(screen.getByRole('button', { name: '收起事项' })).toBeTruthy();
  });

  it('普通字段保存失败保留草稿并通知根组件', async () => {
    const next = props();
    vi.mocked(api.updateItem).mockRejectedValueOnce(new Error('本地数据库暂不可写'));
    render(<ItemList {...next} />);
    fireEvent.change(screen.getByLabelText('联系客户的状态'), { target: { value: 'paused' } });
    expect((await screen.findByRole('alert')).textContent).toContain('本地数据库暂不可写');
    expect((screen.getByLabelText('联系客户的状态') as HTMLSelectElement).value).toBe('paused');
    expect(next.onError).toHaveBeenCalledWith('本地数据库暂不可写');
  });

  it('进度失败不会被普通字段保存清掉提示或离开保护', async () => {
    vi.mocked(api.addProgress).mockRejectedValueOnce(new Error('进度写入失败'));
    const ref = createRef<ItemListHandle>();
    render(<ItemList {...props()} ref={ref} />);
    fireEvent.click(screen.getByRole('button', { name: '展开事项' }));
    fireEvent.click(screen.getByText('最新进度'));
    fireEvent.change(screen.getByLabelText('新增进度'), { target: { value: '等待确认' } });
    fireEvent.click(screen.getByRole('button', { name: '提交新进度' }));
    expect((await screen.findByRole('alert')).textContent).toContain('进度写入失败');
    fireEvent.change(screen.getByLabelText('联系客户的状态'), { target: { value: 'doing' } });
    await waitFor(() => expect(api.updateItem).toHaveBeenCalled());
    expect(screen.getByRole('alert').textContent).toContain('进度写入失败');
    expect(await ref.current?.prepareLeave()).toBe(false);
  });

  it('状态操作和跟进仍可内联保存，回收站卡片只读', async () => {
    render(<ItemList {...props()} />);
    fireEvent.change(screen.getByLabelText('联系客户的状态'), { target: { value: 'doing' } });
    fireEvent.click(screen.getByRole('button', { name: '展开事项' }));
    fireEvent.click(screen.getByLabelText('完成：确认联系人'));
    await waitFor(() => expect(vi.mocked(api.updateItem).mock.calls.some(([, input]) => input.status === 'doing' && input.followUps[0].done)).toBe(true));

    cleanup();
    const onRestore = vi.fn();
    render(<ItemList items={[{ ...base, deletedAt: '2026-01-03T00:00:00Z' }]} categories={categories} selectedId={null} onSelect={vi.fn()} onRestore={onRestore} />);
    expect(screen.getByLabelText('联系客户的状态').hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: '还原' })).toBeTruthy();
  });

  it('离开保护等待当前内联保存并在失败时阻止卸载', async () => {
    let resolveSave!: (item: WorkItem) => void;
    vi.mocked(api.updateItem).mockImplementationOnce(() => new Promise<WorkItem>((resolve) => { resolveSave = resolve; }));
    const ref = createRef<ItemListHandle>();
    render(<ItemList {...props()} ref={ref} />);
    fireEvent.change(screen.getByLabelText('联系客户的状态'), { target: { value: 'doing' } });
    await waitFor(() => expect(api.updateItem).toHaveBeenCalledTimes(1));
    const leave = ref.current?.prepareLeave();
    resolveSave(saved({ ...base, status: 'doing' }));
    expect(await leave).toBe(true);

    vi.mocked(api.updateItem).mockRejectedValueOnce(new Error('保存失败'));
    fireEvent.change(screen.getByLabelText('联系客户的状态'), { target: { value: 'paused' } });
    await screen.findByRole('alert');
    expect(await ref.current?.prepareLeave()).toBe(false);
  });

  it('离开保护在等待期间追加保存时会继续等待新保存', async () => {
    let resolveA!: (item: WorkItem) => void;
    let resolveB!: (item: WorkItem) => void;
    vi.mocked(api.updateItem)
      .mockImplementationOnce(() => new Promise<WorkItem>((resolve) => { resolveA = resolve; }))
      .mockImplementationOnce(() => new Promise<WorkItem>((resolve) => { resolveB = resolve; }));
    const ref = createRef<ItemListHandle>();
    render(<ItemList {...props()} ref={ref} />);
    const status = screen.getByLabelText('联系客户的状态');
    fireEvent.change(status, { target: { value: 'doing' } });
    await waitFor(() => expect(api.updateItem).toHaveBeenCalledTimes(1));
    const leave = ref.current?.prepareLeave();
    let settled = false;
    void leave?.then(() => { settled = true; });
    fireEvent.change(status, { target: { value: 'paused' } });
    resolveA(saved({ ...base, status: 'doing' }));
    await waitFor(() => expect(api.updateItem).toHaveBeenCalledTimes(2));
    await Promise.resolve();
    expect(settled).toBe(false);
    resolveB(saved({ ...base, status: 'paused' }));
    expect(await leave).toBe(true);
  });

  it('详情编辑器打开时将同一事项卡片设为只读', () => {
    render(<ItemList {...props()} editingItemId="one" />);
    expect(screen.queryByLabelText('联系客户的标题')).toBeNull();
    expect(screen.getByLabelText('联系客户的状态').hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('button', { name: '一键完成' })).toBeNull();
    expect(screen.getByLabelText('详情编辑中')).toBeTruthy();
  });
});
