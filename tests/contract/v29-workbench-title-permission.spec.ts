import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const capabilityPath = join(process.cwd(), 'src-tauri', 'capabilities', 'default.json');

describe('V2.9 工作台窗口标题权限', () => {
  it('主窗口允许前端同步原生窗口标题', () => {
    const capability = JSON.parse(readFileSync(capabilityPath, 'utf8')) as { windows: string[]; permissions: string[] };
    expect(capability.windows).toContain('main');
    expect(capability.permissions).toContain('core:window:allow-set-title');
  });
});
