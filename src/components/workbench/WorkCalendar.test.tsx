// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkCalendar } from './WorkCalendar';
import type { WorkItem } from '../../types';

const makeItem = (overrides: Partial<WorkItem> = {}): WorkItem => ({ id: 'item-1', title: '今天事项', content: '', categoryId: null, dueDate: '2026-09-07', status: 'doing', notes: '', followUps: [], progress: [], createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z', deletedAt: null, ...overrides });

beforeEach(() => vi.setSystemTime(new Date(2026, 8, 7, 12, 0)));
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('WorkCalendar', () => {
  it('默认打开本月并显示固定六周，只包含正常且有日期的事项', () => {
    render(<WorkCalendar items={[makeItem(), makeItem({ id: 'trash', title: '回收站事项', deletedAt: '2026-09-02T00:00:00Z' }), makeItem({ id: 'no-date', title: '无日期事项', dueDate: null })]} onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: '2026年9月' })).toBeTruthy();
    expect(screen.getAllByRole('gridcell')).toHaveLength(42);
    expect(screen.getByText('今天事项')).toBeTruthy();
    expect(screen.queryByText('回收站事项')).toBeNull();
    expect(screen.queryByText('无日期事项')).toBeNull();
    expect(screen.getByTitle('进行中')).toBeTruthy();
  });

  it('悬停或聚焦日期时提供当日全部事项标题', () => {
    render(<WorkCalendar items={[makeItem(), makeItem({ id: 'item-2', title: '第二项', status: 'done' })]} onClose={vi.fn()} />);
    const dayButton = screen.getByRole('button', { name: /2026-09-07/ });
    fireEvent.focus(dayButton);
    expect(screen.getByRole('tooltip')).toBeTruthy();
    expect(screen.getByText('第二项')).toBeTruthy();
  });

  it('为四种事项状态渲染对应的日历标记 class', () => {
    const { container } = render(<WorkCalendar items={[
      makeItem({ id: 'todo', status: 'todo' }),
      makeItem({ id: 'doing', status: 'doing' }),
      makeItem({ id: 'paused', status: 'paused' }),
      makeItem({ id: 'done', status: 'done' }),
    ]} onClose={vi.fn()} />);
    expect(container.querySelector('.work-calendar__status--todo')).toBeTruthy();
    expect(container.querySelector('.work-calendar__status--doing')).toBeTruthy();
    expect(container.querySelector('.work-calendar__status--paused')).toBeTruthy();
    expect(container.querySelector('.work-calendar__status--done')).toBeTruthy();
  });

  it('支持上月、今天、下月和关闭日历', () => {
    const onClose = vi.fn();
    render(<WorkCalendar items={[]} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '下月' }));
    expect(screen.getByRole('heading', { name: '2026年10月' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '上月' }));
    expect(screen.getByRole('heading', { name: '2026年9月' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '关闭日历' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
