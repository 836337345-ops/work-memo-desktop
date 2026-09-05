import { STATUS_LABELS, type Category, type WorkItem } from '../../types';

interface ItemListProps {
  items: WorkItem[];
  categories: Category[];
  selectedId: string | null;
  onSelect: (item: WorkItem) => void;
  onRestore?: (item: WorkItem) => void;
}

const formatDate = (value: string | null) => value ? value.replaceAll('-', '.') : '未设日期';

export function ItemList({ items, categories, selectedId, onSelect, onRestore }: ItemListProps) {
  const categoryName = (id: string | null) => categories.find((category) => category.id === id)?.name ?? '未分类';
  if (!items.length) return <div className="empty-state"><span>☷</span><h2>这里还没有事项</h2><p>{onRestore ? '回收站为空。删除的事项会暂存在这里。' : '新建一条事项，开始安排接下来的工作。'}</p></div>;
  return <ul className="item-list" aria-label="事项列表">
    {items.map((item) => <li key={item.id} className={item.id === selectedId ? 'item-row selected' : 'item-row'}>
      <button className="item-main" onClick={() => onSelect(item)}>
        <span className={`status-dot ${item.status}`} aria-hidden="true" />
        <span className="item-copy"><strong>{item.title}</strong><small>{categoryName(item.categoryId)} · {STATUS_LABELS[item.status]}</small></span>
        <time className={item.dueDate ? '' : 'muted'}>{formatDate(item.dueDate)}</time>
      </button>
      {onRestore && <button className="restore-button" onClick={() => onRestore(item)}>还原</button>}
    </li>)}
  </ul>;
}
