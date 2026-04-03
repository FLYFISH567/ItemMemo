## Plan: 物品价值记录 0-1 开发计划

目标是在 4-6 周内完成首发可用版本，覆盖记录-计算-提醒-复盘闭环，且首发必须包含数据导出与深色模式。实施上采用“先底座、再核心、后增强”的依赖顺序，每个关键节点都要求回看对应文档章节，避免范围漂移。

**Steps**
1. Phase A 需求冻结与架构起步（M0，预计第 1 周）: 对齐三份文档的最新口径，冻结首发范围；初始化前后端工程与本地运行链路。*后续所有步骤依赖此阶段*
2. Phase A-1 关键节点文档回看（M0 Gate）: 回看 c:/Users/FLYFISH/Desktop/writedown/PRDs/development.md 中“总体架构、仓库结构、初始化命令、本地运行方式”；回看 c:/Users/FLYFISH/Desktop/writedown/PRDs/PRD.md 中“产品范围与成功标准”；回看 c:/Users/FLYFISH/Desktop/writedown/PRDs/UI.md 中“全局布局与导航”。
3. Phase B 数据模型与计算内核（M1，预计第 1-2 周）: 建立 SQLite + Prisma 数据模型（分类、物品、提醒规则、提醒、设置），实现持有天数与日均成本统一计算函数，补齐核心单测；新增 `lastUsedAt` 与 `statusUpdatedAt` 字段并定义更新语义。*依赖步骤 1；步骤 4 可在后半段并行准备页面骨架*
4. Phase C 基础业务流（M2-M3，预计第 2-3 周）: 先交付分类管理，再交付物品管理（列表、搜索筛选排序、新增编辑删除、独立详情页），打通“可录入可管理”主流程；最近使用时间仅在“状态切换为使用中”或“详情页手动记录一次使用”时刷新，其他编辑仅更新状态更新时间。*依赖步骤 3*
5. Phase C-1 关键节点文档回看（M3 Gate）: 回看 c:/Users/FLYFISH/Desktop/writedown/PRDs/PRD.md 中“分类管理、物品管理、搜索排序筛选、计算规则”；回看 c:/Users/FLYFISH/Desktop/writedown/PRDs/UI.md 中“物品列表页、物品详情页、新增弹窗规范”；回看 c:/Users/FLYFISH/Desktop/writedown/PRDs/development.md 中“分类/物品 API 设计与 DTO 校验”。
6. Phase D 提醒系统（M4，预计第 3-4 周）: 实现提醒规则引擎与定时扫描任务，落地提醒中心与“完成/稍后提醒”操作，统一右下角轻提示反馈；高日均成本采用全局固定阈值（默认 5 元/天），阈值在设置页可修改。*依赖步骤 4*
7. Phase D-1 关键节点文档回看（M4 Gate）: 回看 c:/Users/FLYFISH/Desktop/writedown/PRDs/PRD.md 中“提醒管理功能定义”；回看 c:/Users/FLYFISH/Desktop/writedown/PRDs/UI.md 中“提醒中心页与右下角弹窗”；回看 c:/Users/FLYFISH/Desktop/writedown/PRDs/development.md 中“提醒模块、定时任务、Sonner 提示策略”。
8. Phase E 统计与首页总览（M5，预计第 4-5 周）: 建立首页汇总与统计分析接口，完成仪表盘、分类分布、高日均成本与闲置视图，形成“记录后可复盘”的价值展示；闲置按最近使用时间/最近状态更新时间判定，默认 60 天无使用或无相关状态更新。*依赖步骤 6；可与步骤 9 部分并行联调*
9. Phase F 首发增强与交付封板（M6，预计第 5-6 周）: 落地深色模式、数据导出（JSON/CSV/SQLite 备份）、设置页、Swagger 文档、关键日志与错误处理，完成首发验收。*依赖步骤 8*
10. Phase F-1 关键节点文档回看（Release Gate）: 回看 c:/Users/FLYFISH/Desktop/writedown/PRDs/UI.md 中“深色模式、导出交互、设置页”；回看 c:/Users/FLYFISH/Desktop/writedown/PRDs/development.md 中“导出模块、主题策略、API 文档、测试设计、交付清单”；回看 c:/Users/FLYFISH/Desktop/writedown/PRDs/PRD.md 中“验收标准”。

**Relevant files**
- c:/Users/FLYFISH/Desktop/writedown/PRDs/PRD.md — 产品目标、范围边界、核心功能规则、验收标准基线
- c:/Users/FLYFISH/Desktop/writedown/PRDs/UI.md — 页面结构、组件规范、交互规范、深色模式与导出 UI 约束
- c:/Users/FLYFISH/Desktop/writedown/PRDs/development.md — 技术栈、模块分层、数据库模型、API、调度、测试和交付规范

**Verification**
1. M0 验证: 前后端本地可启动，基础路由和健康接口可访问。
2. M1 验证: Prisma migration 成功，计算函数单测通过（边界值覆盖）。
3. M2-M3 验证: 分类与物品主流程端到端可跑通（新增-编辑-筛选-详情-删除）；`lastUsedAt` 仅在“状态改为使用中”与“手动记录使用”两类操作更新，其他编辑不更新。
4. M4 验证: 定时扫描可生成提醒，提醒中心可处理“完成/稍后”，右下角提示准确；全局高日均成本阈值默认 5 元/天且可在设置页修改后即时生效。
5. M5 验证: 首页与统计页数据与数据库一致，关键指标计算一致性通过抽样核对；闲置判定仅基于最近使用时间/最近状态更新时间，默认 60 天规则正确。
6. M6 验证: 深色模式全页面可读、导出三种格式可用、核心自动化测试通过并补充手测清单。

**Decisions**
- 总周期采用 4-6 周。
- 首发范围强制包含数据导出与深色模式。
- 测试策略采用“核心模块自动化测试 + 手动回归测试”。
- 需求优先级以 development.md 与 UI.md 为最新口径，PRD.md 作为业务目标与验收基线；如冲突，先对齐后开发。
- 高日均成本阈值本期采用全局固定阈值，不做按分类配置；默认值 5 元/天，并在设置页提供可修改的全局参数。
- 闲置判定口径固定为“最近使用时间/最近状态更新时间”，默认 60 天无使用或无相关状态更新判定为闲置。
- `lastUsedAt` 更新触发仅有两类：状态切换为使用中、详情页手动记录一次使用；其他信息编辑不刷新 `lastUsedAt`，仅刷新 `statusUpdatedAt`。
- 变更管理采用 M3 后冻结策略：M4-M6 仅接收 P0 缺陷，新增需求和优化项进入下一阶段 backlog。

**Further Considerations**
1. 建议每周一次文档同步检查：只要范围有变更，三份文档必须同周更新，防止开发按旧口径执行。
2. 建议在设置页加入“阈值修改影响说明”（会影响提醒与统计结果），减少认知偏差。
3. 数据维护策略已确定并纳入验收：`lastUsedAt` 与 `statusUpdatedAt` 按已确认触发规则更新，手测需覆盖误刷新与漏刷新的边界场景。