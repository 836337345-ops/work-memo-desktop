export type ItemStatus = 'doing' | 'done' | 'paused';
export const STATUS_LABELS: Record<ItemStatus, string> = { doing: '进行中', done: '已完成', paused: '已暂停' };
export interface Category { id: string; name: string; sortOrder: number }
export interface FollowUp { id: string; text: string; done: boolean }
export interface FollowUpTemplateInput { categoryId: string; name: string; items: string[] }
export interface FollowUpTemplate extends FollowUpTemplateInput { id: string; sortOrder: number; createdAt: string; updatedAt: string }
export interface ProgressEntry { id: string; content: string; createdAt: string }
export interface ItemInput { title: string; content: string; categoryId: string | null; dueDate: string | null; status: ItemStatus; notes: string; followUps: FollowUp[] }
export interface WorkItem extends ItemInput { id: string; createdAt: string; updatedAt: string; deletedAt: string | null; progress: ProgressEntry[] }
export interface BackupInfo { schemaVersion: number; exportedAt: string; itemCount: number; categoryCount: number; templateCount?: number }
export interface QuickBackupResult extends BackupInfo { path: string }
export interface RestoreResult { safetyBackupPath: string; itemCount: number }
export type ExportDateFilter = 'today' | 'thisWeek' | 'nextWeek' | 'thisMonth' | 'nextMonth' | 'history';
export interface WorkItemsExportInput {
  path: string;
  statuses: ItemStatus[];
  dateFilters: ExportDateFilter[];
  categoryIds: Array<string | null>;
}
export interface WorkItemsExportResult { path: string; itemCount: number; categoryCount: number }
export interface AppInfo { dataDir: string; version: string }
export interface EditorHandle { prepareLeave: () => Promise<boolean> }
/** 列表卡片内联保存的离开保护，供工作台在切换视图前统一等待。 */
export interface ItemListHandle { prepareLeave: () => Promise<boolean> }
export interface ItemEditorProps { item: WorkItem | null; categories: Category[]; defaultCategoryId?: string | null; defaultDueDate?: string | null; onSaved: (item: WorkItem) => void; onDeleted: (id: string) => void; onCancel: () => void }
export const emptyItem = (categoryId: string | null = null): ItemInput => ({ title: '', content: '', categoryId, dueDate: null, status: 'doing', notes: '', followUps: [] });
