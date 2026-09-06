// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { ItemList } from './ItemList';
import type { ItemInput, WorkItem } from '../../types';

vi.mock('../../api', () => ({ api: { updateItem: vi.fn(), addProgress: vi.fn() } }));

const base: WorkItem = { id: 'one', title: '联系客户', content: '确认本周合作方案', categoryId: 'promotion', dueDate: '2000-01-01', status: 'todo', notes: '优先电话沟通', followUps: [{ id: 'f1', text: '确认联系人', done: false }], progress: [{ id: 'p1', content: '今日已联系客户', createdAt: '2026-01-01T00:00:00Z' }], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', deletedAt: null };
const categories = [{ id: 'promotion', name: '推广', sortOrder: 0 }];
const saved = (input: ItemInput, overrides: Partial<WorkItem> = {}): WorkItem => ({ ...base, ...input, updatedAt: '2026-01-02T00:00:00Z', ...overrides });
const props = () => ({ items: [base], categories, selectedId: null, onSelect: vi.fn(), onChanged: vi.fn(), onError: vi.fn() });

afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); vi.mocked(api.updateItem).mockImplementation(async (_id, input) => saved(input)); });

describe('事项卡内联编辑', () => {
  it('直接展示事项信息、最新进度和逾期标记，并保留详情编辑入口', () => {
    const next = props();
    render(<ItemList {...next} />);
    expect(screen.getByText('联系客户')).toBeTruthy();
    expect(screen.getByText('确认本周合作方案')).toBeTruthy();
    expect(screen.getByText('今日已联系客户')).toBeTruthy();
    expect(screen.getByText('确认联系人')).toBeTruthy();
    expect((screen.getByLabelText('联系客户的备注') as HTMLTextAreaElement).value).toBe('优先电话沟通');
    expect(screen.getByText('逾期')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '修改编辑' }));
    expect(next.onSelect).toHaveBeenCalledWith(base);
  });

  it('可提交进度、编辑备注和跟进、修改状态及一键完成', async () => {
    const next = props();
    vi.mocked(api.addProgress).mockResolvedValue(saved(base, { progress: [{ id: 'p2', content: '报价已发送', createdAt: '2026-01-02T00:00:00Z' }, ...base.progress] }));
    render(<ItemList {...next} />);

    fireEvent.change(screen.getByLabelText('新增进度'), { target: { value: '报价已发送' } });
    fireEvent.click(screen.getByRole('button', { name: '提交新进度' }));
    await waitFor(() => expect(api.addProgress).toHaveBeenCalledWith('one', '报价已发送'));
    expect(await screen.findByText('报价已发送')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('联系客户的备注'), { target: { value: '改为下午联系' } });
    fireEvent.change(screen.getByLabelText('跟进内容'), { target: { value: '确认最终联系人' } });
    fireEvent.click(screen.getByLabelText('完成：确认最终联系人'));
    fireEvent.click(screen.getByRole('button', { name: /添加跟进/ }));
    await waitFor(() => expect(api.updateItem).toHaveBeenCalled());
    fireEvent.click(screen.getAllByRole('button', { name: '删除跟进' })[0]);

    fireEvent.change(screen.getByLabelText('联系客户的状态'), { target: { value: 'doing' } });
    fireEvent.click(screen.getByRole('button', { name: '一键完成' }));
    await waitFor(() => expect(vi.mocked(api.updateItem).mock.calls.some(([, input]) => input.status === 'done')).toBe(true));
    expect(next.onChanged).toHaveBeenCalled();
  });

  it('内联保存失败时保留输入、提示根组件，且回收站保持只读并可还原', async () => {
    const next = props();
    vi.mocked(api.updateItem).mockRejectedValueOnce(new Error('本地数据库暂不可写'));
    render(<ItemList {...next} />);
    const notes = screen.getByLabelText('联系客户的备注');
    fireEvent.change(notes, { target: { value: '不要丢失这段备注' } });
    expect((notes as HTMLTextAreaElement).value).toBe('不要丢失这段备注');
    expect((await screen.findByRole('alert')).textContent).toContain('本地数据库暂不可写');
    expect(next.onError).toHaveBeenCalledWith('本地数据库暂不可写');

    cleanup();
    const onRestore = vi.fn();
    render(<ItemList items={[{ ...base, deletedAt: '2026-01-03T00:00:00Z' }]} categories={categories} selectedId={null} onSelect={vi.fn()} onRestore={onRestore} />);
    expect(screen.queryByRole('button', { name: '一键完成' })).toBeNull();
    expect(screen.getByLabelText('联系客户的备注').hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '还原' }));
    expect(onRestore).toHaveBeenCalled();
  });
});
