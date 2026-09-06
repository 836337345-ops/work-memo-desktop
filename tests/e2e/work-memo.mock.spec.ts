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
  items: [
    { id: 'item-current', title: '样板间开放推广', content: '协调海报、渠道物料与到访动线。', categoryId: 'cat-promotion', dueDate: '2026-09-07', status: 'doing', notes: '优先核对到访动线。', followUps: [{ id: 'follow-1', text: '确认渠道海报尺寸', done: false }], progress: [{ id: 'progress-1', content: '已收集三家渠道的物料清单。', createdAt: '2026-09-06T09:00:00.000Z' }], createdAt: '2026-09-06T09:00:00.000Z', updatedAt: '2026-09-06T09:00:00.000Z', deletedAt: null },
    { id: 'item-done-history', title: '已完成活动复盘', content: '整理活动到访数据。', categoryId: 'cat-event', dueDate: '2026-09-01', status: 'done', notes: '归档完成。', followUps: [], progress: [{ id: 'progress-2', content: '复盘已发出。', createdAt: '2026-09-02T09:00:00.000Z' }], createdAt: '2026-09-01T09:00:00.000Z', updatedAt: '2026-09-02T09:00:00.000Z', deletedAt: null },
    { id: 'item-paused-history', title: '暂停包装更新', content: '等待新包装规范。', categoryId: 'cat-package', dueDate: '2026-09-02', status: 'paused', notes: '暂缓执行。', followUps: [], progress: [], createdAt: '2026-09-01T09:00:00.000Z', updatedAt: '2026-09-02T09:00:00.000Z', deletedAt: null },
    { id: 'item-overdue', title: '逾期渠道物料', content: '补齐渠道物料清单。', categoryId: 'cat-promotion', dueDate: '2026-09-04', status: 'todo', notes: '等待供应商报价。', followUps: [], progress: [], createdAt: '2026-09-01T09:00:00.000Z', updatedAt: '2026-09-04T09:00:00.000Z', deletedAt: null },
  ],
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
        case 'quick_backup': return { path: 'C:/qa-isolated/备份/工作备份文件20260906.json', schemaVersion: 1, exportedAt: now, itemCount: state.items.length, categoryCount: state.categories.length };
        case 'export_work_items': return { path: payload.input.path, itemCount: 2, categoryCount: 2 };
        case 'inspect_backup': return { schemaVersion: 1, exportedAt: now, itemCount: 1, categoryCount: 3 };
        case 'restore_backup': return { safetyBackupPath: 'C:/qa-isolated/backup-before-restore.json', itemCount: 1 };
        case 'app_info': return { dataDir: 'C:/qa-isolated', version: '0.1.0-test' };
        default: throw new Error(`未模拟的本地接口：${command}`);
      }
    };
  }, state);
}

test.describe('工作备忘录 V2 UI / IPC 模拟验收', () => {
  test.skip(!uiReady, '仅在明确设置 QA_UI_READY=1 时执行 UI / IPC 模拟验收。');

  test.beforeEach(async ({ page }) => {
    await mockIpc(page);
    await page.goto('/');
  });

  test('左栏依状态、时间、分类排序，筛选只保留一个维度且搜索可叠加', async ({ page }) => {
    const buttons = await page.getByRole('button').allTextContents();
    expect(buttons.indexOf('待开展')).toBeLessThan(buttons.indexOf('全部时间'));
    expect(buttons.indexOf('全部时间')).toBeLessThan(buttons.indexOf('全部分类'));

    await page.getByRole('button', { name: '进行中', exact: true }).click();
    await expect(page.getByText('样板间开放推广', { exact: true })).toBeVisible();
    await expect(page.getByText('已完成活动复盘', { exact: true })).not.toBeVisible();
    await page.getByRole('button', { name: '历史', exact: true }).click();
    await expect(page.getByText('已完成活动复盘', { exact: true })).toBeVisible();
    await expect(page.getByText('暂停包装更新', { exact: true })).toBeVisible();
    await expect(page.getByText('样板间开放推广', { exact: true })).not.toBeVisible();
    await page.getByRole('button', { name: '推广', exact: true }).click();
    await page.getByLabel('搜索事项').fill('渠道');
    await expect(page.getByText('逾期渠道物料', { exact: true })).toBeVisible();
    await expect(page.getByText('已完成活动复盘', { exact: true })).not.toBeVisible();
  });

  test('历史包含所有状态，逾期只显示待开展或进行中事项', async ({ page }) => {
    await page.getByRole('button', { name: '历史', exact: true }).click();
    await expect(page.getByText('已完成活动复盘', { exact: true })).toBeVisible();
    await expect(page.getByText('暂停包装更新', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '已逾期', exact: true }).click();
    await expect(page.getByText('逾期渠道物料', { exact: true })).toBeVisible();
    await expect(page.getByText('已完成活动复盘', { exact: true })).not.toBeVisible();
    await expect(page.getByText('暂停包装更新', { exact: true })).not.toBeVisible();
  });

  test('事项卡可内联更新情况、进度、备注、跟进和状态，并保留类别日期的详情编辑入口', async ({ page }) => {
    const card = page.getByRole('article', { name: '事项：样板间开放推广' });
    await expect(card.getByText('协调海报、渠道物料与到访动线。')).toBeVisible();
    await expect(card.getByText('已收集三家渠道的物料清单。')).toBeVisible();
    await card.getByLabel('样板间开放推广的情况').fill('确认沙盘贴与签到背景板。');
    await card.getByLabel('样板间开放推广的备注').fill('下午确认到访动线。');
    await card.getByLabel('完成：确认渠道海报尺寸').check();
    await card.getByLabel('新增进度').fill('签到背景板已送印。');
    await card.getByRole('button', { name: '提交新进度' }).click();
    await expect(card.getByText('签到背景板已送印。', { exact: true })).toBeVisible();
    await card.getByLabel('样板间开放推广的状态').selectOption('todo');
    await card.getByRole('button', { name: '一键完成' }).click();
    await expect(card.getByLabel('样板间开放推广的状态')).toHaveValue('done');
    await expect(card.locator('p').filter({ hasText: '类别推广' })).toBeVisible();
    await expect(card.locator('p').filter({ hasText: '截止日期2026.09.07' })).toBeVisible();
    await card.getByRole('button', { name: '修改编辑' }).click();
    await expect(page.getByLabel('所属类别')).toBeVisible();
    await expect(page.getByLabel('截止日期')).toBeVisible();
  });

  test('内联快速保存失败时提示中文错误并保留输入', async ({ page }) => {
    await mockIpc(page, { ...seed, failures: { update_item: '保存失败：测试磁盘不可用' } });
    await page.reload();
    const notes = page.getByLabel('样板间开放推广的备注');
    await notes.fill('不得丢失的备注');
    await expect(notes).toHaveValue('不得丢失的备注');
    await expect(page.getByText('保存失败：测试磁盘不可用', { exact: true })).toBeVisible();
  });

  test('一键备份显示本地路径，并可三维多选导出 TXT 成功反馈', async ({ page }) => {
    await page.getByRole('button', { name: '备份与恢复' }).click();
    await page.getByRole('button', { name: '一键备份到本地' }).click();
    await expect(page.getByRole('status')).toContainText('C:/qa-isolated/备份/工作备份文件20260906.json');
    await page.getByRole('button', { name: '关闭' }).click();
    await page.getByRole('button', { name: '导出事项' }).click();
    await page.getByRole('group', { name: '状态' }).getByLabel('进行中').check();
    await page.getByRole('group', { name: '时间' }).getByLabel('下周').check();
    await page.getByRole('group', { name: '分类' }).getByLabel('推广').check();
    await page.getByRole('group', { name: '分类' }).getByLabel('未分类').check();
    await page.getByRole('button', { name: '选择位置并导出 TXT' }).click();
    await expect(page.getByRole('status')).toContainText('已导出 2 条事项、2 个分类：C:/qa-isolated/export.json');
  });
});
