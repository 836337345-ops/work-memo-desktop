// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ItemEditor from './ItemEditor';
import { api } from '../api';
import type { ItemInput, WorkItem } from '../types';

vi.mock('../api', () => ({ api: { createItem: vi.fn(), updateItem: vi.fn(), addProgress: vi.fn(), trashItem: vi.fn() } }));

const savedItem = (input: ItemInput, overrides: Partial<WorkItem> = {}): WorkItem => ({
  ...input, id: 'item-1', createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z', deletedAt: null, progress: [], ...overrides,
});
const base = savedItem({ title: '原事项', content: '', categoryId: null, dueDate: null, status: 'todo', notes: '', followUps: [] });
const props = { item: base, categories: [], onSaved: vi.fn(), onDeleted: vi.fn(), onCancel: vi.fn() };

describe('ItemEditor', () => {
  beforeEach(() => { cleanup(); vi.clearAllMocks(); });

  it('快速编辑时按顺序保存快照，旧响应不会覆盖最新输入', async () => {
    let firstDone!: (value: WorkItem) => void;
    const first = new Promise<WorkItem>((resolve) => { firstDone = resolve; });
    vi.mocked(api.updateItem).mockReturnValueOnce(first).mockImplementation(async (_id, input) => savedItem(input));
    render(<ItemEditor {...props} />);
    const title = screen.getByLabelText(/事项标题/);
    fireEvent.change(title, { target: { value: '第一版' } });
    fireEvent.change(title, { target: { value: '最终版' } });
    await waitFor(() => expect(api.updateItem).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.updateItem).mock.calls[0][1].title).toBe('第一版');
    await act(async () => { firstDone(savedItem({ ...base, title: '第一版' })); await first; });
    await waitFor(() => expect(api.updateItem).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.updateItem).mock.calls[1][1].title).toBe('最终版');
    expect(Object.keys(vi.mocked(api.updateItem).mock.calls[1][1]).sort()).toEqual(['categoryId', 'content', 'dueDate', 'followUps', 'notes', 'status', 'title']);
    await waitFor(() => expect((screen.getByLabelText(/事项标题/) as HTMLInputElement).value).toBe('最终版'));
  });

  it('保存失败保留输入，并可显式重试', async () => {
    vi.mocked(api.updateItem).mockRejectedValueOnce(new Error('网络暂不可用')).mockImplementation(async (_id, input) => savedItem(input));
    render(<ItemEditor {...props} />);
    fireEvent.change(screen.getByLabelText(/事项标题/), { target: { value: '仍要保留' } });
    await screen.findByRole('alert');
    expect((screen.getByLabelText(/事项标题/) as HTMLInputElement).value).toBe('仍要保留');
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    await waitFor(() => expect(api.updateItem).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.updateItem).mock.calls[1][1].title).toBe('仍要保留');
  });

  it('进度单独提交并显示最新历史', async () => {
    const withProgress = savedItem(base, { progress: [{ id: 'progress-1', content: '已联系供应商', createdAt: '2026-09-02T08:00:00Z' }] });
    vi.mocked(api.addProgress).mockResolvedValue(withProgress);
    render(<ItemEditor {...props} />);
    fireEvent.change(screen.getByLabelText('新的进度'), { target: { value: '已联系供应商' } });
    fireEvent.click(screen.getByRole('button', { name: '提交进度' }));
    await waitFor(() => expect(api.addProgress).toHaveBeenCalledWith('item-1', '已联系供应商'));
    expect(await screen.findByText('已联系供应商')).toBeTruthy();
  });

  it('创建成功后继续编辑时只提交普通字段', async () => {
    const input = { title: '新事项', content: '', categoryId: null, dueDate: null, status: 'todo' as const, notes: '', followUps: [] };
    vi.mocked(api.createItem).mockResolvedValue(savedItem(input));
    vi.mocked(api.updateItem).mockImplementation(async (_id, next) => savedItem(next));
    render(<ItemEditor {...props} item={null} />);
    fireEvent.change(screen.getByLabelText(/事项标题/), { target: { value: '新事项' } });
    fireEvent.click(screen.getByRole('button', { name: '创建事项' }));
    await waitFor(() => expect(api.createItem).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText(/事项标题/), { target: { value: '新事项（已更新）' } });
    await waitFor(() => expect(api.updateItem).toHaveBeenCalled());
    expect(Object.keys(vi.mocked(api.updateItem).mock.calls[0][1]).sort()).toEqual(['categoryId', 'content', 'dueDate', 'followUps', 'notes', 'status', 'title']);
  });

  it('跟进支持新增、编辑、勾选和删除，并自动保存', async () => {
    vi.mocked(api.updateItem).mockImplementation(async (_id, input) => savedItem(input));
    render(<ItemEditor {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /添加跟进/ }));
    const content = screen.getByLabelText('跟进内容');
    fireEvent.change(content, { target: { value: '确认报价' } });
    fireEvent.click(screen.getByLabelText('完成：确认报价'));
    await waitFor(() => expect(api.updateItem).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: '删除跟进' }));
    await waitFor(() => expect(screen.queryByLabelText('跟进内容')).toBeNull());
  });
});
