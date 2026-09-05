import { expect, test, type Page } from '@playwright/test';

// UI contract tests are deliberately opt-in until PM merges an integrated UI
// commit. Their browser IPC double mirrors @tauri-apps/api/mocks' invoke hook;
// the Vitest contract suite uses mockIPC itself.
const uiReady = process.env.QA_UI_READY === '1';

type BrowserState = {
  items: Array<Record<string, unknown>>;
  categories: Array<Record<string, unknown>>;
  failures?: Record<string, string>;
};

const seed: BrowserState = {
  categories: [
    { id: 'cat-promotion', name: '推广', sortOrder: 0 },
    { id: 'cat-event', name: '活动', sortOrder: 1 },
    { id: 'cat-package', name: '包装', sortOrder: 2 },
  ],
  items: [{
    id: 'item-autumn-launch', title: '秋季新盘样板间开放推广', content: '协调海报、渠道物料与到访动线。',
    categoryId: 'cat-promotion', dueDate: '2026-09-14', status: 'doing', notes: '虚构测试事项。',
    followUps: [{ id: 'follow-1', text: '确认渠道海报尺寸', done: false }],
    progress: [{ id: 'progress-1', content: '已收集三家渠道的物料清单。', createdAt: '2026-09-06T09:00:00.000Z' }],
    createdAt: '2026-09-06T09:00:00.000Z', updatedAt: '2026-09-06T09:00:00.000Z', deletedAt: null,
  }],
};

async function mockIpc(page: Page, state: BrowserState = seed) {
  await page.addInitScript((initial: BrowserState) => {
    const state = structuredClone(initial);
    const now = '2026-09-06T09:00:00.000Z';
    const item = (id: unknown) => {
      const found = state.items.find((value) => value.id === id);
      if (!found) throw new Error('事项不存在');
      return found;
    };
    const category = (id: unknown) => {
      const found = state.categories.find((value) => value.id === id);
      if (!found) throw new Error('分类不存在');
      return found;
    };
    window.__TAURI_INTERNALS__ = window.__TAURI_INTERNALS__ ?? {};
    window.__TAURI_INTERNALS__.invoke = async (command: string, payload: Record<string, any> = {}) => {
      const failure = state.failures?.[command];
      if (failure) throw new Error(failure);
      switch (command) {
        case 'list_items': return structuredClone(state.items);
        case 'list_categories': return structuredClone(state.categories);
        case 'create_item': {
          const created = { ...payload.input, id: `item-${state.items.length + 1}`, createdAt: now, updatedAt: now, deletedAt: null, progress: [] };
          state.items.push(created); return structuredClone(created);
        }
        case 'update_item': Object.assign(item(payload.id), payload.input, { updatedAt: now }); return structuredClone(item(payload.id));
        case 'add_progress': {
          const target = item(payload.id);
          target.progress.unshift({ id: `progress-${target.progress.length + 1}`, content: payload.content, createdAt: now });
          target.updatedAt = now; return structuredClone(target);
        }
        case 'trash_item': item(payload.id).deletedAt = now; return null;
        case 'restore_item': item(payload.id).deletedAt = null; return structuredClone(item(payload.id));
        case 'create_category': state.categories.push({ id: `cat-${state.categories.length + 1}`, name: payload.name, sortOrder: state.categories.length }); return structuredClone(state.categories);
        case 'rename_category': category(payload.id).name = payload.name; return structuredClone(state.categories);
        case 'delete_category': {
          state.categories = state.categories.filter((value) => value.id !== payload.id);
          state.items.forEach((value) => { if (value.categoryId === payload.id) value.categoryId = null; });
          return structuredClone(state.categories);
        }
        case 'reorder_categories': state.categories = payload.ids.map((id: string, index: number) => ({ ...category(id), sortOrder: index })); return structuredClone(state.categories);
        case 'export_backup': return { schemaVersion: 1, exportedAt: now, itemCount: state.items.length, categoryCount: state.categories.length };
        case 'inspect_backup': return { schemaVersion: 1, exportedAt: now, itemCount: 1, categoryCount: 3 };
        case 'restore_backup': return { safetyBackupPath: 'C:/qa-isolated/backup-before-restore.json', itemCount: 1 };
        case 'app_info': return { dataDir: 'C:/qa-isolated', version: '0.1.0-test' };
        default: throw new Error(`未模拟的本地接口：${command}`);
      }
    };
  }, state);
}

test.describe('工作备忘录 UI / IPC 模拟验收', () => {
  test.skip(!uiReady, '等待 PM 合入完整 UI 后，以 QA_UI_READY=1 执行；当前占位基线不作 UI 验收。');

  test.beforeEach(async ({ page }) => {
    await mockIpc(page);
    await page.goto('/');
  });

  test('创建事项后编辑会自动保存，进度另行提交且历史保留', async ({ page }) => {
    await page.getByRole('button', { name: '新建事项' }).click();
    await page.getByLabel('标题').fill('国庆案场暖场推广');
    await page.getByLabel('内容').fill('准备沙盘贴与签到背景板。');
    await page.getByLabel('到期日').fill('2026-10-01');
    await page.getByRole('button', { name: '创建事项' }).click();
    await expect(page.getByText('国庆案场暖场推广')).toBeVisible();
    await page.getByLabel('标题').fill('国庆案场暖场推广（已确认）');
    await expect(page.getByText('已自动保存')).toBeVisible();
    await page.getByLabel('新增进度').fill('签到背景板已送印。');
    await page.getByRole('button', { name: '提交进度' }).click();
    await expect(page.getByText('签到背景板已送印。')).toBeVisible();
  });

  test('组合筛选支持分类、状态、关键词与下周/下月日期范围', async ({ page }) => {
    await page.getByLabel('分类筛选').selectOption('cat-promotion');
    await page.getByLabel('状态筛选').selectOption('doing');
    await page.getByLabel('搜索事项').fill('样板间');
    await page.getByLabel('日期筛选').selectOption('下周');
    await expect(page.getByText('秋季新盘样板间开放推广')).toBeVisible();
    await page.getByLabel('日期筛选').selectOption('下月');
    await expect(page.getByText('秋季新盘样板间开放推广')).not.toBeVisible();
  });

  test('分类可新建、改名、重排、删除；删除后事项回到未分类', async ({ page }) => {
    await page.getByRole('button', { name: '管理分类' }).click();
    await page.getByLabel('新分类名称').fill('拓展');
    await page.getByRole('button', { name: '添加分类' }).click();
    await page.getByRole('button', { name: '重命名活动' }).click();
    await page.getByLabel('分类名称').fill('活动执行');
    await page.getByRole('button', { name: '保存分类名称' }).click();
    await page.getByRole('button', { name: '删除推广' }).click();
    await page.getByRole('button', { name: '确认删除分类' }).click();
    await expect(page.getByText('未分类')).toBeVisible();
  });

  test('删除进入回收站并可恢复，跟进勾选不改变事项状态', async ({ page }) => {
    await page.getByText('秋季新盘样板间开放推广').click();
    await page.getByLabel('确认渠道海报尺寸').check();
    await expect(page.getByLabel('事项状态')).toHaveValue('doing');
    await page.getByRole('button', { name: '移入回收站' }).click();
    await page.getByRole('button', { name: '确认移入回收站' }).click();
    await page.getByRole('button', { name: '回收站' }).click();
    await page.getByRole('button', { name: '恢复事项' }).click();
    await expect(page.getByText('秋季新盘样板间开放推广')).toBeVisible();
  });

  test('备份恢复先检查，恢复失败显示中文错误且不报告成功', async ({ page }) => {
    await page.getByRole('button', { name: '备份与恢复' }).click();
    await page.getByRole('button', { name: '检查备份文件' }).click();
    await expect(page.getByText(/事项.*1/)).toBeVisible();
    await page.getByRole('button', { name: '恢复备份' }).click();
    await page.getByRole('button', { name: '确认恢复备份' }).click();
    await expect(page.getByText(/已安全备份当前数据/)).toBeVisible();
  });

  test('保存故障显示错误且不误报已保存', async ({ page }) => {
    await mockIpc(page, { ...seed, failures: { update_item: '保存失败：测试磁盘不可用' } });
    await page.reload();
    await page.getByText('秋季新盘样板间开放推广').click();
    await page.getByLabel('标题').fill('不应伪成功的保存');
    await expect(page.getByText('保存失败：测试磁盘不可用')).toBeVisible();
    await expect(page.getByText('已自动保存')).not.toBeVisible();
  });
});
