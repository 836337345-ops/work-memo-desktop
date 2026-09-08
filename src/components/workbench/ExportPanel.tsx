import { useEffect, useRef, useState } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { api } from '../../api';
import { STATUS_LABELS, type Category, type ExportDateFilter, type ItemStatus } from '../../types';
import { formatLocalDate } from '../../lib/filters';
import './export-panel.css';

interface ExportPanelProps { categories: Category[]; onClose: () => void; }

const dateOptions: Array<{ value: ExportDateFilter; label: string }> = [
  { value: 'today', label: '今天' }, { value: 'thisWeek', label: '本周' }, { value: 'nextWeek', label: '下周' },
  { value: 'thisMonth', label: '本月' }, { value: 'nextMonth', label: '下月' }, { value: 'history', label: '历史' },
];
const exportStatuses: ItemStatus[] = ['doing', 'done', 'paused'];
const statusOptions = exportStatuses.map((value) => ({ value, label: STATUS_LABELS[value] }));
const textFileFilter = [{ name: '文本文件', extensions: ['txt'] }];

function hasEvery<T>(selected: T[], available: T[]) {
  return selected.length === available.length && available.every((value) => selected.includes(value));
}

function SelectionActions<T>({ label, available, selected, onChange }: { label: string; available: T[]; selected: T[]; onChange: (next: T[]) => void }) {
  return <div className="export-selection-actions">
    <button type="button" onClick={() => onChange([...available])} aria-label={`${label}全选`}>全选</button>
    <button type="button" onClick={() => onChange(available.filter((value) => !selected.includes(value)))} aria-label={`${label}反选`}>反选</button>
  </div>;
}

export function ExportPanel({ categories, onClose }: ExportPanelProps) {
  const allStatusValues = statusOptions.map((option) => option.value);
  const allDateValues = dateOptions.map((option) => option.value);
  const allCategoryValues: Array<string | null> = [...categories.map((category) => category.id), null];
  const [statuses, setStatuses] = useState<ItemStatus[]>(() => [...allStatusValues]);
  const [dateFilters, setDateFilters] = useState<ExportDateFilter[]>(() => [...allDateValues]);
  const [categoryIds, setCategoryIds] = useState<Array<string | null>>(() => [...allCategoryValues]);
  const hasManuallySelectedCategories = useRef(false);
  const [notice, setNotice] = useState(''); const [error, setError] = useState(''); const [exporting, setExporting] = useState(false);
  const toggle = <T,>(value: T, values: T[], setValues: (next: T[]) => void) => setValues(values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value]);
  const updateCategoryIds = (next: Array<string | null>) => {
    hasManuallySelectedCategories.current = true;
    setCategoryIds(next);
  };

  useEffect(() => {
    if (!hasManuallySelectedCategories.current) setCategoryIds([...allCategoryValues]);
  }, [categories]);
  const exportText = async () => {
    if (statuses.length === 0 || dateFilters.length === 0 || categoryIds.length === 0) {
      setNotice('');
      setError('状态、时间和分类每组至少选择一项。');
      return;
    }
    try {
      setError(''); setNotice('');
      const today = formatLocalDate(new Date()).replaceAll('-', '');
      const path = await save({ defaultPath: `工作事项汇总${today}.txt`, filters: textFileFilter });
      if (!path) return;
      setExporting(true);
      const result = await api.exportWorkItems({
        path,
        statuses: hasEvery(statuses, allStatusValues) ? [] : statuses,
        dateFilters: hasEvery(dateFilters, allDateValues) ? [] : dateFilters,
        categoryIds: hasEvery(categoryIds, allCategoryValues) ? [] : categoryIds,
      });
      setNotice(`已导出 ${result.itemCount} 条事项、${result.categoryCount} 个分类：${result.path}`);
    } catch (reason) { setError(String(reason)); } finally { setExporting(false); }
  };
  return <section className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="export-title" onKeyDown={(event) => event.key === 'Escape' && onClose()}><div className="modal-card export-panel"><header><div><p className="eyebrow">文本文件</p><h2 id="export-title">导出事项</h2></div><button className="icon-button" onClick={onClose} aria-label="关闭">×</button></header><p className="modal-help">状态、时间和分类均可多选；每组至少保留一项。时间全选代表不限日期，包含未设日期和更远日期。导出不包含回收站事项。</p>
    <fieldset className="export-options"><legend>状态</legend><SelectionActions label="状态" available={allStatusValues} selected={statuses} onChange={setStatuses} /><div className="export-option-grid">{statusOptions.map((option) => <label key={option.value}><input type="checkbox" checked={statuses.includes(option.value)} onChange={() => toggle(option.value, statuses, setStatuses)} />{option.label}</label>)}</div></fieldset>
    <fieldset className="export-options"><legend>时间</legend><SelectionActions label="时间" available={allDateValues} selected={dateFilters} onChange={setDateFilters} /><div className="export-option-grid">{dateOptions.map((option) => <label key={option.value}><input type="checkbox" checked={dateFilters.includes(option.value)} onChange={() => toggle(option.value, dateFilters, setDateFilters)} />{option.label}</label>)}</div></fieldset>
    <fieldset className="export-options"><legend>分类</legend><SelectionActions label="分类" available={allCategoryValues} selected={categoryIds} onChange={updateCategoryIds} /><div className="export-option-grid">{categories.map((category) => <label key={category.id}><input type="checkbox" checked={categoryIds.includes(category.id)} onChange={() => updateCategoryIds(categoryIds.includes(category.id) ? categoryIds.filter((entry) => entry !== category.id) : [...categoryIds, category.id])} />{category.name}</label>)}<label><input type="checkbox" checked={categoryIds.includes(null)} onChange={() => updateCategoryIds(categoryIds.includes(null) ? categoryIds.filter((entry) => entry !== null) : [...categoryIds, null])} />未分类</label></div></fieldset>
    <div className="export-footer"><button className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" onClick={exportText} disabled={exporting}>{exporting ? '正在导出…' : '选择位置并导出 TXT'}</button></div>{notice && <p className="form-notice" role="status">{notice}</p>}{error && <p className="form-error" role="alert">{error}</p>}</div></section>;
}
