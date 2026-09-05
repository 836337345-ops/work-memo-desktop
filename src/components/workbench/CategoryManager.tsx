import { useState } from 'react';
import { confirm } from '@tauri-apps/plugin-dialog';
import { api } from '../../api';
import type { Category } from '../../types';

interface CategoryManagerProps { categories: Category[]; onBeforeChange: () => Promise<boolean>; onChanged: (categories: Category[]) => Promise<void>; onClose: () => void; }

export function CategoryManager({ categories, onBeforeChange, onChanged, onClose }: CategoryManagerProps) {
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const run = async (action: () => Promise<Category[]>) => { try { setError(''); if (!await onBeforeChange()) return; await onChanged(await action()); } catch (reason) { setError(String(reason)); } };
  const add = () => { if (newName.trim()) run(async () => { const result = await api.createCategory(newName.trim()); setNewName(''); return result; }); };
  const move = (index: number, direction: -1 | 1) => {
    const reordered = [...categories]; const target = index + direction;
    if (target < 0 || target >= reordered.length) return;
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    run(() => api.reorderCategories(reordered.map((category) => category.id)));
  };
  const remove = async (category: Category) => {
    const accepted = await confirm(`删除“${category.name}”后，其关联事项将转为“未分类”。此操作不能自动撤销，是否继续？`, { title: '删除分类', kind: 'warning', okLabel: '删除分类', cancelLabel: '取消' });
    if (accepted) run(() => api.deleteCategory(category.id));
  };
  return <section className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="category-title">
    <div className="modal-card category-manager"><header><div><p className="eyebrow">分类设置</p><h2 id="category-title">管理分类</h2></div><button className="icon-button" onClick={onClose} aria-label="关闭">×</button></header>
      <p className="modal-help">删除分类后，原有事项会保留并归入“未分类”。</p>
      <div className="add-category"><label htmlFor="new-category" className="sr-only">新分类名称</label><input id="new-category" value={newName} onChange={(event) => setNewName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && add()} placeholder="输入新分类名称" /><button className="primary-button" onClick={add}>添加</button></div>
      <ul className="category-list">{categories.map((category, index) => <li key={category.id}>
        {editing === category.id ? <input autoFocus aria-label="分类名称" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && name.trim()) { run(() => api.renameCategory(category.id, name.trim())); setEditing(null); } }} /> : <span>{category.name}</span>}
        <div className="category-actions"><button disabled={index === 0} onClick={() => move(index, -1)} aria-label={`上移 ${category.name}`}>↑</button><button disabled={index === categories.length - 1} onClick={() => move(index, 1)} aria-label={`下移 ${category.name}`}>↓</button>
          {editing === category.id ? <button onClick={() => { if (name.trim()) { run(() => api.renameCategory(category.id, name.trim())); setEditing(null); } }}>保存</button> : <button onClick={() => { setEditing(category.id); setName(category.name); }}>改名</button>}<button className="danger-text" onClick={() => remove(category)}>删除</button></div>
      </li>)}</ul>{error && <p className="form-error" role="alert">{error}</p>}
    </div>
  </section>;
}
