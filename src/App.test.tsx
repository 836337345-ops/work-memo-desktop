// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { api } from './api';

vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: vi.fn(() => ({ onCloseRequested: vi.fn(() => Promise.resolve(() => undefined)), close: vi.fn() })) }));
vi.mock('./api', () => ({ api: { listItems: vi.fn(), listCategories: vi.fn() } }));

afterEach(cleanup);
beforeEach(() => {
  vi.mocked(api.listItems).mockResolvedValue([]);
  vi.mocked(api.listCategories).mockResolvedValue([]);
});

describe('App 工作日历入口', () => {
  it('启动默认显示进行中工作，快捷入口会清除搜索并恢复该筛选', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: '进行中' })).toBeTruthy();
    const search = screen.getByPlaceholderText('搜索标题、内容、进度、跟进或备注') as HTMLInputElement;
    fireEvent.change(search, { target: { value: '临时关键词' } });
    fireEvent.click(screen.getByRole('button', { name: '显示全部' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: '全部事项' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: '显示进行中工作' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: '进行中' })).toBeTruthy());
    expect(search.value).toBe('');
  });

  it('日历模式可通过两个快捷入口返回列表，并恢复对应筛选', async () => {
    render(<App />);
    const entry = await screen.findByRole('button', { name: '工作日历' });
    fireEvent.click(entry);
    const month = new Date();
    await waitFor(() => expect(screen.getByRole('heading', { name: `${month.getFullYear()}年${month.getMonth() + 1}月` })).toBeTruthy());
    expect(document.querySelector('.app-shell')?.className).toContain('without-editor');
    expect(screen.getByRole('button', { name: '关闭日历' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '显示全部' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: '全部事项' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: '工作日历' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: `${month.getFullYear()}年${month.getMonth() + 1}月` })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: '显示进行中工作' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: '进行中' })).toBeTruthy());
  });

  it('从日历事项返回工作台并展开对应卡片，但不打开编辑栏', async () => {
    const today = new Date();
    const dueDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    vi.mocked(api.listItems).mockResolvedValue([{ id: 'calendar-item', title: '日历跳转事项', content: '事项情况', categoryId: null, dueDate, status: 'doing', notes: '', followUps: [], progress: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', deletedAt: null }]);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '工作日历' }));
    const day = await waitFor(() => {
      const element = document.querySelector(`[data-date="${dueDate}"]`) as HTMLElement | null;
      expect(element).toBeTruthy();
      return element as HTMLElement;
    });
    fireEvent.click(day.querySelector('.work-calendar__item-button') as HTMLButtonElement);
    const card = await screen.findByRole('article', { name: '事项：日历跳转事项' });
    await waitFor(() => expect(card.className).toContain('is-revealed'));
    expect(await screen.findByRole('button', { name: '收起事项' })).toBeTruthy();
    expect(document.querySelector('.app-shell')?.className).toContain('without-editor');
  });

  it('从空日期新增计划时打开新建栏并预填该日期', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '工作日历' }));
    const firstDay = await waitFor(() => {
      const element = document.querySelector('.work-calendar__day') as HTMLElement | null;
      expect(element).toBeTruthy();
      return element as HTMLElement;
    });
    const dueDate = firstDay.dataset.date ?? '';
    fireEvent.click(firstDay.querySelector('.work-calendar__new-item') as HTMLButtonElement);
    await waitFor(() => expect(screen.getByRole('region', { name: '事项编辑器' })).toBeTruthy());
    expect((screen.getByLabelText('截止日期') as HTMLInputElement).value).toBe(dueDate);
  });
});
