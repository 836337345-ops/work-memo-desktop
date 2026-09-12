// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkCalendar } from './WorkCalendar';
import { holidaysForYear } from './calendar';
// @ts-expect-error Vitest 在 Node 环境中读取样式契约。
import { readFileSync } from 'node:fs';
import type { WorkItem } from '../../types';

const makeItem = (overrides: Partial<WorkItem> = {}): WorkItem => ({ id: 'item-1', title: '今天事项', content: '', categoryId: null, dueDate: '2026-09-07', status: 'doing', notes: '', followUps: [], isStarred: false, progress: [], createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z', deletedAt: null, ...overrides });

beforeEach(() => vi.setSystemTime(new Date(2026, 8, 7, 12, 0)));
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('WorkCalendar', () => {
  it('默认打开本月并显示固定六周，只包含正常且有日期的事项', () => {
    render(<WorkCalendar items={[makeItem(), makeItem({ id: 'trash', title: '回收站事项', deletedAt: '2026-09-02T00:00:00Z' }), makeItem({ id: 'no-date', title: '无日期事项', dueDate: null })]} onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: '2026年9月' })).toBeTruthy();
    expect(screen.getAllByRole('gridcell')).toHaveLength(42);
    expect(document.querySelector('.work-calendar__title')?.textContent).toBe('今天事项');
    expect(screen.queryByText('回收站事项')).toBeNull();
    expect(screen.queryByText('无日期事项')).toBeNull();
    expect(document.querySelector('.work-calendar__item-status--doing')).toBeTruthy();
    expect(document.querySelector('.work-calendar__status')).toBeNull();
  });

  it('悬停或聚焦日期时提供当日全部事项标题', () => {
    const { container } = render(<WorkCalendar items={[makeItem(), makeItem({ id: 'item-2', title: '第二项', status: 'done' })]} onClose={vi.fn()} />);
    const dayButton = screen.getByRole('button', { name: /2026-09-07/ });
    fireEvent.focus(dayButton);
    const tooltip = within(container.querySelector('[data-date="2026-09-07"]') as HTMLElement).getByRole('tooltip');
    expect(tooltip.textContent).toContain('第二项');
  });

  it('日期格最多直显三条标题，更多事项显示汇总', () => {
    const { container } = render(<WorkCalendar items={[
      makeItem({ id: 'one', title: '第一项' }),
      makeItem({ id: 'two', title: '第二项' }),
      makeItem({ id: 'three', title: '第三项' }),
      makeItem({ id: 'four', title: '第四项' }),
    ]} onClose={vi.fn()} />);
    expect(Array.from(container.querySelectorAll('.work-calendar__title')).map((node) => node.textContent)).toEqual(['第一项', '第二项', '第三项']);
    expect(screen.getByText('另有 1 项')).toBeTruthy();
  });

  it('分类多选只影响当前日历，清空选择恢复全部', () => {
    const { container } = render(<WorkCalendar categories={[{ id: 'a', name: '活动', sortOrder: 0 }, { id: 'b', name: '推广', sortOrder: 1 }]} items={[
      makeItem({ id: 'a-item', title: '活动事项', categoryId: 'a' }),
      makeItem({ id: 'b-item', title: '推广事项', categoryId: 'b' }),
      makeItem({ id: 'none-item', title: '未分类事项', categoryId: null }),
    ]} onClose={vi.fn()} />);
    const directTitles = () => Array.from(container.querySelectorAll('.work-calendar__title')).map((node) => node.textContent);
    expect(directTitles()).toEqual(['活动事项', '推广事项', '未分类事项']);
    fireEvent.click(screen.getByRole('checkbox', { name: '活动' }));
    expect(directTitles()).toEqual(['活动事项']);
    fireEvent.click(screen.getByRole('checkbox', { name: '未分类' }));
    expect(directTitles()).toEqual(['活动事项', '未分类事项']);
    fireEvent.click(screen.getByRole('button', { name: '全部' }));
    expect(directTitles()).toEqual(['活动事项', '推广事项', '未分类事项']);
  });

  it('状态可多选，并与分类选择叠加', () => {
    const { container } = render(<WorkCalendar categories={[{ id: 'a', name: '活动', sortOrder: 0 }]} items={[
      makeItem({ id: 'doing', title: '进行中', categoryId: 'a', status: 'doing' }),
      makeItem({ id: 'done', title: '已完成', categoryId: 'a', status: 'done' }),
      makeItem({ id: 'paused', title: '已暂停', categoryId: null, status: 'paused' }),
    ]} onClose={vi.fn()} />);
    const titles = () => Array.from(container.querySelectorAll('.work-calendar__title')).map((node) => node.textContent);
    fireEvent.click(screen.getByRole('checkbox', { name: '进行中' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '已完成' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '活动' }));
    expect(titles()).toEqual(['进行中', '已完成']);
    fireEvent.click(screen.getByRole('button', { name: '全部状态' }));
    expect(titles()).toEqual(['进行中', '已完成']);
  });

  it('为三种事项状态渲染对应的日历标记 class', () => {
    const { container } = render(<WorkCalendar items={[
      makeItem({ id: 'doing-2', status: 'doing' }),
      makeItem({ id: 'doing', status: 'doing' }),
      makeItem({ id: 'paused', status: 'paused' }),
      makeItem({ id: 'done', status: 'done' }),
    ]} onClose={vi.fn()} />);
    expect(container.querySelector('.work-calendar__item-status--doing')).toBeTruthy();
    expect(container.querySelector('.work-calendar__item-status--paused')).toBeTruthy();
    expect(container.querySelector('.work-calendar__item-status--done')).toBeTruthy();
    expect(container.querySelector('.work-calendar__status')).toBeNull();
  });

  it('事项按钮和新增计划按钮调用对应日期回调', () => {
    const onOpenItem = vi.fn();
    const onNewItem = vi.fn();
    const { container } = render(<WorkCalendar items={[makeItem()]} onClose={vi.fn()} onOpenItem={onOpenItem} onNewItem={onNewItem} />);
    const tooltip = within(container.querySelector('[data-date="2026-09-07"]') as HTMLElement).getByRole('tooltip');
    fireEvent.click(within(tooltip).getByRole('button', { name: '今天事项' }));
    fireEvent.click(within(tooltip).getByRole('button', { name: '新增计划' }));
    expect(onOpenItem).toHaveBeenCalledWith('item-1');
    expect(onNewItem).toHaveBeenCalledWith('2026-09-07');
  });

  it('没有事项的日期也能聚焦显示空浮窗并新增计划', () => {
    const onNewItem = vi.fn();
    const { container } = render(<WorkCalendar items={[]} onClose={vi.fn()} onNewItem={onNewItem} />);
    const dayCell = container.querySelector('[data-date="2026-09-08"]') as HTMLElement;
    fireEvent.focus(within(dayCell).getByRole('button', { name: '2026-09-08' }));
    const tooltip = within(dayCell).getByRole('tooltip');
    expect(tooltip.textContent).toContain('当日暂无事项');
    fireEvent.click(within(tooltip).getByRole('button', { name: '新增计划' }));
    expect(onNewItem).toHaveBeenCalledWith('2026-09-08');
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

  it('周表头与日期数字统一右对齐', () => {
    const css = readFileSync('src/components/workbench/calendar.css', 'utf8');
    expect(css).toMatch(/\.work-calendar__weekday \{[^}]*text-align: right/);
    expect(css).toMatch(/\.work-calendar__date-row \{[^}]*justify-content: flex-end/);
    expect(css).toMatch(/\.work-calendar__day \{[^}]*padding: 8px 9px/);
  });

  it('计算跨年份节日并标红周末与节日日期', () => {
    const holidays2026 = holidaysForYear(2026);
    const holidays2027 = holidaysForYear(2027);
    expect(holidays2026.get('2026-01-01')).toBe('元旦');
    expect(holidays2026.get('2026-02-17')).toBe('春节');
    expect(holidays2026.get('2026-06-19')).toBe('端午');
    expect(holidays2026.get('2026-09-25')).toBe('中秋');
    expect(holidays2027.get('2027-02-07')).toBe('春节');
    const { container } = render(<WorkCalendar items={[]} onClose={vi.fn()} />);
    expect(container.querySelector('[data-date="2026-09-06"]')?.className).toContain('work-calendar__day--red-date');
    expect(container.querySelector('[data-date="2026-09-25"]')?.className).toContain('work-calendar__day--red-date');
    expect(screen.getByText('中秋')).toBeTruthy();
  });

  it('六周网格会显示相邻年份的节日简称', () => {
    const { container } = render(<WorkCalendar items={[]} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '下月' }));
    fireEvent.click(screen.getByRole('button', { name: '下月' }));
    fireEvent.click(screen.getByRole('button', { name: '下月' }));
    expect(container.querySelector('[data-date="2027-01-01"] .work-calendar__festival')?.textContent).toBe('元旦');
  });
});
