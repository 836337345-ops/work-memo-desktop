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

  it('分类管理、回收站、备份与 V2 文本导出接口携带约定的参数', async () => {
    const ipc = new WorkMemoIpcDouble();
    ipc.install();
    await api.createCategory('拓展');
    await api.renameCategory('cat-event', '活动执行');
    await api.reorderCategories(['cat-package', 'cat-promotion', 'cat-event', 'cat-4']);
    await api.deleteCategory('cat-event');
    await api.trashItem('item-autumn-launch');
    await api.restoreItem('item-autumn-launch');
    await api.exportBackup('C:/qa-isolated/export.json');
    const quick = await api.quickBackup();
    const exported = await api.exportWorkItems({ path: 'C:/qa-isolated/事项.txt', statuses: ['doing'], dateFilters: ['nextWeek'], categoryIds: ['cat-promotion', null] });
    await api.inspectBackup('C:/qa-isolated/export.json');
    await api.restoreBackup('C:/qa-isolated/export.json');

    expect(ipc.calls.map((call) => call.command)).toEqual([
      'create_category', 'rename_category', 'reorder_categories', 'delete_category',
      'trash_item', 'restore_item', 'export_backup', 'quick_backup', 'export_work_items', 'inspect_backup', 'restore_backup',
    ]);
    expect(quick.path).toContain('工作备份文件20260906.json');
    expect(exported).toMatchObject({ path: 'C:/qa-isolated/事项.txt', itemCount: 1 });
    expect(ipc.items[0]?.deletedAt).toBeNull();
    expect(ipc.items[0]?.categoryId).toBe('cat-promotion');
  });

  it('保存或恢复失败时将中文错误交给界面，不产生伪成功结果', async () => {
    const ipc = new WorkMemoIpcDouble({ update_item: '保存失败：测试磁盘不可用', restore_backup: '恢复失败：备份文件校验不通过' });
    ipc.install();
    await expect(api.updateItem('item-autumn-launch', itemInput())).rejects.toThrow('保存失败：测试磁盘不可用');
    await expect(api.restoreBackup('C:/qa-isolated/bad.json')).rejects.toThrow('恢复失败：备份文件校验不通过');
  });

  it('跟进模板 CRUD 固定走独立接口，并按分类隔离、删除分类时级联清理', async () => {
    const ipc = new WorkMemoIpcDouble();
    ipc.install();
    const initial = await api.listFollowUpTemplates();
    expect(initial.map((template) => template.categoryId)).toEqual(['cat-promotion', 'cat-event']);
    const created = await api.createFollowUpTemplate({ categoryId: 'cat-promotion', name: '首访流程', items: ['确认需求', '安排首访'] });
    expect(created.some((template) => template.name === '首访流程' && template.categoryId === 'cat-promotion')).toBe(true);
    const newTemplate = created.find((template) => template.name === '首访流程');
    expect(newTemplate).toBeTruthy();
    await api.updateFollowUpTemplate(newTemplate!.id, { categoryId: 'cat-promotion', name: '首访流程（更新）', items: ['确认需求'] });
    await api.deleteFollowUpTemplate(newTemplate!.id);
    await api.deleteCategory('cat-event');
    expect((await api.listFollowUpTemplates()).every((template) => template.categoryId !== 'cat-event')).toBe(true);
    expect(ipc.calls.map((call) => call.command)).toEqual([
      'list_follow_up_templates', 'create_follow_up_template', 'update_follow_up_template', 'delete_follow_up_template', 'delete_category', 'list_follow_up_templates',
    ]);
  });

  it('模板非法输入失败且不会写入重复项目', async () => {
    const ipc = new WorkMemoIpcDouble();
    ipc.install();
    await expect(api.createFollowUpTemplate({ categoryId: 'cat-promotion', name: '坏模板', items: ['重复', ' 重复 '] })).rejects.toThrow('重复');
    await expect(api.createFollowUpTemplate({ categoryId: 'missing', name: '坏模板', items: ['项目'] })).rejects.toThrow('不存在');
    expect((await api.listFollowUpTemplates()).some((template) => template.name === '坏模板')).toBe(false);
  });
});
