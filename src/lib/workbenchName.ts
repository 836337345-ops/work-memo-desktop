import { getCurrentWindow } from '@tauri-apps/api/window';

export const DEFAULT_WORKBENCH_NAME = '工作台';

const STORAGE_KEY = 'work-memo.workbench-name';

export function normalizeWorkbenchName(value: string) {
  return value.trim();
}

export function readWorkbenchName() {
  try {
    return normalizeWorkbenchName(window.localStorage.getItem(STORAGE_KEY) ?? '') || DEFAULT_WORKBENCH_NAME;
  } catch {
    return DEFAULT_WORKBENCH_NAME;
  }
}

export function saveWorkbenchName(value: string) {
  const name = normalizeWorkbenchName(value);
  try {
    if (name === DEFAULT_WORKBENCH_NAME) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, name);
    return true;
  } catch {
    return false;
  }
}

export async function updateWindowTitle(name: string) {
  try {
    await getCurrentWindow().setTitle(`工作备忘录 · ${name}`);
  } catch (reason) {
    console.warn('工作台名称已保存，但窗口标题同步失败：', reason);
  }
}
