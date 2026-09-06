// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ItemEditor from './ItemEditor';
import { api } from '../api';
import type { FollowUpTemplate, ItemInput, WorkItem } from '../types';

vi.mock('../api', () => ({ api: { createItem: vi.fn(), updateItem: vi.fn(), trashItem: vi.fn(), listFollowUpTemplates: vi.fn(), createFollowUpTemplate: vi.fn(), updateFollowUpTemplate: vi.fn(), deleteFollowUpTemplate: vi.fn() } }));
const savedItem = (input: ItemInput, overrides: Partial<WorkItem> = {}): WorkItem => ({ ...input, id: 'item-1', createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z', deletedAt: null, progress: [], ...overrides });
const base = savedItem({ title: '原事项', content: '', categoryId: null, dueDate: null, status: 'todo', notes: '', followUps: [] });
const props = { item: base, categories: [], onSaved: vi.fn(), onDeleted: vi.fn(), onCancel: vi.fn() };

describe('V2.3 ItemEditor', () => {
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

  it('只显示约定的编辑字段，隐藏状态和进度记录，但保存时保留既有状态', async () => {
    vi.mocked(api.updateItem).mockImplementation(async (_id, input) => savedItem(input));
    render(<ItemEditor {...props} />);
    expect(screen.getByLabelText('事项情况')).toBeTruthy(); expect(screen.queryByLabelText('当前状态')).toBeNull(); expect(screen.queryByLabelText('新的进度')).toBeNull(); expect(screen.queryByText('进度记录')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '保存并关闭' }));
    await waitFor(() => expect(api.updateItem).toHaveBeenCalledWith('item-1', expect.objectContaining({ status: 'todo' })));
  });

  it('只展示当前类别模板，应用时按 trim 后文字跳过重复项', async () => {
    const template: FollowUpTemplate = { id: 'tpl-1', categoryId: 'cat', name: '健康讲座', items: ['确认场地', '邀约客户', ' 邀约客户 '], sortOrder: 0, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' }; vi.mocked(api.listFollowUpTemplates).mockResolvedValue([template]);
    render(<ItemEditor {...props} item={savedItem({ ...base, categoryId: 'cat', followUps: [{ id: 'f1', text: ' 确认场地 ', done: false }] })} categories={[{ id: 'cat', name: '活动', sortOrder: 0 }]} />);
    fireEvent.click(screen.getByRole('button', { name: '模板管理与应用' })); await waitFor(() => expect(screen.getByText('健康讲座')).toBeTruthy()); fireEvent.click(screen.getByRole('button', { name: '应用' }));
    expect(screen.getAllByLabelText('跟进内容')).toHaveLength(2); expect((screen.getAllByLabelText('跟进内容')[1] as HTMLInputElement).value).toBe('邀约客户');
  });

  it('可新建模板并提交名称与有序文字项', async () => {
    const created: FollowUpTemplate = { id: 'tpl-new', categoryId: 'cat', name: '车库开放', items: ['确认流程'], sortOrder: 0, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' }; vi.mocked(api.createFollowUpTemplate).mockResolvedValue([created]);
    render(<ItemEditor {...props} item={savedItem({ ...base, categoryId: 'cat' })} categories={[{ id: 'cat', name: '活动', sortOrder: 0 }]} />); fireEvent.click(screen.getByRole('button', { name: '＋ 新建模板' }));
    fireEvent.change(screen.getByLabelText('模板名称'), { target: { value: '车库开放' } }); fireEvent.change(screen.getByLabelText('模板文字项 1'), { target: { value: '确认流程' } }); fireEvent.click(screen.getByRole('button', { name: '保存模板' }));
    await waitFor(() => expect(api.createFollowUpTemplate).toHaveBeenCalledWith({ categoryId: 'cat', name: '车库开放', items: ['确认流程'] }));
  });

  it('可编辑已有模板并保留当前类别', async () => {
    const template: FollowUpTemplate = { id: 'tpl-1', categoryId: 'cat', name: '旧模板', items: ['旧事项'], sortOrder: 0, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' }; vi.mocked(api.listFollowUpTemplates).mockResolvedValue([template]); vi.mocked(api.updateFollowUpTemplate).mockResolvedValue([{ ...template, name: '新模板' }]);
    render(<ItemEditor {...props} item={savedItem({ ...base, categoryId: 'cat' })} categories={[{ id: 'cat', name: '活动', sortOrder: 0 }]} />); fireEvent.click(screen.getByRole('button', { name: '模板管理与应用' })); await waitFor(() => expect(screen.getByText('旧模板')).toBeTruthy()); fireEvent.click(screen.getByRole('button', { name: '编辑' }));
    fireEvent.change(screen.getByLabelText('模板名称'), { target: { value: '新模板' } }); fireEvent.click(screen.getByRole('button', { name: '保存模板' })); await waitFor(() => expect(api.updateFollowUpTemplate).toHaveBeenCalledWith('tpl-1', { categoryId: 'cat', name: '新模板', items: ['旧事项'] }));
  });

  it('可删除已有模板', async () => {
    const template: FollowUpTemplate = { id: 'tpl-1', categoryId: 'cat', name: '待删除', items: ['确认'], sortOrder: 0, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' }; vi.mocked(api.listFollowUpTemplates).mockResolvedValue([template]); vi.mocked(api.deleteFollowUpTemplate).mockResolvedValue([]);
    render(<ItemEditor {...props} item={savedItem({ ...base, categoryId: 'cat' })} categories={[{ id: 'cat', name: '活动', sortOrder: 0 }]} />); fireEvent.click(screen.getByRole('button', { name: '模板管理与应用' })); await waitFor(() => expect(screen.getByText('待删除')).toBeTruthy()); fireEvent.click(screen.getByRole('button', { name: '删除模板：待删除' })); await waitFor(() => expect(api.deleteFollowUpTemplate).toHaveBeenCalledWith('tpl-1'));
  });

  it('模板校验失败时在弹窗内显示错误并保留输入', async () => {
    render(<ItemEditor {...props} item={savedItem({ ...base, categoryId: 'cat' })} categories={[{ id: 'cat', name: '活动', sortOrder: 0 }]} />); fireEvent.click(screen.getByRole('button', { name: '＋ 新建模板' })); fireEvent.change(screen.getByLabelText('模板名称'), { target: { value: '保留名称' } }); fireEvent.click(screen.getByRole('button', { name: '保存模板' }));
    const alert = await screen.findByRole('alert'); expect(alert.textContent).toContain('请填写模板名称'); expect((screen.getByLabelText('模板名称') as HTMLInputElement).value).toBe('保留名称'); expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
