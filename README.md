# 工作备忘录

Windows 离线工作事项桌面软件。React + TypeScript + Tauri 2 + SQLite。

## 开发与验证

需要 Node.js、Rust MSVC、Visual Studio C++ Build Tools 与 WebView2。

```powershell
npm.cmd ci
npm.cmd run tauri dev
npm.cmd run build
npm.cmd test
cargo test --manifest-path src-tauri/Cargo.toml
npm.cmd run test:e2e
npm.cmd run tauri build
```

浏览器开发入口为 127.0.0.1:1460；真实数据接口依赖桌面运行时，浏览器测试使用隔离模拟接口，不能用作真实数据库验收。

开发约定与分工见 docs/CONTRACT.md，用户操作见 docs/使用说明.md。测试运行使用 WORK_MEMO_DATA_DIR 指定独立临时目录，避免触及日常数据。

## 数据与发布

运行数据不写入源码或安装目录。首次创建数据库初始化类别；不预装用户范例或测试事项。只有本地 Git 仓库，不设置远程或执行发布。
