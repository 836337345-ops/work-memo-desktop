// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ItemList } from './ItemList';
import type { WorkItem } from '../../types';

const base: WorkItem = { id: 'one', title: '联系客户', content: '', categoryId: 'promotion', dueDate: '2000-01-01', status: 'todo', notes: '', followUps: [], progress: [{ id: 'p1', content: '今日已联系客户', createdAt: '2026-01-01T00:00:00Z' }], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', deletedAt: null };
afterEach(cleanup);

describe('事项列表显示', () => {
  it('显示最新进度和待开展事项的逾期标记', () => {
    render(<ItemList items={[base]} categories={[{ id: 'promotion', name: '推广', sortOrder: 0 }]} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText('最新进度：今日已联系客户')).toBeTruthy();
    expect(screen.getByText('逾期')).toBeTruthy();
  });

  it('不为已完成事项显示逾期标记', () => {
    render(<ItemList items={[{ ...base, status: 'done' }]} categories={[]} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.queryByText('逾期')).toBeNull();
  });
});
