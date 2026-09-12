import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { api } from '../../api';
import { confirm } from '@tauri-apps/plugin-dialog';
import { STATUS_LABELS, type Category, type FollowUp, type ItemInput, type ItemListHandle, type ItemStatus, type WorkItem } from '../../types';
import { formatChineseDate } from '../../lib/dateFormat';
import { isOverdue } from '../../lib/filters';
import './item-card.css';

interface ItemListProps {
  items: WorkItem[];
  categories: Category[];
  selectedId: string | null;
  onSelect: (item: WorkItem) => void;
  onChanged?: (item: WorkItem) => void;
  onError?: (message: string, kind: 'normal' | 'progress') => void;
  onRestore?: (item: WorkItem) => void;
  editingItemId?: string | null;
  revealItemId?: string | null;
}

const toInput = (item: ItemInput): ItemInput => ({ title: item.title, content: item.content, categoryId: item.categoryId, dueDate: item.dueDate, status: item.status, notes: item.notes, followUps: item.followUps.map((entry) => ({ ...entry })), isStarred: item.isStarred });
const newFollowUp = (): FollowUp => ({ id: globalThis.crypto?.randomUUID?.() ?? `follow-${Date.now()}-${Math.random().toString(16).slice(2)}`, text: '', done: false });
const errorText = (reason: unknown) => reason instanceof Error ? reason.message : '保存失败，请重试。';
const forSaving = (input: ItemInput): ItemInput => ({ ...input, followUps: input.followUps.filter((entry) => entry.text.trim()) });
const hasOnlyNonPersistedChange = (next: ItemInput, previous: ItemInput) => JSON.stringify(forSaving(next)) === JSON.stringify(forSaving(previous));

function CollapseIcon({ expanded }: { expanded: boolean }) {
  return <svg className="item-card__collapse-icon" viewBox="0 0 18 18" data-direction={expanded ? 'up' : 'down'} aria-hidden="true"><path d="M4 3.5h10M4 7.5h10" /><path d={expanded ? 'm5 15 4-4 4 4' : 'm5 11 4 4 4-4'} /></svg>;
}

interface CardHandle { prepareLeave: () => Promise<boolean> }

function ItemCard({ item, categoryName, selected, readOnly, onSelect, onChanged, onError, onRestore, onRegister, onElementRegister, revealed = false, revealVersion = 0 }: {
  item: WorkItem; categoryName: string; selected: boolean; readOnly: boolean; onSelect: () => void;
  onChanged?: (item: WorkItem) => void; onError?: (message: string, kind: 'normal' | 'progress') => void; onRestore?: () => void; onRegister: (handle: CardHandle | null) => void;
  onElementRegister: (element: HTMLElement | null) => void; revealed?: boolean; revealVersion?: number;
}) {
  const [draft, setDraft] = useState<ItemInput>(() => toInput(item));
  const [progress, setProgress] = useState(item.progress);
  const [progressText, setProgressText] = useState('');
  const [saving, setSaving] = useState(0);
  const [progressSaving, setProgressSaving] = useState(false);
  const [progressInputVisible, setProgressInputVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [normalError, setNormalError] = useState<string | null>(null);
  const [progressError, setProgressError] = useState<string | null>(null);
  const draftRef = useRef(draft);
  const savedFollowUpsRef = useRef(draft.followUps);
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());
  const progressChainRef = useRef<Promise<void>>(Promise.resolve());
  const progressTextRef = useRef(progressText);
  const ownItemIdRef = useRef(item.id);
  const ownUpdateAtRef = useRef(item.updatedAt);
  const normalFailedRef = useRef(false);
  const progressFailedRef = useRef(false);

  useEffect(() => { progressTextRef.current = progressText; }, [progressText]);
  useEffect(() => { if (revealVersion > 0) setExpanded(true); }, [revealVersion]);
  // 自身保存的回传不应覆盖仍在输入的草稿；详情编辑器等外部更新则需要刷新卡片。
  useEffect(() => {
    if (item.id === ownItemIdRef.current && item.updatedAt === ownUpdateAtRef.current) return;
    const next = toInput(item);
    setDraft(next);
    draftRef.current = next;
    savedFollowUpsRef.current = next.followUps;
    setProgress(item.progress);
    setProgressText('');
    setProgressInputVisible(false);
    setExpanded(false);
    setNormalError(null);
    setProgressError(null);
    normalFailedRef.current = false;
    progressFailedRef.current = false;
    ownItemIdRef.current = item.id;
    ownUpdateAtRef.current = item.updatedAt;
  }, [item.id, item.updatedAt]);

  const reportFailure = (reason: unknown, kind: 'normal' | 'progress') => {
    const message = errorText(reason);
    if (kind === 'normal') normalFailedRef.current = true;
    else progressFailedRef.current = true;
    if (kind === 'normal') setNormalError(message);
    else setProgressError(message);
    onError?.(message, kind);
  };

  const enqueueUpdate = (next: ItemInput) => {
    const previous = draftRef.current;
    draftRef.current = next;
    setDraft(next);
    if (hasOnlyNonPersistedChange(next, previous)) return;
    if (!next.title.trim()) {
      const message = '事项标题不能为空。';
      normalFailedRef.current = true;
      setNormalError(message);
      onError?.(message, 'normal');
      return;
    }
    const input = { ...forSaving(next), followUps: savedFollowUpsRef.current };
    setSaving((count) => count + 1);
    const save = async () => {
      try {
        const saved = await api.updateItem(item.id, input);
        ownUpdateAtRef.current = saved.updatedAt;
        const clearsPreviousNormalFailure = normalFailedRef.current;
        normalFailedRef.current = false;
        setNormalError(null);
        if (clearsPreviousNormalFailure) onError?.('', 'normal');
        onChanged?.(saved);
      } catch (reason) {
        reportFailure(reason, 'normal');
      } finally {
        setSaving((count) => Math.max(0, count - 1));
      }
    };
    writeChainRef.current = writeChainRef.current.then(save, save);
  };

  const update = <K extends keyof ItemInput>(field: K, value: ItemInput[K]) => enqueueUpdate({ ...draftRef.current, [field]: value });
  const updateFollowUps = (followUps: FollowUp[]) => { const next = { ...draftRef.current, followUps }; draftRef.current = next; setDraft(next); setNormalError(null); };
  const followUpsDirty = () => JSON.stringify(draftRef.current.followUps) !== JSON.stringify(savedFollowUpsRef.current);
  const saveFollowUps = async () => {
    if (!followUpsDirty()) return true;
    if (!draftRef.current.title.trim()) { setNormalError('事项标题不能为空。'); return false; }
    setSaving((count) => count + 1);
    try {
      const saved = await api.updateItem(item.id, forSaving(draftRef.current));
      ownUpdateAtRef.current = saved.updatedAt;
      const next = toInput(saved); draftRef.current = next; setDraft(next); savedFollowUpsRef.current = next.followUps;
      const clearsPreviousNormalFailure = normalFailedRef.current;
      normalFailedRef.current = false; setNormalError(null); if (clearsPreviousNormalFailure) onError?.('', 'normal'); onChanged?.(saved); return true;
    } catch (reason) { reportFailure(reason, 'normal'); return false; }
    finally { setSaving((count) => Math.max(0, count - 1)); }
  };
  const prepareFollowUps = async () => {
    if (!followUpsDirty()) return true;
    return saveFollowUps();
  };

  const submitProgress = () => {
    const content = progressTextRef.current.trim();
    if (!content || progressSaving) return;
    setProgressText('');
    progressTextRef.current = '';
    setProgressSaving(true);
    setProgressError(null);
    progressFailedRef.current = false;
    const save = async () => {
      try {
        const saved = await api.addProgress(item.id, content);
        ownUpdateAtRef.current = saved.updatedAt;
        progressFailedRef.current = false;
        setProgressError(null);
        setProgress(saved.progress);
        setProgressInputVisible(false);
        onChanged?.(saved);
      } catch (reason) {
        if (!progressTextRef.current) {
          setProgressText(content);
          progressTextRef.current = content;
        }
        reportFailure(reason, 'progress');
      } finally {
        setProgressSaving(false);
      }
    };
    progressChainRef.current = save();
  };

  const prepareLeave = useCallback(async () => {
    // 等待到保存队列稳定：等待期间新输入会替换 ref，必须再等新队列。
    while (true) {
      const writes = writeChainRef.current;
      const progressWrites = progressChainRef.current;
      await Promise.all([writes, progressWrites]);
      if (writes === writeChainRef.current && progressWrites === progressChainRef.current) break;
    }
    return await prepareFollowUps() && !normalFailedRef.current && !progressFailedRef.current;
  }, []);
  useEffect(() => { onRegister({ prepareLeave }); return () => onRegister(null); }, [onRegister, prepareLeave]);

  const toggleExpanded = async () => { if (expanded && !(await prepareFollowUps())) return; setExpanded((open) => !open); };
  const remove = async () => { if (!(await prepareFollowUps())) return; if (!await confirm('删除后事项会移入回收站，确定继续吗？', { title: '删除事项', okLabel: '确认删除', cancelLabel: '取消' })) return; try { await api.trashItem(item.id); onChanged?.({ ...item, deletedAt: new Date().toISOString() }); } catch (reason) { reportFailure(reason, 'normal'); } };

  return <li className={selected ? 'item-row selected' : 'item-row'}>
    <article ref={onElementRegister} className={revealed ? 'item-card is-revealed' : 'item-card'} aria-label={`事项：${item.title}`} onBlur={(event) => { if (!readOnly && !event.currentTarget.contains(event.relatedTarget as Node | null)) void prepareFollowUps(); }}>
      <header className="item-card__header">
        <button type="button" className="item-card__expand" aria-label={expanded ? '收起事项' : '展开事项'} aria-expanded={expanded} onClick={() => void toggleExpanded()}><CollapseIcon expanded={expanded} /></button><span className={`status-dot ${draft.status}`} aria-hidden="true" />{draft.isStarred && <span className="item-card__star" aria-label="已星标">★</span>}
        <div className="item-copy"><span className="item-card__date">{formatChineseDate(item.dueDate)}</span><i aria-hidden="true"> | </i><span className="item-card__category">{categoryName}</span><i aria-hidden="true"> | </i><strong>{draft.title}{isOverdue(item) && <em className="item-card__overdue">逾期</em>}</strong></div>
        <select className="item-card__status" aria-label={`${item.title}的状态`} value={draft.status} disabled={readOnly} onChange={(event) => update('status', event.target.value as ItemStatus)}>{(Object.keys(STATUS_LABELS) as ItemStatus[]).map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select>
        {onRestore ? <button type="button" className="restore-button" onClick={onRestore}>还原</button> : readOnly ? <span className="restore-button" aria-label="详情编辑中">详情编辑中</span> : <><button type="button" className="restore-button" onClick={onSelect}>修改编辑</button><button type="button" className="restore-button item-card__delete" onClick={() => void remove()}>删除</button><button type="button" className="restore-button item-card__important" onClick={() => update('isStarred', !draft.isStarred)}>{draft.isStarred ? '取消重要事项' : '设置重要事项'}</button></>}
      </header>
      <div className="item-card__body">
        <section className="item-card__progress" aria-label="最新进度" onClick={(event) => { if (!readOnly && !(event.target as HTMLElement).closest('textarea,button')) setProgressInputVisible((visible) => !visible); }}><b>最新进度</b><p className="item-card__progress-full">{progress[0]?.content ?? '暂无最新进度'}</p>{!readOnly && progressInputVisible && <div><label className="sr-only" htmlFor={`progress-${item.id}`}>新增进度</label><textarea id={`progress-${item.id}`} value={progressText} disabled={progressSaving} onChange={(event) => setProgressText(event.target.value)} placeholder="记录新的进展" rows={2} /><button type="button" className="secondary-button" disabled={progressSaving || !progressText.trim()} onClick={() => void submitProgress()}>提交新进度</button></div>}</section>
        {expanded && <><p className="item-card__situation"><b>情况</b><span>{draft.content || '未填写情况'}</span></p><section aria-label="跟进清单"><div className="item-card__follow-up-heading"><b>跟进清单</b>{!readOnly && <button type="button" className="restore-button" onClick={() => updateFollowUps([...draftRef.current.followUps, newFollowUp()])}>＋ 添加跟进</button>}</div>{draft.followUps.length === 0 && <p>暂无跟进项</p>}<ul>{[...draft.followUps].sort((left, right) => Number(left.done) - Number(right.done)).map((followUp) => <li className={followUp.done ? 'is-done' : 'is-open'} key={followUp.id}><input aria-label={`完成：${followUp.text || '未命名跟进'}`} type="checkbox" checked={followUp.done} disabled={readOnly} onChange={() => updateFollowUps(draftRef.current.followUps.map((entry) => entry.id === followUp.id ? { ...entry, done: !entry.done } : entry))} />{followUp.done && <span className="item-card__follow-up-done">已完成</span>}<input aria-label="跟进内容" value={followUp.text} disabled={readOnly} onChange={(event) => updateFollowUps(draftRef.current.followUps.map((entry) => entry.id === followUp.id ? { ...entry, text: event.target.value } : entry))} />{!readOnly && <button type="button" className="icon-button" aria-label="删除跟进" onClick={() => updateFollowUps(draftRef.current.followUps.filter((entry) => entry.id !== followUp.id))}>×</button>}</li>)}</ul></section><div className="item-card__notes"><b>备注</b><span>{draft.notes || '暂无备注'}</span></div></>}
        {saving > 0 && <small>正在保存…</small>}{normalError && <p role="alert">保存失败：{normalError}</p>}{progressError && <p role="alert">进度提交失败：{progressError}</p>}
      </div>
    </article>
  </li>;
}

export const ItemList = forwardRef<ItemListHandle, ItemListProps>(function ItemList({ items, categories, selectedId, onSelect, onChanged, onError, onRestore, editingItemId = null, revealItemId = null }, ref) {
  const cardHandlesRef = useRef(new Map<string, CardHandle>());
  const cardElementsRef = useRef(new Map<string, HTMLElement>());
  const revealVersionRef = useRef(0);
  const [revealRequest, setRevealRequest] = useState<{ id: string; version: number } | null>(null);
  const registerCard = useCallback((id: string, handle: CardHandle | null) => {
    if (handle) cardHandlesRef.current.set(id, handle);
    else cardHandlesRef.current.delete(id);
  }, []);
  useImperativeHandle(ref, () => ({ prepareLeave: async () => {
    const results = await Promise.all([...cardHandlesRef.current.values()].map((handle) => handle.prepareLeave()));
    return results.every(Boolean);
  } }), []);
  const registerCardElement = useCallback((id: string, element: HTMLElement | null) => {
    if (element) cardElementsRef.current.set(id, element);
    else cardElementsRef.current.delete(id);
  }, []);
  useEffect(() => {
    if (!revealItemId) {
      setRevealRequest(null);
      return;
    }
    if (!items.some((item) => item.id === revealItemId)) {
      setRevealRequest(null);
      return;
    }
    const version = ++revealVersionRef.current;
    setRevealRequest({ id: revealItemId, version });
    const target = cardElementsRef.current.get(revealItemId);
    target?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }, [items, revealItemId]);
  const categoryName = (id: string | null) => categories.find((category) => category.id === id)?.name ?? '未分类';
  if (!items.length) return <div className="empty-state"><span>☷</span><h2>这里还没有事项</h2><p>{onRestore ? '回收站为空。删除的事项会暂存在这里。' : '新建一条事项，开始安排接下来的工作。'}</p></div>;
  return <ul className="item-list" aria-label="事项列表">
    {items.map((item) => <ItemCard key={item.id} item={item} categoryName={categoryName(item.categoryId)} selected={item.id === selectedId} readOnly={Boolean(onRestore) || item.id === editingItemId} onSelect={() => onSelect(item)} onChanged={onChanged} onError={onError} onRestore={onRestore ? () => onRestore(item) : undefined} onRegister={(handle) => registerCard(item.id, handle)} onElementRegister={(element) => registerCardElement(item.id, element)} revealed={revealRequest?.id === item.id} revealVersion={revealRequest?.id === item.id ? revealRequest.version : 0} />)}
  </ul>;
});
