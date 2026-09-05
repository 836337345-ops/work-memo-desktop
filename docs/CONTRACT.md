# 公共契约与任务卡

## 功能冻结
Windows 本地单用户工作备忘录。预设类别：推广、包装、活动、拓展、方案、其他，另有虚拟未分类（categoryId=null）。分类可增改排序和删除，删除分类关联事项转未分类。
截止日期仅 YYYY-MM-DD，以本机日期判断。状态 todo/doing/done/paused；仅 todo 和 doing 可逾期。
筛选：全部、今天、本周、下周、本月、下月、逾期、未设日期、自定义；周一为周始、边界含当日。默认到期日升序，空日期最后，同日期按创建时间降序。
搜索标题、内容、最新进度、跟进文字、备注。跟进勾选不自动修改事项状态。
新事项标题必填，创建按钮首次保存；普通字段自动保存。更新进度单独提交，保留历史。
删除仅软删除，可恢复。备份为带版本的 JSON，包括类别、所有事项（含回收站）、跟进和进度。恢复必须先完整校验、再安全备份当前数据库内容、最后事务替换；失败无数据变动。

## 数据与本地接口
src/types.ts 和 src/api.ts 为固定接口。Rust serde 使用 camelCase。所有时间戳为 RFC3339；progress 数组最新在前。listItems 包含回收站条目，UI 分离显示。categoryId 可空。后端返回给用户可读的中文错误。
ItemInput 不包括 progress，更新普通字段不能覆盖历史。updateItem 后端保留 id、createdAt、progress、deletedAt。
reorderCategories 必须提供全部现有类别 ID 且各一次。重复或空类别名称不允许。
exportBackup/inspectBackup 返回 BackupInfo；restoreBackup 返回安全备份路径和数量。
数据库存 AppHandle.path().app_data_dir()。支持 WORK_MEMO_DATA_DIR 环境变量作为明确测试专用覆盖，默认不设置。单实例插件避免同时开启两个程序写入。

## UI 集成边界
开发员 B 提供 src/components/ItemEditor.tsx 默认 forwardRef 组件，类型 ItemEditorProps / EditorHandle 见 types.ts。prepareLeave() 完成自动保存；未创建草稿或未提交进度需询问保留/放弃（至少确认放弃后才离开），失败返回 false。组件内部调用 api，成功 onSaved(WorkItem)；删除成功 onDeleted(id)。item=null 表示新建。根组件通过 key=item.id 或 new 来区分编辑对象，先 await prepareLeave 再换 key。
父组件 onSaved 只更新条目数据，不能因每次保存重新挂载编辑器；创建完成后需安全切换到其 id。
开发员 C 提供 src/App.tsx、src/styles.css、src/components/workbench/**、src/lib/filters.ts。C 不实现编辑器。共享编辑器 CSS 由 B 在独立 editor.css 内命名空间 .item-editor 下定义。C 给右栏合理宽度（约 430px，可伸缩）；1060px 最小窗口也可使用。语义化 label/button，方便键盘和测试。
所有危险操作用中文明确确认；桌面确认和选择文件使用 @tauri-apps/plugin-dialog。无浏览器生产数据后备。

## 分派
T01 A：src-tauri/src/** 实现、Cargo.toml/Cargo.lock 必要依赖、后端测试。不要改前端、Tauri 配置或图标。交付独立 Rust 数据测试（tempfile），能运行 cargo test。
T02 B：src/components/ItemEditor.tsx、editor.css、同目录编辑器辅助文件及测试。不要改 App、types、api、package 或全局 styles。
T03 C：src/App.tsx、src/styles.css、src/components/workbench/**、src/lib/** 及筛选测试。负责类别管理和备份/回收站界面，关窗 prepareLeave 防丢。不要改编辑器、types/api/package 或 Rust。
T04 QA：tests/**、测试配置文件及 docs/QA.md；不得更改业务实现。先编写用例，待 PM 指定集成提交后执行。可使用 Tauri mockIPC 做浏览器 UI 测试，但必须明确与真实 SQLite/桌面检查区分；用故障注入测试保存失败/恢复失败。测试结果写明版本。
PM：公共基线、依赖、图标、打包、接口协调、集成、使用说明、最终验收。

## 交付流程
开发员本分支自测并提交，报告 hash、修改范围、测试结果。PM 合入 integration/v1，QA 固定该提交测试。缺陷退回原开发员，修复再集成复测。最终接受的集成提交快进 main 后构建安装包。禁止用“只写完代码”代替验证。
