// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BackupPanel } from './BackupPanel';
import { api } from '../../api';

vi.mock('@tauri-apps/plugin-dialog', () => ({ confirm: vi.fn(), open: vi.fn(), save: vi.fn() }));
vi.mock('../../api', () => ({ api: { quickBackup: vi.fn() } }));

afterEach(cleanup);

describe('BackupPanel', () => {
  it('备份提示使用统一的中文日期时间格式', async () => {
    const exportedAt = new Date(2026, 8, 6, 14, 5).toISOString();
    vi.mocked(api.quickBackup).mockResolvedValue({ path: 'D:/backup.json', schemaVersion: 1, exportedAt, itemCount: 3, categoryCount: 2 });
    render(<BackupPanel onRestored={vi.fn()} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '一键备份到本地' }));
    const notice = await screen.findByRole('status');
    expect(notice.textContent).toContain('2026年9月6日 14:05');
  });
});
