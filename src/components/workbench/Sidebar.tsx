import type { Category } from '../../types';
import type { DateFilter } from '../../lib/filters';

export type Navigation = { kind: 'date'; value: DateFilter } | { kind: 'category'; categoryId: string | null } | { kind: 'trash' };

interface SidebarProps {
  categories: Category[];
  active: Navigation;
  onNavigate: (navigation: Navigation) => void;
  onManageCategories: () => void;
  onOpenBackup: () => void;
}

const dateLinks: Array<{ value: DateFilter; label: string }> = [
  { value: 'all', label: '全部事项' }, { value: 'today', label: '今天' }, { value: 'thisWeek', label: '本周' },
  { value: 'nextWeek', label: '下周' }, { value: 'thisMonth', label: '本月' }, { value: 'nextMonth', label: '下月' },
  { value: 'overdue', label: '已逾期' }, { value: 'noDate', label: '未设日期' }, { value: 'custom', label: '自定义日期' },
];

const activeDate = (active: Navigation, value: DateFilter) => active.kind === 'date' && active.value === value;

export function Sidebar({ categories, active, onNavigate, onManageCategories, onOpenBackup }: SidebarProps) {
  return <aside className="sidebar" aria-label="事项导航">
    <div className="brand"><span className="brand-mark">✓</span><span>工作备忘录</span></div>
    <nav>
      <p className="nav-title">时间视图</p>
      {dateLinks.map((link) => <button key={link.value} className={activeDate(active, link.value) ? 'nav-link active' : 'nav-link'} onClick={() => onNavigate({ kind: 'date', value: link.value })}>{link.label}</button>)}
      <div className="nav-heading"><p className="nav-title">分类</p><button className="icon-button" onClick={onManageCategories} title="管理分类" aria-label="管理分类">⚙</button></div>
      <button className={active.kind === 'category' && active.categoryId === null ? 'nav-link active' : 'nav-link'} onClick={() => onNavigate({ kind: 'category', categoryId: null })}>未分类</button>
      {categories.map((category) => <button key={category.id} className={active.kind === 'category' && active.categoryId === category.id ? 'nav-link active' : 'nav-link'} onClick={() => onNavigate({ kind: 'category', categoryId: category.id })}>{category.name}</button>)}
    </nav>
    <div className="sidebar-bottom">
      <button className={active.kind === 'trash' ? 'nav-link active' : 'nav-link'} onClick={() => onNavigate({ kind: 'trash' })}>回收站</button>
      <button className="nav-link" onClick={onOpenBackup}>备份与恢复</button>
    </div>
  </aside>;
}
