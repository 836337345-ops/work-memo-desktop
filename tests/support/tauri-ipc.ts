import { mockIPC } from '@tauri-apps/api/mocks';
import type { Category, FollowUpTemplate, FollowUpTemplateInput, ItemInput, WorkItem, WorkItemsExportInput } from '../../src/types';
import { QA_NOW, launchItem, qaCategories } from './fixtures';

export type IpcCall = { command: string; payload: Record<string, unknown> | undefined };
export type IpcFailure = Partial<Record<string, string>>;

/**
 * In-memory IPC contract double. It deliberately has no filesystem or SQLite
 * implementation, so it is safe for browser/component QA only.
 */
export class WorkMemoIpcDouble {
  calls: IpcCall[] = [];
  categories: Category[] = qaCategories.map((category) => ({ ...category }));
  items: WorkItem[] = [{ ...launchItem, followUps: launchItem.followUps.map((x) => ({ ...x })) }];
  templates: FollowUpTemplate[] = [
    { id: 'template-promotion', categoryId: 'cat-promotion', name: '开放日流程', items: ['确认场地', '邀约客户', '准备物料'], sortOrder: 0, createdAt: QA_NOW, updatedAt: QA_NOW },
    { id: 'template-event', categoryId: 'cat-event', name: '活动复盘', items: ['汇总到访', '整理反馈'], sortOrder: 0, createdAt: QA_NOW, updatedAt: QA_NOW },
  ];

  constructor(private readonly failures: IpcFailure = {}) {}

  install() {
    mockIPC((command, payload) => this.invoke(command, payload as Record<string, unknown>));
  }

  private fail(command: string) {
    const message = this.failures[command];
    if (message) throw new Error(message);
  }

  private touch(item: WorkItem): WorkItem {
    item.updatedAt = QA_NOW;
    return item;
  }

  invoke(command: string, payload?: Record<string, unknown>) {
    this.calls.push({ command, payload });
    this.fail(command);
    switch (command) {
      case 'list_items': return this.items.map((item) => ({ ...item }));
      case 'list_categories': return this.categories.map((category) => ({ ...category }));
      case 'create_item': {
        const input = payload?.input as ItemInput;
        const item: WorkItem = { ...input, id: `item-${this.items.length + 1}`, createdAt: QA_NOW, updatedAt: QA_NOW, deletedAt: null, progress: [] };
        this.items.push(item);
        return { ...item };
      }
      case 'update_item': {
        const item = this.item(payload?.id);
        Object.assign(item, payload?.input as ItemInput);
        return { ...this.touch(item) };
      }
      case 'add_progress': {
        const item = this.item(payload?.id);
        item.progress.unshift({ id: `progress-${item.progress.length + 1}`, content: String(payload?.content), createdAt: QA_NOW });
        return { ...this.touch(item) };
      }
      case 'trash_item': this.item(payload?.id).deletedAt = QA_NOW; return null;
      case 'restore_item': { const item = this.item(payload?.id); item.deletedAt = null; return { ...this.touch(item) }; }
      case 'create_category': {
        const category = { id: `cat-${this.categories.length + 1}`, name: String(payload?.name), sortOrder: this.categories.length };
        this.categories.push(category); return this.categories.map((value) => ({ ...value }));
      }
      case 'rename_category': { this.category(payload?.id).name = String(payload?.name); return this.categories.map((value) => ({ ...value })); }
      case 'delete_category': {
        const id = String(payload?.id);
        this.categories = this.categories.filter((category) => category.id !== id);
        this.items.forEach((item) => { if (item.categoryId === id) item.categoryId = null; });
        this.templates = this.templates.filter((template) => template.categoryId !== id);
        return this.categories.map((value) => ({ ...value }));
      }
      case 'reorder_categories': {
        const ids = payload?.ids as string[];
        if (ids.length !== this.categories.length || new Set(ids).size !== ids.length || ids.some((id) => !this.categories.some((category) => category.id === id))) {
          throw new Error('分类排序数据无效');
        }
        this.categories = ids.map((id, sortOrder) => ({ ...this.category(id), sortOrder }));
        return this.categories.map((value) => ({ ...value }));
      }
      case 'list_follow_up_templates': return this.templates.map((template) => ({ ...template, items: [...template.items] }));
      case 'create_follow_up_template': {
        const input = this.validateTemplate(payload?.input as FollowUpTemplateInput);
        if (this.templates.some((template) => template.categoryId === input.categoryId && template.name === input.name)) throw new Error('同一分类内模板名称不能重复。');
        const template: FollowUpTemplate = { ...input, id: `template-${this.templates.length + 1}`, sortOrder: this.templates.filter((value) => value.categoryId === input.categoryId).length, createdAt: QA_NOW, updatedAt: QA_NOW };
        this.templates.push(template); return this.templates.map((value) => ({ ...value, items: [...value.items] }));
      }
      case 'update_follow_up_template': {
        const existing = this.template(payload?.id);
        const input = this.validateTemplate(payload?.input as FollowUpTemplateInput);
        if (this.templates.some((template) => template.id !== existing.id && template.categoryId === input.categoryId && template.name === input.name)) throw new Error('同一分类内模板名称不能重复。');
        Object.assign(existing, input, { updatedAt: QA_NOW });
        return this.templates.map((value) => ({ ...value, items: [...value.items] }));
      }
      case 'delete_follow_up_template': {
        const id = String(payload?.id);
        if (!this.templates.some((template) => template.id === id)) throw new Error('未找到该模板。');
        this.templates = this.templates.filter((template) => template.id !== id);
        return this.templates.map((value) => ({ ...value, items: [...value.items] }));
      }
      case 'export_backup': return { schemaVersion: 1, exportedAt: QA_NOW, itemCount: this.items.length, categoryCount: this.categories.length, templateCount: this.templates.length };
      case 'quick_backup': return { path: 'C:/qa-isolated/备份/工作备份文件20260906.json', schemaVersion: 1, exportedAt: QA_NOW, itemCount: this.items.length, categoryCount: this.categories.length, templateCount: this.templates.length };
      case 'export_work_items': {
        const input = payload?.input as WorkItemsExportInput;
        return { path: input.path, itemCount: this.items.filter((item) => item.deletedAt === null).length, categoryCount: this.categories.length };
      }
      case 'inspect_backup': return { schemaVersion: 1, exportedAt: QA_NOW, itemCount: 1, categoryCount: 3 };
      case 'restore_backup': return { safetyBackupPath: 'C:/qa-isolated/backup-before-restore.json', itemCount: 1 };
      case 'app_info': return { dataDir: 'C:/qa-isolated', version: '0.1.0-test' };
      default: throw new Error(`未模拟的本地接口：${command}`);
    }
  }

  private item(id: unknown) {
    const item = this.items.find((value) => value.id === id);
    if (!item) throw new Error('事项不存在');
    return item;
  }

  private category(id: unknown) {
    const category = this.categories.find((value) => value.id === id);
    if (!category) throw new Error('分类不存在');
    return category;
  }

  private template(id: unknown) {
    const template = this.templates.find((value) => value.id === id);
    if (!template) throw new Error('未找到该模板。');
    return template;
  }

  private validateTemplate(input: FollowUpTemplateInput) {
    const categoryId = String(input?.categoryId ?? '');
    if (!this.categories.some((category) => category.id === categoryId)) throw new Error('模板所属分类不存在。');
    const name = String(input?.name ?? '').trim();
    const items = (input?.items ?? []).map((item) => String(item).trim()).filter(Boolean);
    if (!name || !items.length) throw new Error('模板名称和清单不能为空。');
    if (new Set(items).size !== items.length) throw new Error('模板清单中不能有重复项目。');
    return { categoryId, name, items };
  }
}
