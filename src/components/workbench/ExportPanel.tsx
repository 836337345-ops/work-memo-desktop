import { useState } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { api } from '../../api';
import { STATUS_LABELS, type Category, type ExportDateFilter, type ItemStatus } from '../../types';
import { formatLocalDate } from '../../lib/filters';

interface ExportPanelProps { categories: Category[]; onClose: () => void; }

const dateOptions: Array<{ value: ExportDateFilter; label: string }> = [
  { value: 'all', label: '全部时间' }, { value: 'today', label: '今天' }, { value: 'thisWeek', label: '本周' }, { value: 'nextWeek', label: '下周' },
  { value: 'thisMonth', label: '本月' }, { value: 'nextMonth', label: '下月' }, { value: 'history', label: '历史' }, { value: 'overdue', label: '已逾期' },
];
const statusOptions = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value: value as ItemStatus, label }));
const textFileFilter = [{ name: '文本文件', extensions: ['txt'] }];

export function ExportPanel({ categories, onClose }: ExportPanelProps) {
  const [statuses, setStatuses] = useState<ItemStatus[]>([]); const [dateFilters, setDateFilters] = useState<ExportDateFilter[]>([]); const [categoryIds, setCategoryIds] = useState<Array<string | null>>([]);
  const [notice, setNotice] = useState(''); const [error, setError] = useState(''); const [exporting, setExporting] = useState(false);
  const toggle = <T,>(value: T, values: T[], setValues: (next: T[]) => void) => setValues(values.some((entry) => entry === value) ? values.filter((entry) => entry !== value) : [...values, value]);
  const exportText = async () => { try { setError(''); setNotice(''); const today = formatLocalDate(new Date()).replaceAll('-', ''); const path = await save({ defaultPath: `工作事项汇总${today}.txt`, filters: textFileFilter }); if (!path) return; setExporting(true); const result = await api.exportWorkItems({ path, statuses, dateFilters, categoryIds }); setNotice(`已导出 ${result.itemCount} 条事项、${result.categoryCount} 个分类：${result.path}`); } catch (reason) { setError(String(reason)); } finally { setExporting(false); } };
  return <section className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="export-title" onKeyDown={(event) => event.key === 'Escape' && onClose()}><div className="modal-card export-panel"><header><div><p className="eyebrow">文本文件</p><h2 id="export-title">导出事项</h2></div><button className="icon-button" onClick={onClose} aria-label="关闭">×</button></header><p className="modal-help">可分别多选状态、时间和分类；不勾选某一组即导出该组的全部内容。导出不包含回收站事项。</p>
    <fieldset className="export-options"><legend>状态</legend>{statusOptions.map((option) => <label key={option.value}><input type="checkbox" checked={statuses.includes(option.value)} onChange={() => toggle(option.value, statuses, setStatuses)} />{option.label}</label>)}</fieldset>
    <fieldset className="export-options"><legend>时间</legend>{dateOptions.map((option) => <label key={option.value}><input type="checkbox" checked={dateFilters.includes(option.value)} onChange={() => toggle(option.value, dateFilters, setDateFilters)} />{option.label}</label>)}</fieldset>
    <fieldset className="export-options"><legend>分类</legend>{categories.map((category) => <label key={category.id}><input type="checkbox" checked={categoryIds.includes(category.id)} onChange={() => toggle(category.id, categoryIds, setCategoryIds)} />{category.name}</label>)}<label><input type="checkbox" checked={categoryIds.includes(null)} onChange={() => toggle(null, categoryIds, setCategoryIds)} />未分类</label></fieldset>
    <div className="export-footer"><button className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" onClick={exportText} disabled={exporting}>{exporting ? '正在导出…' : '选择位置并导出 TXT'}</button></div>{notice && <p className="form-notice" role="status">{notice}</p>}{error && <p className="form-error" role="alert">{error}</p>}</div></section>;
}
