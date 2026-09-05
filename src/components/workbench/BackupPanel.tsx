import { useState } from 'react';
import { confirm, open, save } from '@tauri-apps/plugin-dialog';
import { api } from '../../api';
import type { BackupInfo } from '../../types';

interface BackupPanelProps { onRestored: () => Promise<void>; onClose: () => void; }
const fileFilter = [{ name: '备份文件', extensions: ['json'] }];

export function BackupPanel({ onRestored, onClose }: BackupPanelProps) {
  const [notice, setNotice] = useState(''); const [error, setError] = useState(''); const [checking, setChecking] = useState(false);
  const chooseSingleFile = async () => { const result = await open({ multiple: false, directory: false, filters: fileFilter }); return typeof result === 'string' ? result : null; };
  const describe = (info: BackupInfo) => `版本 ${info.schemaVersion}，含 ${info.categoryCount} 个分类和 ${info.itemCount} 条事项，导出于 ${new Date(info.exportedAt).toLocaleString('zh-CN')}`;
  const exportFile = async () => { try { setError(''); const path = await save({ defaultPath: '工作备忘录备份.json', filters: fileFilter }); if (!path) return; const info = await api.exportBackup(path); setNotice(`备份已导出：${path}（${describe(info)}）`); } catch (reason) { setError(String(reason)); } };
  const restoreFile = async () => { try { setError(''); setNotice(''); const path = await chooseSingleFile(); if (!path) return; setChecking(true); const info = await api.inspectBackup(path); setChecking(false); const accepted = await confirm(`已校验备份：${describe(info)}。恢复会替换当前所有本地数据；系统会先创建当前数据的安全备份。是否继续？`, { title: '恢复备份', kind: 'warning', okLabel: '确认恢复', cancelLabel: '取消' }); if (!accepted) return; const result = await api.restoreBackup(path); await onRestored(); setNotice(`恢复完成，共恢复 ${result.itemCount} 条事项。恢复前的数据已安全备份至：${result.safetyBackupPath}`); } catch (reason) { setChecking(false); setError(String(reason)); } };
  return <section className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="backup-title"><div className="modal-card backup-panel"><header><div><p className="eyebrow">本地数据</p><h2 id="backup-title">备份与恢复</h2></div><button className="icon-button" onClick={onClose} aria-label="关闭">×</button></header><p className="modal-help">备份会包含分类、事项、进度和回收站内容。恢复前会先校验文件，并自动保存当前数据。</p><div className="backup-actions"><button className="primary-button" onClick={exportFile}>选择位置并导出备份</button><button className="secondary-button" onClick={restoreFile} disabled={checking}>{checking ? '正在校验备份…' : '选择备份并恢复'}</button></div>{notice && <p className="form-notice" role="status">{notice}</p>}{error && <p className="form-error" role="alert">{error}</p>}</div></section>;
}
