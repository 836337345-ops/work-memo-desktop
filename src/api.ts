import { invoke } from '@tauri-apps/api/core';
import type { AppInfo, BackupInfo, Category, ItemInput, RestoreResult, WorkItem } from './types';
export const api = {
  listItems: () => invoke<WorkItem[]>('list_items'),
  listCategories: () => invoke<Category[]>('list_categories'),
  createItem: (input: ItemInput) => invoke<WorkItem>('create_item', { input }),
  updateItem: (id: string, input: ItemInput) => invoke<WorkItem>('update_item', { id, input }),
  addProgress: (id: string, content: string) => invoke<WorkItem>('add_progress', { id, content }),
  trashItem: (id: string) => invoke<void>('trash_item', { id }),
  restoreItem: (id: string) => invoke<WorkItem>('restore_item', { id }),
  createCategory: (name: string) => invoke<Category[]>('create_category', { name }),
  renameCategory: (id: string, name: string) => invoke<Category[]>('rename_category', { id, name }),
  deleteCategory: (id: string) => invoke<Category[]>('delete_category', { id }),
  reorderCategories: (ids: string[]) => invoke<Category[]>('reorder_categories', { ids }),
  exportBackup: (path: string) => invoke<BackupInfo>('export_backup', { path }),
  inspectBackup: (path: string) => invoke<BackupInfo>('inspect_backup', { path }),
  restoreBackup: (path: string) => invoke<RestoreResult>('restore_backup', { path }),
  appInfo: () => invoke<AppInfo>('app_info'),
};
