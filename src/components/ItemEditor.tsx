import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { api } from '../api';
import { emptyItem, STATUS_LABELS } from '../types';
import type { EditorHandle, FollowUp, ItemEditorProps, ItemInput, ItemStatus, WorkItem } from '../types';
import './editor.css';

const hasDraftContent = (item: ItemInput) =>
  Boolean(item.title.trim() || item.content.trim() || item.notes.trim() || item.dueDate || item.followUps.length);

const makeFollowUp = (): FollowUp => ({
  id: globalThis.crypto?.randomUUID?.() ?? `follow-up-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  text: '',
  done: false,
});

/** 后端的更新输入严格禁止 WorkItem 的系统字段，不能直接传递列表数据。 */
const toInput = (item: ItemInput): ItemInput => ({
  title: item.title,
  content: item.content,
  categoryId: item.categoryId,
  dueDate: item.dueDate,
  status: item.status,
  notes: item.notes,
  followUps: item.followUps.map((followUp) => ({ ...followUp })),
});

/** 事项编辑器自行串行保存，避免输入很快时较早请求覆盖较晚内容。 */
const ItemEditor = forwardRef<EditorHandle, ItemEditorProps>(function ItemEditor(
  { item, categories, defaultCategoryId = null, onSaved, onDeleted, onCancel },
  ref,
) {
  const [draft, setDraft] = useState<ItemInput>(() => item ? toInput(item) : emptyItem(defaultCategoryId));
  const [itemId, setItemId] = useState<string | null>(item?.id ?? null);
  const [progress, setProgress] = useState(() => item?.progress ?? []);
  const [progressText, setProgressText] = useState('');
  const [savingCount, setSavingCount] = useState(0);
  const [creating, setCreating] = useState(false);
  const [progressSaving, setProgressSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draftRef = useRef(draft);
  const itemIdRef = useRef(itemId);
  const writeChainRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const failedSaveRef = useRef(false);
  const onSavedRef = useRef(onSaved);

  useEffect(() => { onSavedRef.current = onSaved; }, [onSaved]);
  useEffect(() => { draftRef.current = draft; }, [draft]);
  useEffect(() => { itemIdRef.current = itemId; }, [itemId]);

  // 父组件只会更新列表数据；同一事项不能用较旧的 props 覆盖正在编辑的草稿。
  useEffect(() => {
    const next = item ? toInput(item) : emptyItem(defaultCategoryId);
    setDraft(next);
    draftRef.current = next;
    setItemId(item?.id ?? null);
    itemIdRef.current = item?.id ?? null;
    setProgress(item?.progress ?? []);
    setProgressText('');
    setError(null);
    failedSaveRef.current = false;
  }, [item?.id]); // 切换事项才重置，不能依赖 updatedAt

  const enqueueUpdate = useCallback((id: string, input: ItemInput) => {
    failedSaveRef.current = false;
    setError(null);
    setSavingCount((count) => count + 1);
    const run = async (): Promise<boolean> => {
      try {
        const saved = await api.updateItem(id, input);
        failedSaveRef.current = false;
        setError(null);
        onSavedRef.current(saved);
        return true;
      } catch (reason) {
        failedSaveRef.current = true;
        setError(reason instanceof Error ? reason.message : '保存失败，请重试。');
        return false;
      } finally {
        setSavingCount((count) => Math.max(0, count - 1));
      }
    };
    writeChainRef.current = writeChainRef.current.then(run, run);
    return writeChainRef.current;
  }, []);

  const changeDraft = useCallback((next: ItemInput) => {
    draftRef.current = next;
    setDraft(next);
    setError(null);
    const id = itemIdRef.current;
    if (id) void enqueueUpdate(id, next);
  }, [enqueueUpdate]);

  const updateField = <K extends keyof ItemInput>(field: K, value: ItemInput[K]) => {
    changeDraft({ ...draftRef.current, [field]: value });
  };

  const create = async () => {
    const input = draftRef.current;
    if (!input.title.trim()) {
      setError('请先填写事项标题。');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const saved = await api.createItem({ ...input, title: input.title.trim() });
      setItemId(saved.id);
      itemIdRef.current = saved.id;
      const createdInput = toInput(saved);
      setDraft(createdInput);
      draftRef.current = createdInput;
      setProgress(saved.progress);
      failedSaveRef.current = false;
      onSavedRef.current(saved);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '创建失败，请重试。');
    } finally {
      setCreating(false);
    }
  };

  const retry = () => {
    const id = itemIdRef.current;
    if (id) void enqueueUpdate(id, draftRef.current);
    else void create();
  };

  const submitProgress = async () => {
    const id = itemIdRef.current;
    const content = progressText.trim();
    if (!id) {
      setError('请先创建事项，再提交进度。');
      return;
    }
    if (!content) return;
    setProgressSaving(true);
    setError(null);
    try {
      const saved = await api.addProgress(id, content);
      setProgress(saved.progress);
      setProgressText('');
      onSavedRef.current(saved);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '进度提交失败，请重试。');
    } finally {
      setProgressSaving(false);
    }
  };

  const prepareLeave = useCallback(async (): Promise<boolean> => {
    const writesOk = await writeChainRef.current;
    if (!writesOk || failedSaveRef.current) return false;
    if (!itemIdRef.current && hasDraftContent(draftRef.current)) {
      return window.confirm('这个新事项尚未创建，确定放弃当前填写内容吗？');
    }
    if (progressText.trim()) {
      return window.confirm('这条进度尚未提交，确定放弃吗？');
    }
    return true;
  }, [progressText]);

  useImperativeHandle(ref, () => ({ prepareLeave }), [prepareLeave]);

  const remove = async () => {
    const id = itemIdRef.current;
    if (!id || !window.confirm('删除后事项会移入回收站，确定继续吗？')) return;
    setError(null);
    try {
      await api.trashItem(id);
      onDeleted(id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '删除失败，请重试。');
    }
  };

  const cancel = async () => {
    if (await prepareLeave()) onCancel();
  };

  const deleted = Boolean(item?.deletedAt);
  const disabled = deleted || creating;
  const followUps = draft.followUps;

  return (
    <section className="item-editor" aria-label="事项编辑器">
      <div className="item-editor__heading">
        <div>
          <p className="item-editor__eyebrow">{itemId ? '事项详情' : '新建事项'}</p>
          <h2>{itemId ? '推进下一步' : '记录一件要紧的事'}</h2>
        </div>
        {itemId && !deleted && <span className="item-editor__save-state">{savingCount ? '正在保存…' : '已自动保存'}</span>}
      </div>

      {deleted && <p className="item-editor__readonly">此事项位于回收站，仅供查看。恢复请在回收站中操作。</p>}
      {error && <div className="item-editor__error" role="alert">{error}<button type="button" onClick={retry}>重试</button></div>}

      <div className="item-editor__fields">
        <label className="item-editor__field item-editor__field--title">
          <span>事项标题 <b aria-hidden="true">*</b></span>
          <input value={draft.title} disabled={disabled} onChange={(event) => updateField('title', event.target.value)} placeholder="例如：确认秋季活动物料" />
        </label>
        <label className="item-editor__field">
          <span>所属类别</span>
          <select value={draft.categoryId ?? ''} disabled={disabled} onChange={(event) => updateField('categoryId', event.target.value || null)}>
            <option value="">未分类</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label className="item-editor__field">
          <span>当前状态</span>
          <select value={draft.status} disabled={disabled} onChange={(event) => updateField('status', event.target.value as ItemStatus)}>
            {(Object.keys(STATUS_LABELS) as ItemStatus[]).map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
          </select>
        </label>
        <label className="item-editor__field">
          <span>截止日期</span>
          <input type="date" value={draft.dueDate ?? ''} disabled={disabled} onChange={(event) => updateField('dueDate', event.target.value || null)} />
        </label>
        <label className="item-editor__field item-editor__field--wide">
          <span>事项内容</span>
          <textarea value={draft.content} disabled={disabled} onChange={(event) => updateField('content', event.target.value)} placeholder="补充背景、目标或交付要求" rows={4} />
        </label>
        <label className="item-editor__field item-editor__field--wide">
          <span>备注</span>
          <textarea value={draft.notes} disabled={disabled} onChange={(event) => updateField('notes', event.target.value)} placeholder="记录需要留意的信息" rows={3} />
        </label>
      </div>

      <div className="item-editor__section">
        <div className="item-editor__section-title"><h3>跟进清单</h3><span>{followUps.filter((followUp) => followUp.done).length}/{followUps.length}</span></div>
        {followUps.length === 0 && <p className="item-editor__empty">把可执行的小步骤放在这里。</p>}
        <ul className="item-editor__follow-ups">
          {followUps.map((followUp) => (
            <li key={followUp.id}>
              <input aria-label={`完成：${followUp.text || '未命名跟进'}`} type="checkbox" checked={followUp.done} disabled={disabled} onChange={() => changeDraft({ ...draftRef.current, followUps: draftRef.current.followUps.map((entry) => entry.id === followUp.id ? { ...entry, done: !entry.done } : entry) })} />
              <input aria-label="跟进内容" value={followUp.text} disabled={disabled} onChange={(event) => changeDraft({ ...draftRef.current, followUps: draftRef.current.followUps.map((entry) => entry.id === followUp.id ? { ...entry, text: event.target.value } : entry) })} placeholder="下一步要做什么？" />
              {!deleted && <button type="button" className="item-editor__icon-button" aria-label="删除跟进" onClick={() => changeDraft({ ...draftRef.current, followUps: draftRef.current.followUps.filter((entry) => entry.id !== followUp.id) })}>×</button>}
            </li>
          ))}
        </ul>
        {!deleted && <button type="button" className="item-editor__text-button" onClick={() => changeDraft({ ...draftRef.current, followUps: [...draftRef.current.followUps, makeFollowUp()] })}>＋ 添加跟进</button>}
      </div>

      <div className="item-editor__section">
        <div className="item-editor__section-title"><h3>进度记录</h3><span>{progress.length} 条</span></div>
        {itemId && !deleted && <div className="item-editor__progress-form">
          <label className="sr-only" htmlFor="progress-content">新的进度</label>
          <textarea id="progress-content" value={progressText} onChange={(event) => setProgressText(event.target.value)} placeholder="记录刚刚完成的工作或遇到的情况" rows={3} />
          <button type="button" className="item-editor__primary" disabled={progressSaving || !progressText.trim()} onClick={() => void submitProgress()}>{progressSaving ? '提交中…' : '提交进度'}</button>
        </div>}
        {!itemId && <p className="item-editor__empty">创建事项后即可持续记录推进过程。</p>}
        {progress.length === 0 && itemId && <p className="item-editor__empty">还没有进度记录。</p>}
        <ol className="item-editor__progress-list">
          {progress.map((entry) => <li key={entry.id}><p>{entry.content}</p><time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString('zh-CN', { hour12: false })}</time></li>)}
        </ol>
      </div>

      <footer className="item-editor__actions">
        {!itemId && <button type="button" className="item-editor__primary" disabled={creating || !draft.title.trim()} onClick={() => void create()}>{creating ? '创建中…' : '创建事项'}</button>}
        <button type="button" className="item-editor__secondary" onClick={() => void cancel()}>关闭</button>
        {itemId && !deleted && <button type="button" className="item-editor__danger" onClick={() => void remove()}>移入回收站</button>}
      </footer>
    </section>
  );
});

export default ItemEditor;
