# V2.11 Windows 0.1.1 独立发布 QA 报告

- 验收日期：2026年9月12日
- 验收任务：T115 独立发布 QA
- 固定验收提交：`0e827de285d176db7dc2b6dfdea88cf232b658a3`
- 验收分支：`codex/v211-release-qa-recovery`
- 结论：**未通过**。

## 通过的核验

1. 工作树、分支、固定提交、共享前端依赖与 Rust 缓存均已实际核对，工作区干净。
2. 五处项目版本声明均为 `0.1.1`：`package.json`、`package-lock.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`、`src-tauri/tauri.conf.json`。
3. 候选安装包存在：`C:\Users\Administrator\.codex\worktrees\4a8b\工作备忘录\src-tauri\target\release\bundle\nsis\工作备忘录_0.1.1_x64-setup.exe`。
   - 文件大小：2,859,446 字节
   - SHA-256：`A233AA0108024B6B853260C55BAA40C717CD963DD2FBDEA1638E3E6DF4D1E95D`
   - FileVersion / ProductVersion：`0.1.1` / `0.1.1`
   - 签名状态：`NotSigned`（符合本次未签名要求）
4. 旧包 `D:\CODEX项目\工作备忘录\src-tauri\target\release\bundle\nsis\工作备忘录_0.1.0_x64-setup.exe` 仍存在。
5. 发布报告中的安装包大小、哈希、版本和签名状态均与实际一致；相对发布基线的差异格式检查通过。
6. 复用同一业务版本此前独立 QA 结论：前端 101/101、Rust 14/14 通过；本次未重复完整业务测试。

## 阻断项

发布任务卡只允许修改五处版本声明及 `docs/RELEASE-V2.11.md`。但相对发布基线 `e9b8c1baeb8f6ccd8116998d15e09b363a8b474d`，固定候选还包含以下未获该任务卡授权的文档改动：

- `docs/ACTIVE-VERSION.md`
- `docs/TASK-V2.11-RELEASE.md`
- `docs/TASKS.md`

因此，尽管版本与候选包元数据正确，发布差异不满足“仅限允许范围”的验收条件。此报告不代表可合入 `main` 或完成发布。

## 安全边界

未运行安装包，未修改版本或业务文件，未触碰用户数据、Windows 启动项、现有安装版、远程仓库或网络发布。
