# V2.11 Windows 0.1.1 独立发布 QA 报告

- 验收日期：2026年9月12日
- 验收任务：T115 独立发布 QA
- 固定验收提交：`0e827de285d176db7dc2b6dfdea88cf232b658a3`
- 验收分支：`codex/v211-release-qa-recovery`
- 结论：**通过**。

## 通过的核验

1. 工作树、分支、固定提交、共享前端依赖与 Rust 缓存均已实际核对，工作区干净。
2. 五处项目版本声明均为 `0.1.1`：`package.json`、`package-lock.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`、`src-tauri/tauri.conf.json`。
3. 候选安装包存在：`C:\Users\Administrator\.codex\worktrees\4a8b\工作备忘录\src-tauri\target\release\bundle\nsis\工作备忘录_0.1.1_x64-setup.exe`。
   - 文件大小：2,859,446 字节
   - SHA-256：`A233AA0108024B6B853260C55BAA40C717CD963DD2FBDEA1638E3E6DF4D1E95D`
   - FileVersion / ProductVersion：`0.1.1` / `0.1.1`
   - 签名状态：`NotSigned`（符合本次未签名要求）
4. 旧包 `D:\CODEX项目\工作备忘录\src-tauri\target\release\bundle\nsis\工作备忘录_0.1.0_x64-setup.exe` 仍存在。
5. 发布报告中的安装包大小、哈希、版本和签名状态均与实际一致；发布提交自身的差异格式检查通过。
6. 复用同一业务版本此前独立 QA 结论：前端 101/101、Rust 14/14 通过；本次未重复完整业务测试。

## 发布范围复核

按已澄清的发布契约，只核验固定发布提交 `0e827de285d176db7dc2b6dfdea88cf232b658a3` 自身相对其父提交的改动。实际文件严格为：

- `docs/RELEASE-V2.11.md`
- `package.json`、`package-lock.json`
- `src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`
- `src-tauri/tauri.conf.json`

上述范围与任务卡一致。该提交之前的 PM 任务卡、状态表和任务登记属于已授权协调记录，不计入发布员改动范围，也未进入安装包业务代码。

## 安全边界

未运行安装包，未修改版本或业务文件，未触碰用户数据、Windows 启动项、现有安装版、远程仓库或网络发布。
