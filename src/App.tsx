import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { api } from './api';
import ItemEditor from './components/ItemEditor';
import { BackupPanel } from './components/workbench/BackupPanel';
import { CategoryManager } from './components/workbench/CategoryManager';
import { ExportPanel } from './components/workbench/ExportPanel';
import { ItemList } from './components/workbench/ItemList';
import { Sidebar, type FilterState } from './components/workbench/Sidebar';
import { filterItems, type DateFilter } from './lib/filters';
import { STATUS_LABELS, type Category, type EditorHandle, type ItemListHandle, type WorkItem } from './types';

type EditorTarget = { type: 'item'; id: string } | { type: 'new' } | null;
const dateTitles: Record<DateFilter, string> = { all: '全部事项', today: '今天', thisWeek: '本周', nextWeek: '下周', thisMonth: '本月', nextMonth: '下月', history: '历史事项', overdue: '已逾期' };

export default function App() {
  const [items, setItems] = useState<WorkItem[]>([]); const [categories, setCategories] = useState<Category[]>([]);
  const [filters, setFilters] = useState<FilterState>({ status: 'all', date: 'all', categoryId: undefined }); const [isTrash, setIsTrash] = useState(false); const [target, setTarget] = useState<EditorTarget>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [showCategories, setShowCategories] = useState(false); const [showBackup, setShowBackup] = useState(false); const [showExport, setShowExport] = useState(false);
  const editorRef = useRef<EditorHandle>(null); const listRef = useRef<ItemListHandle>(null); const allowClose = useRef(false);
  const prepareAll = useCallback(async () => {
    const [editorCanLeave, listCanLeave] = await Promise.all([editorRef.current?.prepareLeave() ?? true, listRef.current?.prepareLeave() ?? true]);
    return editorCanLeave && listCanLeave;
  }, []);
  const load = useCallback(async () => { try { setError(''); const [nextItems, nextCategories] = await Promise.all([api.listItems(), api.listCategories()]); setItems(nextItems); setCategories(nextCategories); } catch (reason) { setError(`无法读取本地数据：${String(reason)}`); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const appWindow = getCurrentWindow(); let disposed = false; const unlisten = appWindow.onCloseRequested(async (event) => { if (allowClose.current) return; event.preventDefault(); const canLeave = await prepareAll(); if (!canLeave || disposed) return; allowClose.current = true; await appWindow.close(); }); return () => { disposed = true; void unlisten.then((stop) => stop()); }; }, [prepareAll]);
  const visibleItems = useMemo(() => { if (isTrash) return filterItems(items.filter((item) => item.deletedAt !== null), { dateFilter: 'all', query }); return filterItems(items.filter((item) => item.deletedAt === null), { dateFilter: filters.date, categoryId: filters.categoryId, status: filters.status, query }); }, [filters, isTrash, items, query]);
  const selectedItem = target?.type === 'item' ? items.find((item) => item.id === target.id) ?? null : null;
  const heading = isTrash ? '回收站' : filters.date !== 'all' ? dateTitles[filters.date] : filters.status !== 'all' ? STATUS_LABELS[filters.status] : filters.categoryId !== undefined ? categories.find((category) => category.id === filters.categoryId)?.name ?? '未分类' : '全部事项';
  const requestChange = async (next: EditorTarget) => { if ((next?.type === target?.type && next?.type !== 'item') || (next?.type === 'item' && target?.type === 'item' && next.id === target.id)) return; if (await prepareAll()) setTarget(next); };
  const changeView = async (change: () => void) => { if (await prepareAll()) { change(); setTarget(null); } };
  const openBackup = async () => { if (await prepareAll()) { setTarget(null); setShowBackup(true); } };
  const openCategories = async () => { if (await prepareAll()) setShowCategories(true); };
  const saved = (savedItem: WorkItem) => { setItems((current) => current.some((item) => item.id === savedItem.id) ? current.map((item) => item.id === savedItem.id ? savedItem : item) : [savedItem, ...current]); if (target?.type === 'new') setTarget({ type: 'item', id: savedItem.id }); };
  const deleted = (id: string) => { setItems((current) => current.map((item) => item.id === id ? { ...item, deletedAt: new Date().toISOString() } : item)); setTarget(null); };
  const restore = async (item: WorkItem) => { try { const restored = await api.restoreItem(item.id); setItems((current) => current.map((entry) => entry.id === restored.id ? restored : entry)); await requestChange({ type: 'item', id: restored.id }); } catch (reason) { setError(`无法还原事项：${String(reason)}`); } };
  const changedCategories = async (nextCategories: Category[]) => { if (!await prepareAll()) return; setCategories(nextCategories); if (filters.categoryId && !nextCategories.some((category) => category.id === filters.categoryId)) setFilters((current) => ({ ...current, categoryId: undefined })); if (selectedItem?.categoryId && !nextCategories.some((category) => category.id === selectedItem.categoryId)) setTarget(null); await load(); };
  const defaultCategoryId = filters.categoryId ?? null;
  const openExport = async () => { if (await prepareAll()) { setTarget(null); setShowExport(true); } };
  const changeQuery = async (value: string) => { if (await prepareAll()) setQuery(value); };
  return <main className={`app-shell ${target ? 'has-editor' : 'without-editor'}`}><Sidebar categories={categories} filters={filters} trash={isTrash} onDateFilter={(value) => void changeView(() => { setFilters((current) => ({ ...current, date: value })); setIsTrash(false); })} onCategory={(value) => void changeView(() => { setFilters((current) => ({ ...current, categoryId: value })); setIsTrash(false); })} onStatus={(value) => void changeView(() => { setFilters((current) => ({ ...current, status: value })); setIsTrash(false); })} onTrash={() => void changeView(() => setIsTrash(true))} onManageCategories={() => void openCategories()} onOpenBackup={() => void openBackup()} onOpenExport={() => void openExport()} />
    <section className="list-pane" aria-label="事项工作台"><header className="workspace-header"><div><p className="eyebrow">工作台</p><h1>{heading}</h1><p className="count-text">{visibleItems.length} 条事项</p></div>{!isTrash && <button className="primary-button new-button" onClick={() => void requestChange({ type: 'new' })}>＋ 新建事项</button>}</header>
      <div className="filters"><label className="search-field"><span className="sr-only">搜索事项</span><input value={query} onChange={(event) => void changeQuery(event.target.value)} placeholder="搜索标题、内容、进度、跟进或备注" /></label></div>
      {error && <p className="page-error" role="alert">{error}</p>}{loading ? <div className="empty-state"><p>正在载入工作事项…</p></div> : <ItemList ref={listRef} items={visibleItems} categories={categories} selectedId={selectedItem?.id ?? null} editingItemId={target?.type === 'item' ? target.id : null} onSelect={(item) => void requestChange({ type: 'item', id: item.id })} onChanged={saved} onError={setError} onRestore={isTrash ? restore : undefined} />}</section>
    <aside className="editor-pane" aria-label="事项编辑区">{target ? <ItemEditor key={target.type === 'item' ? target.id : 'new'} ref={editorRef} item={selectedItem} categories={categories} defaultCategoryId={defaultCategoryId} onSaved={saved} onDeleted={deleted} onCancel={() => void requestChange(null)} /> : <div className="editor-empty"><span>✦</span><h2>选择一条事项</h2><p>在左侧列表中打开，或新建一条事项开始记录。</p></div>}</aside>
    {showCategories && <CategoryManager categories={categories} onBeforeChange={prepareAll} onChanged={changedCategories} onClose={() => setShowCategories(false)} />}{showBackup && <BackupPanel onRestored={load} onClose={() => setShowBackup(false)} />}{showExport && <ExportPanel categories={categories} onClose={() => setShowExport(false)} />}</main>;
}
