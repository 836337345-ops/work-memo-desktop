# V2.11 Windows 0.1.1 发布候选报告

生成日期：2026年9月10日
发布基线：`aa4a045969967f5fd4e977498c254dc6310a78ef`
发布分支：`codex/v211-release-011`

## 版本一致性

- `package.json` 与 `package-lock.json`：`0.1.1`。
- `src-tauri/Cargo.toml` 与 `src-tauri/Cargo.lock`：`0.1.1`。
- `src-tauri/tauri.conf.json`：`0.1.1`。
- 本次差异仅包含上述版本声明、锁文件记录及本报告；未修改业务功能、权限、插件、数据、应用标识、产品名称或安装规则。

## 本地 Windows 候选安装包

- 路径：`C:\Users\Administrator\.codex\worktrees\4a8b\工作备忘录\src-tauri\target\release\bundle\nsis\工作备忘录_0.1.1_x64-setup.exe`
- 架构与类型：Windows x64 / NSIS。
- 文件大小：2,859,446 字节。
- SHA-256：`A233AA0108024B6B853260C55BAA40C717CD963DD2FBDEA1638E3E6DF4D1E95D`。
- Windows 文件版本：`0.1.1`；产品版本：`0.1.1`。
- 签名状态：`NotSigned`（未签名，符合本次任务要求）。

## 已完成验证

- `npm run build`：通过。
- `cargo test --manifest-path src-tauri/Cargo.toml`：14 项通过、0 项失败。
- `npx tauri build`：通过，成功生成 1 个 NSIS 安装包。
- `git diff --check`：通过。

## 已知限制与后续

- 本工作树的构建目录中未找到旧安装包 `工作备忘录_0.1.0_x64-setup.exe`；本任务没有删除、移动或覆盖任何旧安装包。发布 QA 应在原有归档位置复核旧包仍可用。
- 未运行新安装程序，未替换现有安装版，未触碰用户数据或 Windows 启动项。
- 本地候选包尚待固定提交的独立发布 QA；本报告不代表已合入 `main` 或完成对外发布。
