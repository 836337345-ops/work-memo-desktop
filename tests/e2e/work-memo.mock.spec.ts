import { expect, test, type Page } from '@playwright/test';

// The browser double mirrors @tauri-apps/api/mocks' invoke hook. The Vitest
// contract suite imports mockIPC itself; this page-level bridge is required
// because Playwright's browser context cannot import Node modules directly.
const uiReady = process.env.QA_UI_READY === '1';

type BrowserState = {
  items: Array<Record<string, unknown>>;
  categories: Array<Record<string, unknown>>;
  templates: Array<Record<string, unknown>>;
  failures?: Record<string, string>;
};

const seed: BrowserState = {
  categories: [
    { id: 'cat-promotion', name: '推广', sortOrder: 0 },
    { id: 'cat-event', name: '活动', sortOrder: 1 },
    { id: 'cat-package', name: '包装', sortOrder: 2 },
    { id: 'cat-expansion-1', name: '拓展一', sortOrder: 3 },
    { id: 'cat-expansion-2', name: '拓展二', sortOrder: 4 },
    { id: 'cat-expansion-3', name: '拓展三', sortOrder: 5 },
    { id: 'cat-expansion-4', name: '拓展四', sortOrder: 6 },
    { id: 'cat-expansion-5', name: '拓展五', sortOrder: 7 },
  ],
  items: [
    { id: 'item-current', title: '样板间开放推广', content: '协调海报、渠道物料与到访动线。', categoryId: 'cat-promotion', dueDate: '2026-09-07', status: 'doing', notes: '优先核对到访动线。', followUps: [{ id: 'follow-1', text: '确认渠道海报尺寸', done: false }, { id: 'follow-2', text: '核验活动物料', done: false }, { id: 'follow-3', text: '同步销售排班', done: false }, { id: 'follow-4', text: '复核接待动线', done: false }], progress: [{ id: 'progress-1', content: '已收集三家渠道的物料清单。\n下一步安排周五现场复核。', createdAt: '2026-09-06T09:00:00.000Z' }], createdAt: '2026-09-06T09:00:00.000Z', updatedAt: '2026-09-06T09:00:00.000Z', deletedAt: null },
    { id: 'item-done-history', title: '已完成活动复盘', content: '整理活动到访数据。', categoryId: 'cat-event', dueDate: '2026-09-01', status: 'done', notes: '归档完成。', followUps: [], progress: [{ id: 'progress-2', content: '复盘已发出。', createdAt: '2026-09-02T09:00:00.000Z' }], createdAt: '2026-09-01T09:00:00.000Z', updatedAt: '2026-09-02T09:00:00.000Z', deletedAt: null },
    { id: 'item-paused-history', title: '暂停包装更新', content: '等待新包装规范。', categoryId: 'cat-package', dueDate: '2026-09-02', status: 'paused', notes: '暂缓执行。', followUps: [], progress: [], createdAt: '2026-09-01T09:00:00.000Z', updatedAt: '2026-09-02T09:00:00.000Z', deletedAt: null },
    { id: 'item-overdue', title: '逾期渠道物料', content: '补齐渠道物料清单。', categoryId: 'cat-promotion', dueDate: '2026-09-04', status: 'todo', notes: '等待供应商报价。', followUps: [], progress: [], createdAt: '2026-09-01T09:00:00.000Z', updatedAt: '2026-09-04T09:00:00.000Z', deletedAt: null },
  ],
  templates: [
    { id: 'template-promotion', categoryId: 'cat-promotion', name: '开放日流程', items: ['确认场地', '邀约客户', '准备物料'], sortOrder: 0, createdAt: '2026-09-06T09:00:00.000Z', updatedAt: '2026-09-06T09:00:00.000Z' },
    { id: 'template-event', categoryId: 'cat-event', name: '活动复盘', items: ['汇总到访', '整理反馈'], sortOrder: 0, createdAt: '2026-09-06T09:00:00.000Z', updatedAt: '2026-09-06T09:00:00.000Z' },
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
    (window as any).__QA_IPC_CALLS__ = [];
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
      (window as any).__QA_IPC_CALLS__.push({ command, payload });
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
          state.templates = state.templates.filter((value) => value.categoryId !== payload.id);
          return structuredClone(state.categories);
        }
        case 'reorder_categories': state.categories = payload.ids.map((id: string, index: number) => ({ ...category(id), sortOrder: index })); return structuredClone(state.categories);
        case 'list_follow_up_templates': return structuredClone(state.templates);
        case 'create_follow_up_template': {
          const input = payload.input as { categoryId: string; name: string; items: string[] };
          const name = String(input.name ?? '').trim(); const items = (input.items ?? []).map((value: string) => value.trim()).filter(Boolean);
          if (!name || !items.length) throw new Error('模板名称和清单不能为空。');
          if (new Set(items).size !== items.length) throw new Error('模板清单中不能有重复项目。');
          if (state.templates.some((value) => value.categoryId === input.categoryId && value.name === name)) throw new Error('同一分类内模板名称不能重复。');
          state.templates.push({ ...input, categoryId: input.categoryId, name, items, id: `template-${state.templates.length + 1}`, sortOrder: state.templates.filter((value) => value.categoryId === input.categoryId).length, createdAt: now, updatedAt: now });
          return structuredClone(state.templates);
        }
        case 'update_follow_up_template': {
          const existing = state.templates.find((value) => value.id === payload.id);
          if (!existing) throw new Error('未找到该模板。');
          const input = payload.input as { categoryId: string; name: string; items: string[] };
          const name = String(input.name ?? '').trim(); const items = (input.items ?? []).map((value: string) => value.trim()).filter(Boolean);
          if (!name || !items.length || new Set(items).size !== items.length) throw new Error('模板内容无效。');
          if (state.templates.some((value) => value.id !== payload.id && value.categoryId === input.categoryId && value.name === name)) throw new Error('同一分类内模板名称不能重复。');
          Object.assign(existing, { ...input, name, items, updatedAt: now }); return structuredClone(state.templates);
        }
        case 'delete_follow_up_template': {
          if (!state.templates.some((value) => value.id === payload.id)) throw new Error('未找到该模板。');
          state.templates = state.templates.filter((value) => value.id !== payload.id); return structuredClone(state.templates);
        }
        case 'export_backup': return { schemaVersion: 1, exportedAt: now, itemCount: state.items.length, categoryCount: state.categories.length, templateCount: state.templates.length };
        case 'quick_backup': return { path: 'C:/qa-isolated/备份/工作备份文件20260906.json', schemaVersion: 1, exportedAt: now, itemCount: state.items.length, categoryCount: state.categories.length, templateCount: state.templates.length };
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

  test('左栏默认仅展开状态，三组可独立展开并同时组合筛选；时间没有已逾期', async ({ page }) => {
    const statusGroup = page.getByRole('button', { name: /^状态/ });
    const timeGroup = page.getByRole('button', { name: /^时间/ });
    const categoryGroup = page.getByRole('button', { name: /^分类/ });
    await expect(statusGroup).toHaveAttribute('aria-expanded', 'true');
    await expect(timeGroup).toHaveAttribute('aria-expanded', 'false');
    await expect(categoryGroup).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('button', { name: '已逾期', exact: true })).toHaveCount(0);
    await timeGroup.click();
    await categoryGroup.click();
    await expect(statusGroup).toHaveAttribute('aria-expanded', 'true');
    await expect(timeGroup).toHaveAttribute('aria-expanded', 'true');
    await expect(categoryGroup).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('button', { name: '进行中', exact: true }).click();
    await page.getByRole('button', { name: '下周', exact: true }).click();
    await page.getByRole('button', { name: '推广', exact: true }).click();
    await expect(page.getByText('样板间开放推广', { exact: true })).toBeVisible();
    await expect(page.getByText('已完成活动复盘', { exact: true })).not.toBeVisible();
    await expect(page.getByText('逾期渠道物料', { exact: true })).not.toBeVisible();
  });

  test('历史包含所有状态，逾期标记仍显示在事项标题上', async ({ page }) => {
    await page.getByRole('button', { name: /^时间/ }).click();
    await page.getByRole('button', { name: '历史', exact: true }).click();
    await expect(page.getByText('已完成活动复盘', { exact: true })).toBeVisible();
    await expect(page.getByText('暂停包装更新', { exact: true })).toBeVisible();
    await page.locator('.item-list').evaluate((node) => { node.scrollTop = node.scrollHeight; });
    const overdue = page.getByRole('article', { name: '事项：逾期渠道物料' });
    await expect(overdue.locator('strong')).toContainText('逾期渠道物料');
    await expect(overdue.getByText('逾期', { exact: true })).toBeVisible();
  });

  test('事项卡默认收起，点击最新进度标题才出现输入；提交成功保持当前展开状态', async ({ page }) => {
    const card = page.getByRole('article', { name: '事项：样板间开放推广' });
    await expect(card.getByRole('button', { name: '展开事项' })).toBeVisible();
    await expect(card.locator('.item-card__progress-full')).toContainText('已收集三家渠道的物料清单。');
    await expect(card.locator('.item-card__progress-full')).toContainText('下一步安排周五现场复核。');
    await expect(card.getByText('情况', { exact: true })).toHaveCount(0);
    await expect(card.getByText('备注', { exact: true })).toHaveCount(0);
    await expect(card.getByLabel('跟进内容')).toHaveCount(0);
    const header = card.locator('.item-card__header');
    const title = header.locator('strong');
    const status = header.getByLabel('样板间开放推广的状态');
    const edit = header.getByRole('button', { name: '修改编辑' });
    expect(Number.parseFloat(await title.evaluate((node) => getComputedStyle(node).fontSize))).toBeGreaterThan(15);
    const statusBox = await status.boundingBox();
    const editBox = await edit.boundingBox();
    expect(statusBox && editBox && editBox.x).toBeGreaterThan(statusBox?.x ?? 0);
    await expect(header).toHaveCSS('border-bottom-width', '1px');

    await card.getByRole('button', { name: '展开事项' }).click();
    await expect(card.getByText('协调海报、渠道物料与到访动线。', { exact: true })).toBeVisible();
    await expect(card.getByText('优先核对到访动线。', { exact: true })).toBeVisible();
    await expect(card.getByLabel('跟进内容')).toHaveCount(4);
    await expect(card.getByLabel('跟进内容').first()).toBeEnabled();
    await expect(card.getByText('协调海报、渠道物料与到访动线。', { exact: true }).locator('..').locator('input,textarea')).toHaveCount(0);
    await expect(card.getByLabel('新增进度')).toHaveCount(0);
    await card.getByText('最新进度', { exact: true }).click();
    await card.getByLabel('新增进度').fill('已完成周五现场复核');
    await card.getByRole('button', { name: '提交新进度' }).click();
    await expect(card.getByRole('button', { name: '收起事项' })).toBeVisible();
    await expect(card.getByLabel('新增进度')).toHaveCount(0);
  });

  test('小窗口左栏和列表可滚动到底部，详情栏由内部单滚动区访问底部内容', async ({ page }) => {
    await page.setViewportSize({ width: 1060, height: 360 });
    await page.getByRole('article', { name: '事项：样板间开放推广' }).getByRole('button', { name: '修改编辑' }).click();
    const panes = await page.evaluate(() => ['.sidebar', '.item-list'].map((selector) => {
      const node = document.querySelector(selector) as HTMLElement;
      const style = getComputedStyle(node);
      node.scrollTop = node.scrollHeight;
      return { selector, overflowY: style.overflowY, scrollable: node.scrollHeight > node.clientHeight, atBottom: node.scrollTop + node.clientHeight >= node.scrollHeight };
    }));
    expect(panes.every((pane) => ['auto', 'scroll'].includes(pane.overflowY) && pane.scrollable && pane.atBottom)).toBe(true);
    const editorBottom = await page.locator('.item-editor__scroll').evaluate((node) => {
      const scroll = node as HTMLElement;
      scroll.scrollTop = scroll.scrollHeight;
      return scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight;
    });
    expect(editorBottom).toBe(true);
    const expected = ['rgb(57, 169, 120)', 'rgb(228, 161, 62)', 'rgb(218, 102, 98)', 'rgb(154, 167, 161)'];
    const colors = await page.locator('.item-card .status-dot').evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).backgroundColor));
    for (const color of expected) expect(colors).toContain(color);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await expect.poll(() => page.locator('.item-card .status-dot').first().evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
  });

  test('内联进度提交失败时提示中文错误、保留输入并保持展开', async ({ page }) => {
    await mockIpc(page, { ...seed, failures: { add_progress: '保存失败：测试磁盘不可用' } });
    await page.reload();
    const card = page.getByRole('article', { name: '事项：样板间开放推广' });
    await card.getByRole('button', { name: '展开事项' }).click();
    await card.getByText('最新进度', { exact: true }).click();
    const progress = card.getByLabel('新增进度');
    await progress.fill('不得丢失的进度');
    await card.getByRole('button', { name: '提交新进度' }).click();
    await expect(progress).toHaveValue('不得丢失的进度');
    await expect(page.getByText('进度提交失败：保存失败：测试磁盘不可用', { exact: true })).toBeVisible();
    await expect(card.getByRole('button', { name: '收起事项' })).toBeVisible();
  });

  test('V2.3 详情栏仅有约定字段、顶部保存区固定且底部内容可访问', async ({ page }) => {
    await page.setViewportSize({ width: 1060, height: 360 });
    await page.getByRole('article', { name: '事项：样板间开放推广' }).getByRole('button', { name: '修改编辑' }).click();
    const editor = page.getByRole('region', { name: '事项编辑器' });
    const topbar = editor.locator('.item-editor__topbar');
    const scroll = editor.locator('.item-editor__scroll');
    await expect(editor.getByLabel(/事项标题/)).toBeVisible();
    await expect(editor.getByLabel('所属类别')).toBeVisible();
    await expect(editor.getByLabel('截止日期')).toBeVisible();
    await expect(editor.getByLabel('事项情况')).toBeVisible();
    await expect(editor.getByLabel('备注')).toBeVisible();
    await expect(editor.getByLabel('跟进内容').first()).toBeVisible();
    await expect(editor.getByLabel('当前状态')).toHaveCount(0);
    await expect(editor.getByLabel('新增进度')).toHaveCount(0);
    await expect(editor.getByText('进度记录', { exact: true })).toHaveCount(0);

    const beforeTop = await topbar.evaluate((node) => node.getBoundingClientRect().top);
    const layout = await editor.evaluate((node) => {
      const scrollNode = node.querySelector('.item-editor__scroll') as HTMLElement;
      const style = getComputedStyle(node);
      const scrollStyle = getComputedStyle(scrollNode);
      scrollNode.scrollTop = scrollNode.scrollHeight;
      return {
        outerOverflow: style.overflowY,
        innerOverflow: scrollStyle.overflowY,
        innerScrollable: scrollNode.scrollHeight > scrollNode.clientHeight,
        reachedBottom: scrollNode.scrollTop + scrollNode.clientHeight >= scrollNode.scrollHeight,
      };
    });
    expect(layout).toEqual({ outerOverflow: 'hidden', innerOverflow: 'auto', innerScrollable: true, reachedBottom: true });
    const editorPaneLayout = await page.locator('.editor-pane').evaluate((node) => {
      const pane = node as HTMLElement;
      const style = getComputedStyle(pane);
      return { overflowY: style.overflowY, scrollable: pane.scrollHeight > pane.clientHeight };
    });
    expect(editorPaneLayout).toEqual({ overflowY: 'hidden', scrollable: false });
    expect(await topbar.evaluate((node) => node.getBoundingClientRect().top)).toBe(beforeTop);
    await expect(topbar.getByRole('button', { name: '保存并关闭' })).toBeVisible();
    await editor.getByRole('button', { name: '移入回收站' }).scrollIntoViewIfNeeded();
    await expect(editor.getByRole('button', { name: '移入回收站' })).toBeVisible();
  });

  test('V2.3 显示全部会清除组合条件、搜索并退出回收站', async ({ page }) => {
    await page.getByRole('button', { name: /^时间/ }).click();
    await page.getByRole('button', { name: /^分类/ }).click();
    await page.getByRole('button', { name: '进行中', exact: true }).click();
    await page.getByRole('button', { name: '历史', exact: true }).click();
    await page.getByRole('button', { name: '包装', exact: true }).click();
    const search = page.getByLabel('搜索事项');
    await search.fill('暂停');
    await page.getByRole('button', { name: '回收站', exact: true }).click();
    await expect(page.getByRole('heading', { name: '回收站', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '显示全部', exact: true }).click();
    await expect(page.getByRole('heading', { name: '全部事项', exact: true })).toBeVisible();
    await expect(search).toHaveValue('');
    await expect(page.getByRole('article', { name: '事项：样板间开放推广' })).toBeVisible();
    await expect(page.locator('.sidebar .nav-link.active').allTextContents()).resolves.toEqual(expect.arrayContaining(['全部状态', '全部时间', '全部分类']));
  });

  test('V2.3 日期和备份时间统一显示中文格式', async ({ page }) => {
    const card = page.getByRole('article', { name: '事项：样板间开放推广' });
    await expect(card.locator('small')).toContainText('推广 · 2026年9月7日');
    await page.getByRole('button', { name: '备份与恢复' }).click();
    await page.getByRole('button', { name: '一键备份到本地' }).click();
    await expect(page.getByRole('status')).toContainText(/导出于 2026年9月6日 \d{2}:\d{2}/);
  });

  test('编辑器默认隐藏，仅新建或修改编辑打开；普通字段不自动写入且保存失败保留输入', async ({ page }) => {
    await expect(page.locator('.editor-pane')).not.toBeVisible();
    await page.getByRole('button', { name: '＋ 新建事项' }).click();
    const editor = page.getByRole('region', { name: '事项编辑器' });
    await expect(editor).toBeVisible();
    await expect(editor.getByRole('button', { name: '关闭', exact: true })).toHaveCount(0);
    const before = await page.evaluate(() => (window as any).__QA_IPC_CALLS__.filter((call: any) => ['create_item', 'update_item'].includes(call.command)).length);
    await editor.getByLabel(/事项标题/).fill('只在点击保存时写入');
    const afterTyping = await page.evaluate(() => (window as any).__QA_IPC_CALLS__.filter((call: any) => ['create_item', 'update_item'].includes(call.command)).length);
    expect(afterTyping).toBe(before);
    await editor.getByRole('button', { name: '创建并关闭' }).click();
    await expect(editor).not.toBeVisible();
    await page.getByRole('article', { name: '事项：只在点击保存时写入' }).getByRole('button', { name: '修改编辑' }).click();
    await expect(page.getByRole('region', { name: '事项编辑器' })).toBeVisible();

    await mockIpc(page, { ...seed, failures: { update_item: '保存失败：编辑器测试' } });
    await page.reload();
    await page.getByRole('article', { name: '事项：样板间开放推广' }).getByRole('button', { name: '修改编辑' }).click();
    const failedEditor = page.getByRole('region', { name: '事项编辑器' });
    const title = failedEditor.getByLabel(/事项标题/);
    await title.fill('失败后仍保留');
    await failedEditor.getByRole('button', { name: '保存并关闭' }).click();
    await expect(page.getByText('保存失败：编辑器测试', { exact: true })).toBeVisible();
    await expect(title).toHaveValue('失败后仍保留');
    await expect(failedEditor).toBeVisible();
  });

  test('跟进模板按真实类别隔离，应用会 trim 去重；未分类不显示模板入口', async ({ page }) => {
    await page.getByRole('article', { name: '事项：样板间开放推广' }).getByRole('button', { name: '修改编辑' }).click();
    const editor = page.getByRole('region', { name: '事项编辑器' });
    await editor.getByRole('button', { name: '模板管理与应用' }).click();
    await expect(editor.getByText('开放日流程', { exact: true })).toBeVisible();
    await expect(editor.getByText('活动复盘', { exact: true })).toHaveCount(0);
    await editor.getByRole('button', { name: '应用' }).click();
    await expect(editor.getByLabel('跟进内容')).toHaveCount(7);
    const values = await editor.getByLabel('跟进内容').evaluateAll((nodes) => nodes.map((node) => (node as HTMLInputElement).value));
    expect(values.filter((value) => value === '确认场地')).toHaveLength(1);

    await editor.getByLabel('所属类别').selectOption('');
    await expect(editor.getByRole('button', { name: '模板管理与应用' })).toHaveCount(0);
    await expect(editor.getByRole('button', { name: '＋ 新建模板' })).toHaveCount(0);
  });

  test('模板新增重复名称时弹窗显示错误并保留填写内容，成功创建后可删除', async ({ page }) => {
    await page.getByRole('article', { name: '事项：样板间开放推广' }).getByRole('button', { name: '修改编辑' }).click();
    const editor = page.getByRole('region', { name: '事项编辑器' });
    await editor.getByRole('button', { name: '＋ 新建模板' }).click();
    const dialog = page.getByRole('dialog', { name: '跟进模板' });
    await dialog.getByLabel('模板名称').fill('开放日流程');
    await dialog.getByLabel('模板文字项 1').fill('确认场地');
    await dialog.getByRole('button', { name: '保存模板' }).click();
    await expect(dialog.getByRole('alert')).toContainText('不能重复');
    await expect(dialog.getByLabel('模板名称')).toHaveValue('开放日流程');
    await dialog.getByLabel('模板名称').fill('临时模板');
    await dialog.getByLabel('模板文字项 1').fill('临时事项');
    await dialog.getByRole('button', { name: '保存模板' }).click();
    await editor.getByRole('button', { name: '模板管理与应用' }).click();
    await expect(editor.getByText('临时模板', { exact: true })).toBeVisible();
    await editor.getByRole('button', { name: '删除模板：临时模板' }).click();
    await expect(editor.getByText('临时模板', { exact: true })).toHaveCount(0);
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
