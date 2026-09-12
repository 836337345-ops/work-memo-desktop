// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { api } from './api';
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart';

const { appWindow } = vi.hoisted(() => ({ appWindow: { onCloseRequested: vi.fn(() => Promise.resolve(() => undefined)), close: vi.fn(), setTitle: vi.fn(() => Promise.resolve()) } }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: vi.fn(() => appWindow) }));
vi.mock('./api', () => ({ api: { listItems: vi.fn(), listCategories: vi.fn() } }));
vi.mock('@tauri-apps/plugin-autostart', () => ({ isEnabled: vi.fn(), enable: vi.fn(), disable: vi.fn() }));

afterEach(cleanup);
beforeEach(() => {
  window.localStorage.clear();
  appWindow.setTitle.mockClear();
  vi.mocked(api.listItems).mockResolvedValue([]);
  vi.mocked(api.listCategories).mockResolvedValue([]);
  vi.mocked(isEnabled).mockResolvedValue(false);
  vi.mocked(enable).mockResolvedValue();
  vi.mocked(disable).mockResolvedValue();
});

describe('App 开机自启动', () => {
  it('初始化时读取真实开机自启动状态，读取失败时提示并禁止切换', async () => {
    vi.mocked(isEnabled).mockRejectedValueOnce(new Error('读取失败'));
    render(<App />);
    const toggle = await screen.findByRole('switch', { name: '开机自启动' }) as HTMLButtonElement;
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('无法读取开机自启动设置'));
    expect(toggle.disabled).toBe(true);
    expect(enable).not.toHaveBeenCalled();
  });

  it('开启成功后重新读取真实状态', async () => {
    vi.mocked(isEnabled).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<App />);
    const toggle = await screen.findByRole('switch', { name: '开机自启动' }) as HTMLButtonElement;
    await waitFor(() => expect(toggle.disabled).toBe(false));
    fireEvent.click(toggle);
    await waitFor(() => expect(enable).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(isEnabled).toHaveBeenCalledTimes(2));
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('关闭成功后重新读取真实状态', async () => {
    vi.mocked(isEnabled).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    render(<App />);
    const toggle = await screen.findByRole('switch', { name: '开机自启动' }) as HTMLButtonElement;
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'));
    fireEvent.click(toggle);
    await waitFor(() => expect(disable).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(isEnabled).toHaveBeenCalledTimes(2));
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

  it('开启或关闭失败时保留原状态并显示提示', async () => {
    vi.mocked(enable).mockRejectedValueOnce(new Error('写入失败'));
    render(<App />);
    const toggle = await screen.findByRole('switch', { name: '开机自启动' }) as HTMLButtonElement;
    await waitFor(() => expect(toggle.disabled).toBe(false));
    fireEvent.click(toggle);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('无法更新开机自启动设置'));
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    cleanup();
    vi.mocked(isEnabled).mockResolvedValueOnce(true);
    vi.mocked(disable).mockRejectedValueOnce(new Error('写入失败'));
    render(<App />);
    const enabledToggle = await screen.findByRole('switch', { name: '开机自启动' }) as HTMLButtonElement;
    await waitFor(() => expect(enabledToggle.getAttribute('aria-checked')).toBe('true'));
    fireEvent.click(enabledToggle);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('无法更新开机自启动设置'));
    expect(enabledToggle.getAttribute('aria-checked')).toBe('true');
  });

  it('切换期间忽略连续点击', async () => {
    let finishEnable: (() => void) | undefined;
    vi.mocked(enable).mockImplementationOnce(() => new Promise<void>((resolve) => { finishEnable = resolve; }));
    render(<App />);
    const toggle = await screen.findByRole('switch', { name: '开机自启动' }) as HTMLButtonElement;
    await waitFor(() => expect(toggle.disabled).toBe(false));
    fireEvent.click(toggle); fireEvent.click(toggle);
    expect(enable).toHaveBeenCalledTimes(1);
    expect(toggle.disabled).toBe(true);
    finishEnable?.();
    await waitFor(() => expect(toggle.disabled).toBe(false));
  });
});

describe('App 工作台名称设置', () => {
  it('默认显示工作台，并同步默认窗口标题', async () => {
    render(<App />);
    expect(await screen.findByText('工作台', { selector: '.sidebar-workbench-name' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '修改' })).toBeTruthy();
    expect(document.querySelector('.workspace-header .workbench-name-row')).toBeNull();
    await waitFor(() => expect(appWindow.setTitle).toHaveBeenCalledWith('工作台'));
  });

  it('窗口标题同步失败时保留工作台可用性并输出诊断', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    appWindow.setTitle.mockRejectedValueOnce(new Error('权限不足'));
    render(<App />);
    expect(await screen.findByText('工作台')).toBeTruthy();
    await waitFor(() => expect(warning).toHaveBeenCalledWith('工作台名称已保存，但窗口标题同步失败：', expect.any(Error)));
    warning.mockRestore();
  });

  it('保存时会去除首尾空白、写入本机设置并同步窗口标题', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '修改' }));
    fireEvent.change(screen.getByLabelText('工作台名称'), { target: { value: '  秋季活动筹备  ' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('秋季活动筹备')).toBeTruthy();
    expect(window.localStorage.getItem('work-memo.workbench-name')).toBe('秋季活动筹备');
    await waitFor(() => expect(appWindow.setTitle).toHaveBeenLastCalledWith('秋季活动筹备'));
  });

  it('重启后从本机设置恢复名称', async () => {
    window.localStorage.setItem('work-memo.workbench-name', '项目推进');
    render(<App />);
    expect(await screen.findByText('项目推进')).toBeTruthy();
    await waitFor(() => expect(appWindow.setTitle).toHaveBeenCalledWith('项目推进'));
  });

  it('切换日历、回收站和筛选后不会丢失名称', async () => {
    window.localStorage.setItem('work-memo.workbench-name', '年度重点');
    render(<App />);
    expect(await screen.findByText('年度重点')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '工作日历' }));
    expect(await screen.findByRole('button', { name: '关闭日历' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '关闭日历' }));
    expect(await screen.findByText('年度重点')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '回收站' }));
    expect(screen.getByText('年度重点')).toBeTruthy();
    fireEvent.click(document.querySelector('.sidebar-show-all') as HTMLButtonElement);
    expect(await screen.findByText('年度重点')).toBeTruthy();
  });

  it('列表页和日历页不在中间区域重复显示工作台名称或名称设置入口', async () => {
    window.localStorage.setItem('work-memo.workbench-name', '年度重点');
    render(<App />);
    await screen.findByText('年度重点', { selector: '.sidebar-workbench-name' });
    expect(document.querySelector('.list-pane .sidebar-workbench-name')).toBeNull();
    expect(document.querySelector('.workspace-header .sidebar-workbench-settings')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '工作日历' }));
    await screen.findByRole('button', { name: '关闭日历' });
    expect(document.querySelector('.list-pane .sidebar-workbench-name')).toBeNull();
    expect(document.querySelector('.work-calendar .sidebar-workbench-settings')).toBeNull();
  });

  it('空名称不能保存，并给出中文提示', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '修改' }));
    fireEvent.change(screen.getByLabelText('工作台名称'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    expect((await screen.findByRole('alert')).textContent).toContain('请输入工作台名称后再保存。');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('名称输入框限制为 30 个字符，取消不会保存草稿', async () => {
    window.localStorage.setItem('work-memo.workbench-name', '原工作台');
    render(<App />);
    expect(await screen.findByText('原工作台')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '修改' }));
    const input = screen.getByLabelText('工作台名称') as HTMLInputElement;
    expect(input.maxLength).toBe(30);
    fireEvent.change(input, { target: { value: '仅作草稿，不应保存' } });
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('原工作台')).toBeTruthy();
    expect(window.localStorage.getItem('work-memo.workbench-name')).toBe('原工作台');
  });

  it('恢复默认会移除本机保存的名称并同步窗口标题', async () => {
    window.localStorage.setItem('work-memo.workbench-name', '旧名称');
    render(<App />);
    await screen.findByText('旧名称');
    fireEvent.click(screen.getByRole('button', { name: '修改' }));
    fireEvent.click(screen.getByRole('button', { name: '恢复默认' }));
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('工作台')).toBeTruthy();
    expect(window.localStorage.getItem('work-memo.workbench-name')).toBeNull();
    await waitFor(() => expect(appWindow.setTitle).toHaveBeenLastCalledWith('工作台'));
  });
});

describe('App 工作日历入口', () => {
  it('启动默认显示工作日历；快捷入口会返回列表、清除搜索并恢复筛选', async () => {
    render(<App />);
    const month = new Date();
    expect(await screen.findByRole('heading', { name: `${month.getFullYear()}年${month.getMonth() + 1}月` })).toBeTruthy();
    fireEvent.click(document.querySelector('.sidebar-show-doing') as HTMLButtonElement);
    expect(await screen.findByRole('heading', { name: '进行中' })).toBeTruthy();
    const search = screen.getByPlaceholderText('搜索标题、内容、进度、跟进或备注') as HTMLInputElement;
    fireEvent.change(search, { target: { value: '临时关键词' } });
    fireEvent.click(document.querySelector('.sidebar-show-all') as HTMLButtonElement);
    await waitFor(() => expect(screen.getByRole('heading', { name: '全部事项' })).toBeTruthy());
    fireEvent.click(document.querySelector('.sidebar-show-doing') as HTMLButtonElement);
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
    fireEvent.click(document.querySelector('.sidebar-show-all') as HTMLButtonElement);
    await waitFor(() => expect(screen.getByRole('heading', { name: '全部事项' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: '工作日历' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: `${month.getFullYear()}年${month.getMonth() + 1}月` })).toBeTruthy());
    fireEvent.click(document.querySelector('.sidebar-show-doing') as HTMLButtonElement);
    await waitFor(() => expect(screen.getByRole('heading', { name: '进行中' })).toBeTruthy());
  });

  it('从日历事项返回工作台并展开对应卡片，但不打开编辑栏', async () => {
    const today = new Date();
    const dueDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    vi.mocked(api.listItems).mockResolvedValue([{ id: 'calendar-item', title: '日历跳转事项', content: '事项情况', categoryId: null, dueDate, status: 'doing', notes: '', followUps: [], isStarred: false, progress: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', deletedAt: null }]);
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
