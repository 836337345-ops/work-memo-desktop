# 公共契约与任务卡

## V2.1 界面优化冻结（2026-09-06）

本轮仍只交付开发/调试版本；用户明确说“确认通过，可以打包”前禁止生成新版安装包或合入 main。

窗口在可用高度不足时不得裁掉底部内容。应用外壳占满窗口可用高度，左侧导航、事项列表和右侧详情分别承担自己的纵向滚动；不得依赖页面整体超出窗口后被隐藏。

工作台左侧恢复多维组合筛选：状态、时间、分类每个维度各单选一个条件，三个维度可以同时生效，关键词继续叠加。选择某维度的“全部”只清除该维度。时间选项为全部时间、今天、本周、下周、本月、下月、历史；左侧删除已逾期。事项本身的逾期提示规则保持不变。

状态、时间、分类三个分组标题使用协调的浅色底框和较大字体，各自独立展开/收起。首次使用默认仅展开状态，时间和分类收起；后续在本机记住用户的展开状态。

事项卡采用紧凑布局。标题栏同一行依次为状态呼吸圆点、较大标题、状态控件和最右侧“修改编辑”；标题下的小字只显示“类别 · 截止日期”。标题区域与内容区域之间使用分割线，不增加空白行。卡片内不得再次显示标题输入框、类别字段或截止日期字段。情况仅以一行摘要展示，标题和情况必须进入详情修改。列表内仍可操作最新进度、备注、跟进清单和状态；删除“一键完成”。进度、备注默认各显示一行，点击后展开编辑；跟进默认最多显示三条，超出后提供展开/收起。

状态圆点颜色：doing 绿色、todo 灰色、paused 红色、done 橙色；采用轻微呼吸动画，并在系统设置减少动画时停止动画。

### V2.1 并行边界

T21 A（feat/window-scroll-fix）：只改 src/styles.css，修复窗口底部裁切和三栏滚动，不改变业务组件。

T22 B（feat/compact-item-card）：只改 ItemList.tsx、ItemList 测试和 editor.css，实现紧凑事项卡、只读标题/情况、标题同行状态与编辑按钮、状态灯、按需展开编辑；不得改 App/Sidebar/filters/Rust。

T23 C（feat/multidim-sidebar）：只改 App.tsx、Sidebar.tsx、新增 sidebar.css、filters 及其测试，实现多维组合、时间项调整和可记忆折叠分组；不得改 ItemList/ItemEditor/Rust/全局 styles。

T24 QA（qa/v2.1）：只改 tests/** 和 docs/QA-V2.1.md，固定 PM 指定提交后测试，不得修改业务代码。

## V2 功能冻结（2026-09-06）

V2 只交付开发/调试版本，用户明确说“确认通过，可以打包”前禁止生成新版安装包。

工作台左侧顺序为“状态、时间、分类”。状态、时间、分类是单维度筛选：任意时刻只生效其中一个具体条件，选择另一个维度时清除前一个维度；关键词搜索始终可以叠加。时间选项为全部时间、今天、本周、下周、本月、下月、历史、逾期；删除未设日期和自定义日期。“历史”是截止日期早于本机今天的所有事项，不限制状态；“逾期”仍只包含截止日期早于今天且状态为 todo/doing 的事项。

事项卡直接展示标题、工作内容（界面称“情况”）、最新进度、跟进清单、备注、状态、分类和截止日期。可在卡片内提交新进度、编辑备注、增删改勾跟进项、修改状态和一键完成；进度必须新增历史记录，跟进勾选不得自动改状态。类别和截止日期只展示，必须点击“修改编辑”进入现有详情编辑器修改。内联写入成功通过 onChanged(WorkItem) 回传根组件，失败通过 onError(string) 展示且保留输入。

现有选择位置导出 JSON 和恢复功能保留。新增 quickBackup，无文件对话框，写入 app data dir 下的“备份”目录。当天首份名称为“工作备份文件YYYYMMDD.json”；同名已存在时增加不会覆盖旧文件的序号后缀。返回 QuickBackupResult（包含 path 与 BackupInfo 字段）。

新增 exportWorkItems(input)，由界面选择 TXT 目标路径。statuses、dateFilters、categoryIds 均支持多选；空数组表示该维度全选，all 与其他时间项同时出现时按全部时间处理，重叠结果去重。categoryIds 的 null 表示未分类。只导出未删除事项。按当前类别顺序分组，未分类最后；组内截止日期正序，无日期最后。每项格式为“序号、YYYY年M月D日，事项标题，事项最新进度；”，组内末项用句号；无日期写“未设日期”，无进度写“暂无最新进度”。文件编码 UTF-8，类别标题使用中文序号。导出默认建议文件名“工作事项汇总YYYYMMDD.txt”。

V2 新接口以 src/types.ts 和 src/api.ts 为准：quickBackup()、exportWorkItems(input)。后端 Rust serde 继续使用 camelCase。

## V2 并行边界

T11 A（feat/quick-backup-export）：只改 src-tauri/src/**、必要的 Cargo 文件与 Rust 测试，实现一键备份及 TXT 导出。

T12 B（feat/inline-item-card）：只改 ItemList.tsx、ItemList 测试、ItemEditor 及 editor.css；实现事项卡展示和内联编辑。不得修改 App、types/api、全局 styles 或 Rust。ItemList 使用基线已提供的 onChanged/onError。

T13 C（feat/workbench-v2）：只改 App.tsx、styles.css、Sidebar、BackupPanel、新增 ExportPanel、filters 及相应测试；实现单维筛选、历史、界面顺序、一键备份入口和导出界面。不得修改 ItemList、ItemEditor、types/api 或 Rust。

T14 QA（qa/v2）：只改 tests/**、测试配置和 docs/QA-V2.md；不得修改业务实现。固定 PM 指定提交后测试。

PM：维护公共契约、处理集成冲突、启动开发版、最终验收；本轮暂不打包。

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
