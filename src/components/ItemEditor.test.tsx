// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ItemEditor from './ItemEditor';
import { api } from '../api';
import type { FollowUpTemplate, ItemInput, WorkItem } from '../types';

vi.mock('../api', () => ({ api: { createItem: vi.fn(), updateItem: vi.fn(), addProgress: vi.fn(), trashItem: vi.fn(), listFollowUpTemplates: vi.fn(), createFollowUpTemplate: vi.fn(), updateFollowUpTemplate: vi.fn(), deleteFollowUpTemplate: vi.fn() } }));
const savedItem = (input: ItemInput, overrides: Partial<WorkItem> = {}): WorkItem => ({ ...input, id: 'item-1', createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z', deletedAt: null, progress: [], ...overrides });
const base = savedItem({ title: '原事项', content: '', categoryId: null, dueDate: null, status: 'todo', notes: '', followUps: [] });
const props = { item: base, categories: [], onSaved: vi.fn(), onDeleted: vi.fn(), onCancel: vi.fn() };

describe('V2.2 ItemEditor', () => {
  beforeEach(() => { cleanup(); vi.clearAllMocks(); vi.mocked(api.listFollowUpTemplates).mockResolvedValue([]); vi.spyOn(window, 'confirm').mockReturnValue(true); });
  afterEach(() => vi.restoreAllMocks());

  it('普通字段不会自动写入，点击顶部保存后提交并关闭', async () => {
    vi.mocked(api.updateItem).mockImplementation(async (_id, input) => savedItem(input));
    render(<ItemEditor {...props} />);
    fireEvent.change(screen.getByLabelText(/事项标题/), { target: { value: '改后标题' } });
    expect(api.updateItem).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '保存并关闭' }));
    await waitFor(() => expect(api.updateItem).toHaveBeenCalledWith('item-1', expect.objectContaining({ title: '改后标题' })));
    expect(props.onSaved).toHaveBeenCalled(); expect(props.onCancel).toHaveBeenCalled();
  });

  it('保存失败保留输入，再次点击保存可以重试', async () => {
    vi.mocked(api.updateItem).mockRejectedValueOnce(new Error('保存失败：测试')); vi.mocked(api.updateItem).mockImplementation(async (_id, input) => savedItem(input));
    render(<ItemEditor {...props} />); fireEvent.change(screen.getByLabelText(/事项标题/), { target: { value: '仍要保留' } }); fireEvent.click(screen.getByRole('button', { name: '保存并关闭' }));
    await screen.findByRole('alert'); expect((screen.getByLabelText(/事项标题/) as HTMLInputElement).value).toBe('仍要保留'); expect(props.onCancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '保存并关闭' })); await waitFor(() => expect(api.updateItem).toHaveBeenCalledTimes(2)); expect(props.onCancel).toHaveBeenCalled();
  });

  it('创建使用统一保存按钮，成功后关闭编辑栏', async () => {
    const input = { title: '新事项', content: '', categoryId: null, dueDate: null, status: 'todo' as const, notes: '', followUps: [] }; vi.mocked(api.createItem).mockResolvedValue(savedItem(input));
    render(<ItemEditor {...props} item={null} />); fireEvent.change(screen.getByLabelText(/事项标题/), { target: { value: '新事项' } }); fireEvent.click(screen.getByRole('button', { name: '创建并关闭' }));
    await waitFor(() => expect(api.createItem).toHaveBeenCalled()); expect(props.onSaved).toHaveBeenCalled(); expect(props.onCancel).toHaveBeenCalled();
  });

  it('进度单独提交并保留历史，不触发编辑栏关闭', async () => {
    const withProgress = savedItem(base, { progress: [{ id: 'p1', content: '已联系供应商', createdAt: '2026-09-02T08:00:00Z' }] }); vi.mocked(api.addProgress).mockResolvedValue(withProgress);
    render(<ItemEditor {...props} />); fireEvent.change(screen.getByLabelText('新的进度'), { target: { value: '已联系供应商' } }); fireEvent.click(screen.getByRole('button', { name: '提交进度' })); await waitFor(() => expect(api.addProgress).toHaveBeenCalledWith('item-1', '已联系供应商')); expect(screen.getByText('已联系供应商')).toBeTruthy(); expect(props.onCancel).not.toHaveBeenCalled();
  });

  it('只展示当前类别模板，应用时按 trim 后文字跳过重复项', async () => {
    const template: FollowUpTemplate = { id: 'tpl-1', categoryId: 'cat', name: '健康讲座', items: ['确认场地', '邀约客户'], sortOrder: 0, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' }; vi.mocked(api.listFollowUpTemplates).mockResolvedValue([template]);
    render(<ItemEditor {...props} item={savedItem({ ...base, categoryId: 'cat', followUps: [{ id: 'f1', text: ' 确认场地 ', done: false }] })} categories={[{ id: 'cat', name: '活动', sortOrder: 0 }]} />);
    fireEvent.click(screen.getByRole('button', { name: '模板管理与应用' })); await waitFor(() => expect(screen.getByText('健康讲座')).toBeTruthy()); fireEvent.click(screen.getByRole('button', { name: '应用' }));
    expect(screen.getAllByLabelText('跟进内容')).toHaveLength(2); expect((screen.getAllByLabelText('跟进内容')[1] as HTMLInputElement).value).toBe('邀约客户');
  });
});
