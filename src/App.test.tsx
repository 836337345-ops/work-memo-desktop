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
  it('点击工作日历后切换只读月历并隐藏编辑栏', async () => {
    render(<App />);
    const entry = await screen.findByRole('button', { name: '工作日历' });
    fireEvent.click(entry);
    const month = new Date();
    await waitFor(() => expect(screen.getByRole('heading', { name: `${month.getFullYear()}年${month.getMonth() + 1}月` })).toBeTruthy());
    expect(document.querySelector('.app-shell')?.className).toContain('without-editor');
    expect(screen.getByRole('button', { name: '关闭日历' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '显示全部' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: '全部事项' })).toBeTruthy());
  });
});
