import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { api } from './api';
import ItemEditor from './components/ItemEditor';
import { BackupPanel } from './components/workbench/BackupPanel';
import { CategoryManager } from './components/workbench/CategoryManager';
import { ExportPanel } from './components/workbench/ExportPanel';
import { ItemList } from './components/workbench/ItemList';
import { Sidebar, type FilterState } from './components/workbench/Sidebar';
import { WorkCalendar } from './components/workbench/WorkCalendar';
import { filterItems, type DateFilter } from './lib/filters';
import { DEFAULT_WORKBENCH_NAME, normalizeWorkbenchName, readWorkbenchName, saveWorkbenchName, updateWindowTitle } from './lib/workbenchName';
import { STATUS_LABELS, type Category, type EditorHandle, type ItemListHandle, type WorkItem } from './types';

type EditorTarget = { type: 'item'; id: string } | { type: 'new'; dueDate?: string | null } | null;
const dateTitles: Record<DateFilter, string> = { all: '全部事项', today: '今天', thisWeek: '本周', nextWeek: '下周', thisMonth: '本月', nextMonth: '下月', history: '历史事项', overdue: '已逾期' };

export default function App() {
  const [items, setItems] = useState<WorkItem[]>([]); const [categories, setCategories] = useState<Category[]>([]);
  const [filters, setFilters] = useState<FilterState>({ status: 'doing', date: 'all', categoryId: undefined }); const [isTrash, setIsTrash] = useState(false); const [target, setTarget] = useState<EditorTarget>(null); const [showCalendar, setShowCalendar] = useState(true); const [revealItemId, setRevealItemId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [showCategories, setShowCategories] = useState(false); const [showBackup, setShowBackup] = useState(false); const [showExport, setShowExport] = useState(false);
  const [workbenchName, setWorkbenchName] = useState(DEFAULT_WORKBENCH_NAME); const [showWorkbenchNameSettings, setShowWorkbenchNameSettings] = useState(false); const [workbenchNameDraft, setWorkbenchNameDraft] = useState(DEFAULT_WORKBENCH_NAME); const [workbenchNameError, setWorkbenchNameError] = useState('');
  const editorRef = useRef<EditorHandle>(null); const listRef = useRef<ItemListHandle>(null); const allowClose = useRef(false);
  const prepareAll = useCallback(async () => {
    const [editorCanLeave, listCanLeave] = await Promise.all([editorRef.current?.prepareLeave() ?? true, listRef.current?.prepareLeave() ?? true]);
    return editorCanLeave && listCanLeave;
  }, []);
  const load = useCallback(async () => { try { setError(''); const [nextItems, nextCategories] = await Promise.all([api.listItems(), api.listCategories()]); setItems(nextItems); setCategories(nextCategories); } catch (reason) { setError(`无法读取本地数据：${String(reason)}`); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const savedName = readWorkbenchName(); setWorkbenchName(savedName); updateWindowTitle(savedName); }, []);
  useEffect(() => { const appWindow = getCurrentWindow(); let disposed = false; const unlisten = appWindow.onCloseRequested(async (event) => { if (allowClose.current) return; event.preventDefault(); const canLeave = await prepareAll(); if (!canLeave || disposed) return; allowClose.current = true; await appWindow.close(); }); return () => { disposed = true; void unlisten.then((stop) => stop()); }; }, [prepareAll]);
  const visibleItems = useMemo(() => { if (isTrash) return filterItems(items.filter((item) => item.deletedAt !== null), { dateFilter: 'all', query }); return filterItems(items.filter((item) => item.deletedAt === null), { dateFilter: filters.date, categoryId: filters.categoryId, status: filters.status, query }); }, [filters, isTrash, items, query]);
  const selectedItem = target?.type === 'item' ? items.find((item) => item.id === target.id) ?? null : null;
  const heading = isTrash ? '回收站' : filters.date !== 'all' ? dateTitles[filters.date] : filters.status !== 'all' ? STATUS_LABELS[filters.status] : filters.categoryId !== undefined ? categories.find((category) => category.id === filters.categoryId)?.name ?? '未分类' : '全部事项';
  const requestChange = async (next: EditorTarget) => { if ((!next && !target) || (next?.type === 'new' && target?.type === 'new' && next.dueDate === target.dueDate) || (next?.type === 'item' && target?.type === 'item' && next.id === target.id)) return; if (await prepareAll()) { setRevealItemId(null); setTarget(next); } };
  const changeView = async (change: () => void) => { if (await prepareAll()) { change(); setRevealItemId(null); setTarget(null); setShowCalendar(false); } };
  const openBackup = async () => { if (await prepareAll()) { setRevealItemId(null); setTarget(null); setShowCalendar(false); setShowBackup(true); } };
  const openCategories = async () => { if (await prepareAll()) { setRevealItemId(null); setShowCalendar(false); setShowCategories(true); } };
  const saved = (savedItem: WorkItem) => { setItems((current) => current.some((item) => item.id === savedItem.id) ? current.map((item) => item.id === savedItem.id ? savedItem : item) : [savedItem, ...current]); if (target?.type === 'new') setTarget({ type: 'item', id: savedItem.id }); };
  const deleted = (id: string) => { setItems((current) => current.map((item) => item.id === id ? { ...item, deletedAt: new Date().toISOString() } : item)); setTarget(null); };
  const restore = async (item: WorkItem) => { try { const restored = await api.restoreItem(item.id); setItems((current) => current.map((entry) => entry.id === restored.id ? restored : entry)); await requestChange({ type: 'item', id: restored.id }); } catch (reason) { setError(`无法还原事项：${String(reason)}`); } };
  const changedCategories = async (nextCategories: Category[]) => { if (!await prepareAll()) return; setCategories(nextCategories); if (filters.categoryId && !nextCategories.some((category) => category.id === filters.categoryId)) setFilters((current) => ({ ...current, categoryId: undefined })); if (selectedItem?.categoryId && !nextCategories.some((category) => category.id === selectedItem.categoryId)) setTarget(null); await load(); };
  const defaultCategoryId = filters.categoryId ?? null;
  const openExport = async () => { if (await prepareAll()) { setRevealItemId(null); setTarget(null); setShowCalendar(false); setShowExport(true); } };
  const changeQuery = async (value: string) => { if (await prepareAll()) { setRevealItemId(null); setQuery(value); } };
  const showAll = () => void changeView(() => { setFilters({ status: 'all', date: 'all', categoryId: undefined }); setQuery(''); setIsTrash(false); });
  const showDoing = () => void changeView(() => { setFilters({ status: 'doing', date: 'all', categoryId: undefined }); setQuery(''); setIsTrash(false); });
  const openCalendar = async () => { if (await prepareAll()) { setRevealItemId(null); setTarget(null); setShowCalendar(true); } };
  const openCalendarItem = async (id: string) => { if (await prepareAll()) { setFilters({ status: 'all', date: 'all', categoryId: undefined }); setQuery(''); setIsTrash(false); setTarget(null); setShowCalendar(false); setRevealItemId(id); } };
  const openCalendarNewItem = async (dueDate: string) => { if (await prepareAll()) { setRevealItemId(null); setShowCalendar(false); setTarget({ type: 'new', dueDate }); } };
  const openWorkbenchNameSettings = () => { setWorkbenchNameDraft(workbenchName); setWorkbenchNameError(''); setShowWorkbenchNameSettings(true); };
  const closeWorkbenchNameSettings = () => { setWorkbenchNameError(''); setShowWorkbenchNameSettings(false); };
  const saveName = () => {
    const nextName = normalizeWorkbenchName(workbenchNameDraft);
    if (!nextName) { setWorkbenchNameError('请输入工作台名称后再保存。'); return; }
    if (!saveWorkbenchName(nextName)) { setWorkbenchName(DEFAULT_WORKBENCH_NAME); updateWindowTitle(DEFAULT_WORKBENCH_NAME); setWorkbenchNameError('名称保存失败，当前已恢复为默认名称。'); return; }
    setWorkbenchName(nextName); updateWindowTitle(nextName); closeWorkbenchNameSettings();
  };
  const restoreDefaultWorkbenchName = () => { setWorkbenchNameDraft(DEFAULT_WORKBENCH_NAME); setWorkbenchNameError(''); };
  return <main className={`app-shell ${target ? 'has-editor' : 'without-editor'}`}><Sidebar categories={categories} workbenchName={workbenchName} filters={filters} trash={isTrash} calendar={showCalendar} onDateFilter={(value) => void changeView(() => { setFilters((current) => ({ ...current, date: value })); setIsTrash(false); })} onCategory={(value) => void changeView(() => { setFilters((current) => ({ ...current, categoryId: value })); setIsTrash(false); })} onStatus={(value) => void changeView(() => { setFilters((current) => ({ ...current, status: value })); setIsTrash(false); })} onTrash={() => void changeView(() => setIsTrash(true))} onShowAll={showAll} onShowDoing={showDoing} onOpenCalendar={openCalendar} onManageCategories={() => void openCategories()} onOpenBackup={() => void openBackup()} onOpenExport={() => void openExport()} onOpenWorkbenchNameSettings={openWorkbenchNameSettings} />
    <section className="list-pane" aria-label={showCalendar ? '工作日历' : '事项工作台'}>{showCalendar ? <WorkCalendar items={items} categories={categories} onClose={() => setShowCalendar(false)} onOpenItem={(id) => void openCalendarItem(id)} onNewItem={(date) => void openCalendarNewItem(date)} /> : <><header className="workspace-header"><div><h1>{heading}</h1><p className="count-text">{visibleItems.length} 条事项</p></div>{!isTrash && <button className="primary-button new-button" onClick={() => void requestChange({ type: 'new' })}>＋ 新建事项</button>}</header>
      <div className="filters"><label className="search-field"><span className="sr-only">搜索事项</span><input value={query} onChange={(event) => void changeQuery(event.target.value)} placeholder="搜索标题、内容、进度、跟进或备注" /></label></div>
      {error && <p className="page-error" role="alert">{error}</p>}{loading ? <div className="empty-state"><p>正在载入工作事项…</p></div> : <ItemList ref={listRef} items={visibleItems} categories={categories} selectedId={selectedItem?.id ?? null} editingItemId={target?.type === 'item' ? target.id : null} revealItemId={revealItemId} onSelect={(item) => void requestChange({ type: 'item', id: item.id })} onChanged={saved} onError={setError} onRestore={isTrash ? restore : undefined} />}</>}</section>
    <aside className="editor-pane" aria-label="事项编辑区">{target ? <ItemEditor key={target.type === 'item' ? target.id : `new:${target.dueDate ?? ''}`} ref={editorRef} item={selectedItem} categories={categories} defaultCategoryId={defaultCategoryId} defaultDueDate={target.type === 'new' ? target.dueDate ?? null : null} onSaved={saved} onDeleted={deleted} onCancel={() => void requestChange(null)} /> : <div className="editor-empty"><span>✦</span><h2>选择一条事项</h2><p>在左侧列表中打开，或新建一条事项开始记录。</p></div>}</aside>
    {showCategories && <CategoryManager categories={categories} onBeforeChange={prepareAll} onChanged={changedCategories} onClose={() => setShowCategories(false)} />}{showBackup && <BackupPanel onRestored={load} onClose={() => setShowBackup(false)} />}{showExport && <ExportPanel categories={categories} onClose={() => setShowExport(false)} />}{showWorkbenchNameSettings && <section className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="workbench-name-title" onKeyDown={(event) => event.key === 'Escape' && closeWorkbenchNameSettings()}><div className="modal-card workbench-name-dialog"><header><div><p className="eyebrow">本机界面设置</p><h2 id="workbench-name-title">设置工作台名称</h2></div><button type="button" className="icon-button" aria-label="关闭" onClick={closeWorkbenchNameSettings}>×</button></header><p className="modal-help">名称只保存在这台设备的界面设置中，不会写入事项、分类、备份或导出文件。最多 30 个字符。</p><label className="workbench-name-field" htmlFor="workbench-name-input">工作台名称<input id="workbench-name-input" value={workbenchNameDraft} maxLength={30} autoFocus onChange={(event) => { setWorkbenchNameDraft(event.target.value); setWorkbenchNameError(''); }} /></label>{workbenchNameError && <p className="form-error" role="alert">{workbenchNameError}</p>}<footer><button type="button" className="secondary-button" onClick={restoreDefaultWorkbenchName}>恢复默认</button><span className="workbench-name-dialog__spacer" /><button type="button" className="secondary-button" onClick={closeWorkbenchNameSettings}>取消</button><button type="button" className="primary-button" onClick={saveName}>保存</button></footer></div></section>}</main>;
}
