export type ItemStatus = 'todo' | 'doing' | 'done' | 'paused';
export const STATUS_LABELS: Record<ItemStatus, string> = { todo: '待开展', doing: '进行中', done: '已完成', paused: '已暂停' };
export interface Category { id: string; name: string; sortOrder: number }
export interface FollowUp { id: string; text: string; done: boolean }
export interface ProgressEntry { id: string; content: string; createdAt: string }
export interface ItemInput { title: string; content: string; categoryId: string | null; dueDate: string | null; status: ItemStatus; notes: string; followUps: FollowUp[] }
export interface WorkItem extends ItemInput { id: string; createdAt: string; updatedAt: string; deletedAt: string | null; progress: ProgressEntry[] }
export interface BackupInfo { schemaVersion: number; exportedAt: string; itemCount: number; categoryCount: number }
export interface QuickBackupResult extends BackupInfo { path: string }
export interface RestoreResult { safetyBackupPath: string; itemCount: number }
export type ExportDateFilter = 'all' | 'today' | 'thisWeek' | 'nextWeek' | 'thisMonth' | 'nextMonth' | 'history' | 'overdue';
export interface WorkItemsExportInput {
  path: string;
  statuses: ItemStatus[];
  dateFilters: ExportDateFilter[];
  categoryIds: Array<string | null>;
}
export interface WorkItemsExportResult { path: string; itemCount: number; categoryCount: number }
export interface AppInfo { dataDir: string; version: string }
export interface EditorHandle { prepareLeave: () => Promise<boolean> }
export interface ItemEditorProps { item: WorkItem | null; categories: Category[]; defaultCategoryId?: string | null; onSaved: (item: WorkItem) => void; onDeleted: (id: string) => void; onCancel: () => void }
export const emptyItem = (categoryId: string | null = null): ItemInput => ({ title: '', content: '', categoryId, dueDate: null, status: 'todo', notes: '', followUps: [] });
