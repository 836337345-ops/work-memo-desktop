import { afterEach, describe, expect, it } from 'vitest';
import { clearMocks } from '@tauri-apps/api/mocks';
import { api } from '../../src/api';
import { itemInput } from '../support/fixtures';
import { WorkMemoIpcDouble } from '../support/tauri-ipc';

afterEach(() => clearMocks());

describe('前端 IPC 契约（内存模拟，不访问 SQLite）', () => {
  it('创建、自动保存和进度提交分别调用固定接口，进度历史不会被普通保存覆盖', async () => {
    const ipc = new WorkMemoIpcDouble();
    ipc.install();
    const created = await api.createItem(itemInput({ title: '国庆案场暖场推广' }));
    const edited = await api.updateItem(created.id, itemInput({ title: '国庆案场暖场推广（已改）', status: 'doing' }));
    const withProgress = await api.addProgress(edited.id, '灯箱画面已定稿。');

    expect(withProgress.title).toBe('国庆案场暖场推广（已改）');
    expect(withProgress.progress[0]?.content).toBe('灯箱画面已定稿。');
    expect(ipc.calls.map((call) => call.command)).toEqual(['create_item', 'update_item', 'add_progress']);
  });

  it('分类管理、回收站和备份接口携带约定的参数', async () => {
    const ipc = new WorkMemoIpcDouble();
    ipc.install();
    await api.createCategory('拓展');
    await api.renameCategory('cat-event', '活动执行');
    await api.reorderCategories(['cat-package', 'cat-promotion', 'cat-event', 'cat-4']);
    await api.deleteCategory('cat-event');
    await api.trashItem('item-autumn-launch');
    await api.restoreItem('item-autumn-launch');
    await api.exportBackup('C:/qa-isolated/export.json');
    await api.inspectBackup('C:/qa-isolated/export.json');
    await api.restoreBackup('C:/qa-isolated/export.json');

    expect(ipc.calls.map((call) => call.command)).toEqual([
      'create_category', 'rename_category', 'reorder_categories', 'delete_category',
      'trash_item', 'restore_item', 'export_backup', 'inspect_backup', 'restore_backup',
    ]);
    expect(ipc.items[0]?.deletedAt).toBeNull();
    expect(ipc.items[0]?.categoryId).toBe('cat-promotion');
  });

  it('保存或恢复失败时将中文错误交给界面，不产生伪成功结果', async () => {
    const ipc = new WorkMemoIpcDouble({ update_item: '保存失败：测试磁盘不可用', restore_backup: '恢复失败：备份文件校验不通过' });
    ipc.install();
    await expect(api.updateItem('item-autumn-launch', itemInput())).rejects.toThrow('保存失败：测试磁盘不可用');
    await expect(api.restoreBackup('C:/qa-isolated/bad.json')).rejects.toThrow('恢复失败：备份文件校验不通过');
  });
});
