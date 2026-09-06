import { expect, test, type Page } from '@playwright/test';

// The browser double mirrors @tauri-apps/api/mocks' invoke hook. The Vitest
// contract suite imports mockIPC itself; this page-level bridge is required
// because Playwright's browser context cannot import Node modules directly.
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
    categoryId: 'cat-promotion', dueDate: '2026-09-07', status: 'doing', notes: '虚构测试事项。',
    followUps: [{ id: 'follow-1', text: '确认渠道海报尺寸', done: false }],
    progress: [{ id: 'progress-1', content: '已收集三家渠道的物料清单。', createdAt: '2026-09-06T09:00:00.000Z' }],
    createdAt: '2026-09-06T09:00:00.000Z', updatedAt: '2026-09-06T09:00:00.000Z', deletedAt: null,
  }],
};

async function mockIpc(page: Page, state: BrowserState = seed) {
  await page.addInitScript((initial: BrowserState) => {
    const state = structuredClone(initial);
    const now = '2026-09-06T09:00:00.000Z';
    const RealDate = Date;
    const fixedNow = new RealDate(now).valueOf();
    // Date-range assertions must not depend on the tester's calendar day.
    class FixedDate extends RealDate {
      constructor(...args: any[]) {
        if (args.length === 0) { super(fixedNow); return; }
        if (args.length === 1) { super(args[0]); return; }
        if (args.length === 2) { super(args[0], args[1]); return; }
        if (args.length === 3) { super(args[0], args[1], args[2]); return; }
        if (args.length === 4) { super(args[0], args[1], args[2], args[3]); return; }
        if (args.length === 5) { super(args[0], args[1], args[2], args[3], args[4]); return; }
        super(args[0], args[1], args[2], args[3], args[4], args[5]);
      }
      static now() { return fixedNow; }
    }
    window.Date = FixedDate as DateConstructor;
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
    window.confirm = () => true;
    window.__TAURI_INTERNALS__ = window.__TAURI_INTERNALS__ ?? {};
    window.__TAURI_INTERNALS__.metadata = {
      currentWindow: { label: 'main' },
      currentWebview: { label: 'main', windowLabel: 'main' },
    };
    window.__TAURI_INTERNALS__.transformCallback = () => 1;
    window.__TAURI_INTERNALS__.unregisterCallback = () => {};
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = window.__TAURI_EVENT_PLUGIN_INTERNALS__ ?? {};
    window.__TAURI_EVENT_PLUGIN_INTERNALS__.unregisterListener = () => {};
    window.__TAURI_INTERNALS__.invoke = async (command: string, payload: Record<string, any> = {}) => {
      const failure = state.failures?.[command];
      if (failure) throw new Error(failure);
      switch (command) {
        case 'plugin:event|listen': return payload.handler;
        case 'plugin:event|unlisten': return null;
        case 'plugin:dialog|open': return 'C:/qa-isolated/import.json';
        case 'plugin:dialog|save': return 'C:/qa-isolated/export.json';
        case 'plugin:dialog|message': {
          const buttons = payload.buttons as { OkCancelCustom?: [string, string]; OkCustom?: [string] } | undefined;
          return buttons?.OkCancelCustom?.[0] ?? buttons?.OkCustom?.[0] ?? 'Ok';
        }
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
  test.skip(!uiReady, '仅在明确设置 QA_UI_READY=1 时执行 UI / IPC 模拟验收。');

  test.beforeEach(async ({ page }) => {
    await mockIpc(page);
    await page.goto('/');
  });

  test('创建事项后编辑会自动保存，进度另行提交且历史保留', async ({ page }) => {
    await page.getByRole('button', { name: '新建事项' }).click();
    await page.getByLabel('事项标题').fill('国庆案场暖场推广');
    await page.getByLabel('事项内容').fill('准备沙盘贴与签到背景板。');
    await page.getByLabel('截止日期').fill('2026-10-01');
    await page.getByRole('button', { name: '创建事项' }).click();
    await expect(page.getByText('国庆案场暖场推广')).toBeVisible();
    await page.getByLabel('事项标题').fill('国庆案场暖场推广（已确认）');
    await expect(page.getByText('已自动保存')).toBeVisible();
    await page.getByLabel('新的进度').fill('签到背景板已送印。');
    await page.getByRole('button', { name: '提交进度' }).click();
    await expect(page.getByText('签到背景板已送印。', { exact: true })).toBeVisible();
  });

  test('组合筛选支持分类、状态、关键词与下周/下月日期范围', async ({ page }) => {
    await page.getByRole('button', { name: '推广', exact: true }).click();
    await page.getByRole('button', { name: '进行中', exact: true }).click();
    await page.getByLabel('搜索事项').fill('样板间');
    await page.getByRole('button', { name: '下周', exact: true }).click();
    await expect(page.getByText('秋季新盘样板间开放推广')).toBeVisible();
    await page.getByRole('button', { name: '下月', exact: true }).click();
    await expect(page.getByText('秋季新盘样板间开放推广')).not.toBeVisible();
  });

  test('分类可新建、改名、重排、删除；删除后事项回到未分类', async ({ page }) => {
    await page.getByRole('button', { name: '管理分类' }).click();
    await page.getByLabel('新分类名称').fill('拓展');
    await page.getByRole('button', { name: '添加' }).click();
    const activity = page.locator('.category-list li').filter({ hasText: '活动' });
    await activity.getByRole('button', { name: '改名' }).click();
    await page.getByLabel('分类名称', { exact: true }).fill('活动执行');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    const expansion = page.locator('.category-list li').filter({ hasText: '拓展' });
    await expansion.getByRole('button', { name: '上移 拓展' }).click();
    const promotion = page.locator('.category-list li').filter({ hasText: '推广' });
    await promotion.getByRole('button', { name: '删除' }).click();
    await expect(page.getByText('未分类 · 进行中')).toBeVisible();
  });

  test('删除进入回收站并可恢复，跟进勾选不改变事项状态', async ({ page }) => {
    await page.getByText('秋季新盘样板间开放推广').click();
    await page.getByLabel('完成：确认渠道海报尺寸').check();
    await expect(page.getByLabel('当前状态')).toHaveValue('doing');
    await page.getByRole('button', { name: '移入回收站' }).click();
    await page.getByRole('button', { name: '回收站' }).click();
    await page.getByRole('button', { name: '还原' }).click();
    await page.getByRole('button', { name: '全部事项' }).click();
    await expect(page.getByText('秋季新盘样板间开放推广')).toBeVisible();
  });

  test('备份导出、检查和恢复均经由对话框 IPC，并显示安全备份位置', async ({ page }) => {
    await page.getByRole('button', { name: '备份与恢复' }).click();
    await page.getByRole('button', { name: '选择位置并导出备份' }).click();
    await expect(page.getByText(/备份已导出/)).toBeVisible();
    await page.getByRole('button', { name: '选择备份并恢复' }).click();
    await expect(page.getByText(/恢复前的数据已安全备份至/)).toBeVisible();
  });

  test('保存故障显示错误且不误报已保存', async ({ page }) => {
    await mockIpc(page, { ...seed, failures: { update_item: '保存失败：测试磁盘不可用' } });
    await page.reload();
    await page.getByText('秋季新盘样板间开放推广').click();
    await page.getByLabel('事项标题').fill('不应伪成功的保存');
    await expect(page.getByText('保存失败：测试磁盘不可用')).toBeVisible();
    await expect(page.getByText('已自动保存')).not.toBeVisible();
  });
});
