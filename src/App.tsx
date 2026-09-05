import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { api } from './api';
import ItemEditor from './components/ItemEditor';
import { BackupPanel } from './components/workbench/BackupPanel';
import { CategoryManager } from './components/workbench/CategoryManager';
import { ItemList } from './components/workbench/ItemList';
import { Sidebar } from './components/workbench/Sidebar';
import { filterItems, type DateFilter } from './lib/filters';
import type { Category, EditorHandle, ItemStatus, WorkItem } from './types';

type EditorTarget = { type: 'item'; id: string } | { type: 'new' } | null;
const dateTitles: Record<DateFilter, string> = { all: '全部事项', today: '今天', thisWeek: '本周', nextWeek: '下周', thisMonth: '本月', nextMonth: '下月', overdue: '已逾期', noDate: '未设日期', custom: '自定义日期' };

export default function App() {
  const [items, setItems] = useState<WorkItem[]>([]); const [categories, setCategories] = useState<Category[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all'); const [categoryId, setCategoryId] = useState<string | null | undefined>(undefined); const [status, setStatus] = useState<ItemStatus | 'all'>('all'); const [isTrash, setIsTrash] = useState(false); const [target, setTarget] = useState<EditorTarget>(null);
  const [query, setQuery] = useState(''); const [customStart, setCustomStart] = useState(''); const [customEnd, setCustomEnd] = useState('');
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [showCategories, setShowCategories] = useState(false); const [showBackup, setShowBackup] = useState(false);
  const editorRef = useRef<EditorHandle>(null); const allowClose = useRef(false);
  const load = useCallback(async () => { try { setError(''); const [nextItems, nextCategories] = await Promise.all([api.listItems(), api.listCategories()]); setItems(nextItems); setCategories(nextCategories); } catch (reason) { setError(`无法读取本地数据：${String(reason)}`); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const appWindow = getCurrentWindow(); let disposed = false; const unlisten = appWindow.onCloseRequested(async (event) => { if (allowClose.current) return; event.preventDefault(); const canLeave = await editorRef.current?.prepareLeave() ?? true; if (!canLeave || disposed) return; allowClose.current = true; await appWindow.close(); }); return () => { disposed = true; void unlisten.then((stop) => stop()); }; }, []);
  const visibleItems = useMemo(() => { if (isTrash) return filterItems(items.filter((item) => item.deletedAt !== null), { dateFilter: 'all', query }); return filterItems(items.filter((item) => item.deletedAt === null), { dateFilter, categoryId, status, query, customStart, customEnd }); }, [categoryId, customEnd, customStart, dateFilter, isTrash, items, query, status]);
  const selectedItem = target?.type === 'item' ? items.find((item) => item.id === target.id) ?? null : null;
  const heading = isTrash ? '回收站' : dateTitles[dateFilter];
  const requestChange = async (next: EditorTarget) => { if ((next?.type === target?.type && next?.type !== 'item') || (next?.type === 'item' && target?.type === 'item' && next.id === target.id)) return; if (await editorRef.current?.prepareLeave() ?? true) setTarget(next); };
  const changeView = async (change: () => void) => { if (await editorRef.current?.prepareLeave() ?? true) { change(); setTarget(null); } };
  const saved = (savedItem: WorkItem) => { setItems((current) => current.some((item) => item.id === savedItem.id) ? current.map((item) => item.id === savedItem.id ? savedItem : item) : [savedItem, ...current]); if (target?.type === 'new') setTarget({ type: 'item', id: savedItem.id }); };
  const deleted = (id: string) => { setItems((current) => current.map((item) => item.id === id ? { ...item, deletedAt: new Date().toISOString() } : item)); setTarget(null); };
  const restore = async (item: WorkItem) => { try { const restored = await api.restoreItem(item.id); setItems((current) => current.map((entry) => entry.id === restored.id ? restored : entry)); await requestChange({ type: 'item', id: restored.id }); } catch (reason) { setError(`无法还原事项：${String(reason)}`); } };
  const changedCategories = async (nextCategories: Category[]) => { setCategories(nextCategories); if (categoryId && !nextCategories.some((category) => category.id === categoryId)) setCategoryId(undefined); await load(); };
  const defaultCategoryId = categoryId ?? null;
  return <main className="app-shell"><Sidebar categories={categories} dateFilter={dateFilter} categoryId={categoryId} status={status} trash={isTrash} onDateFilter={(value) => void changeView(() => { setDateFilter(value); setIsTrash(false); })} onCategory={(value) => void changeView(() => { setCategoryId(value); setIsTrash(false); })} onStatus={(value) => void changeView(() => { setStatus(value); setIsTrash(false); })} onTrash={() => void changeView(() => setIsTrash(true))} onManageCategories={() => setShowCategories(true)} onOpenBackup={() => setShowBackup(true)} />
    <section className="list-pane" aria-label="事项工作台"><header className="workspace-header"><div><p className="eyebrow">工作台</p><h1>{heading}</h1><p className="count-text">{visibleItems.length} 条事项</p></div>{!isTrash && <button className="primary-button new-button" onClick={() => void requestChange({ type: 'new' })}>＋ 新建事项</button>}</header>
      <div className="filters"><label className="search-field"><span className="sr-only">搜索事项</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、内容、进度、跟进或备注" /></label>{!isTrash && dateFilter === 'custom' && <div className="date-range"><label>从<input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></label><span>至</span><label><input aria-label="结束日期" type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></label></div>}</div>
      {error && <p className="page-error" role="alert">{error}</p>}{loading ? <div className="empty-state"><p>正在载入工作事项…</p></div> : <ItemList items={visibleItems} categories={categories} selectedId={selectedItem?.id ?? null} onSelect={(item) => void requestChange({ type: 'item', id: item.id })} onRestore={isTrash ? restore : undefined} />}</section>
    <aside className="editor-pane" aria-label="事项编辑区">{target ? <ItemEditor key={target.type === 'item' ? target.id : 'new'} ref={editorRef} item={selectedItem} categories={categories} defaultCategoryId={defaultCategoryId} onSaved={saved} onDeleted={deleted} onCancel={() => void requestChange(null)} /> : <div className="editor-empty"><span>✦</span><h2>选择一条事项</h2><p>在左侧列表中打开，或新建一条事项开始记录。</p></div>}</aside>
    {showCategories && <CategoryManager categories={categories} onBeforeChange={async () => await editorRef.current?.prepareLeave() ?? true} onChanged={changedCategories} onClose={() => setShowCategories(false)} />}{showBackup && <BackupPanel onRestored={load} onClose={() => setShowBackup(false)} />}</main>;
}
