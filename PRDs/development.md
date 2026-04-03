下面是按你现在已经确认的范围整理出的 **完整技术文档**。  
这版只覆盖当前要做的网页版，不写后续版本，不包含你明确不要的功能。

---

# 物品价值记录网页版 技术文档
**文档版本**：V1.0  
**产品形态**：Web 端  
**部署方式**：全本地部署  
**运行模式**：前端、本地 API、数据库、定时任务、导出服务全部运行在本机  
**当前范围**：首页总览、物品列表、独立物品详情页、分类管理、提醒中心、统计分析、设置、数据导出、深色模式、右下角小弹窗提醒

---

## 1. 目标与边界
### 1.1 项目目标
构建一个完全本地运行的网页版工具，帮助用户完成：

+ 记录生活物品
+ 维护分类
+ 计算持有时间
+ 计算日均成本
+ 管理提醒
+ 查看统计
+ 导出本地数据
+ 切换深色模式

### 1.2 本期必须包含
+ 首页总览
+ 物品列表
+ 独立物品详情页
+ 分类管理
+ 提醒中心
+ 统计分析
+ 设置页
+ 新增 / 编辑 / 删除物品
+ 持有时间与日均成本计算
+ 本地数据保存
+ 数据导出
+ 深色模式
+ 右下角小弹窗提醒

### 1.3 本期明确不做
+ 图片上传
+ AI 录入引导
+ 浏览器通知
+ 云数据库
+ 云文件存储
+ 云函数
+ 第三方 SaaS 服务
+ 登录 / 注册
+ 多设备同步
+ 多用户协作
+ 后续版本规划

---

## 2. 技术原则
### 2.1 全本地
所有服务只运行在本机，不依赖外部云端资源。数据库使用本地 SQLite；文件导出写本地目录；提醒由本地进程计算。

### 2.2 成熟优先
优先使用官方文档完善、生态稳定、CLI 成熟的主流框架与组件库，不做自研底层轮子。

### 2.3 组件装配优先
项目初始化、表单、表格、弹窗、侧边栏、开关、Toast、API 文档、ORM、迁移等，都优先使用现成框架和开源组件，不让 VSCode AI 从空白文件“手搓系统”。

### 2.4 业务代码只写产品独有逻辑
真正需要自己实现的部分只包括：

+ 持有天数计算
+ 日均成本计算
+ 提醒规则判断
+ 数据聚合统计
+ 导出文件生成
+ 深色模式偏好保存

---

## 3. 技术栈
## 3.1 前端
采用：

+ React
+ TypeScript
+ Vite
+ Tailwind CSS
+ shadcn/ui
+ React Router
+ React Hook Form
+ Zod
+ TanStack Table
+ TanStack Query

### 选型依据
React 官方文档强调组件化构建 UI 的方式，很适合当前这种页面多、模块多的 Web 工具。Vite 官方文档提供了 React 模板脚手架，并将其定位为现代 Web 的前端构建工具；Tailwind 官方文档提供了与 Vite 的直接集成方式。shadcn/ui 官方文档把自己定义为 open code 的组件分发方案，并提供 CLI 初始化；它适合直接拿来搭按钮、弹窗、表单、侧边栏、表格和提示组件，而不是自己从零写一套基础组件。([React](https://react.dev/?utm_source=chatgpt.com))

React Router 官方安装文档支持直接在 Vite React 项目中使用 `BrowserRouter`；React Hook Form 官方文档提供了成熟表单处理方式；Zod 官方文档说明它是 TypeScript-first 的校验库；TanStack Table 官方文档说明它是 headless table/datagrid 方案；TanStack Query 官方文档说明它适合异步数据查询与更新管理。([React Router](https://reactrouter.com/start/declarative/installation?utm_source=chatgpt.com))

---

## 3.2 后端
采用：

+ NestJS
+ Prisma ORM
+ SQLite
+ `@nestjs/schedule`
+ `@nestjs/swagger`

### 选型依据
NestJS 官方文档将其定义为用于构建高效、可扩展 Node.js 服务端应用的框架，并且完整支持 TypeScript。Nest 还提供任务调度能力和 OpenAPI 生成功能，适合本项目把提醒扫描和本地接口文档都收在同一个服务里。([NestJS文档](https://docs.nestjs.com/?utm_source=chatgpt.com))

Prisma 官方文档说明 Prisma ORM 支持 SQLite，并生成 type-safe 的 Prisma Client。SQLite 官方文档说明它是 self-contained、serverless、zero-configuration 的本地 SQL 引擎，非常适合单机本地工具。([Prisma](https://www.prisma.io/docs?utm_source=chatgpt.com))

---

## 3.3 本地编排
采用：

+ 日常开发：本地直接运行
+ 可选交付：Docker Compose

Docker 官方文档说明 Docker Compose 用于定义和运行多容器应用，Compose Specification 是当前推荐格式。这里它只是“本地一键启动整套环境”的辅助方案，不代表上云。([Docker Documentation](https://docs.docker.com/compose/?utm_source=chatgpt.com))

---

## 4. 总体架构
采用 **本地单机三层架构**：

### 前端 Web
+ 地址：`http://localhost:5173`
+ 职责：页面渲染、表单交互、列表展示、深色模式、Toast 提示

### 本地 API 服务
+ 地址：`http://localhost:3000`
+ 职责：业务逻辑、数据库访问、提醒扫描、导出接口、设置管理

### 本地数据层
+ SQLite 数据库文件
+ 本地导出目录
+ 本地配置存储

### 架构目标
+ 前端只负责展示和交互
+ 后端统一负责业务规则
+ 数据只保存在本机
+ 不引入额外基础设施，如 Redis、消息队列、搜索引擎

---

## 5. 仓库结构
建议采用单仓结构：

```plain
project-root/
  apps/
    web/                  # React + Vite 前端
    api/                  # NestJS 后端
  packages/
    shared/               # 共享类型、schema、常量
    ui/                   # 对 shadcn 的二次封装
  data/
    app.db                # SQLite 数据库
    exports/              # 导出文件
    backups/              # 手动备份
  docs/
    product.md
    ui-design.md
    tech-design.md
```

### 结构原则
+ `apps/web` 只放前端代码
+ `apps/api` 只放服务端代码
+ `packages/shared` 放前后端共用的 DTO、枚举、schema
+ `packages/ui` 放项目自己的 UI 组件壳
+ `data` 保持在仓库根目录，便于本地备份和排查

---

## 6. 本地目录与文件策略
## 6.1 数据目录
```plain
data/
  app.db
  exports/
  backups/
  logs/
```

## 6.2 存储用途
+ `app.db`：业务主数据库
+ `exports/`：导出结果
+ `backups/`：手动备份包
+ `logs/`：本地日志

## 6.3 浏览器本地存储使用边界
浏览器本地存储只用于：

+ 当前主题模式
+ 搜索条件缓存
+ 当前排序方式
+ 临时表单草稿

业务主数据不以 `localStorage` 作为唯一来源。

---

## 7. 前端技术设计
## 7.1 路由设计
页面路由：

+ `/` 首页总览
+ `/items` 物品列表
+ `/items/:id` 物品详情
+ `/categories` 分类管理
+ `/reminders` 提醒中心
+ `/analytics` 统计分析
+ `/settings` 设置

### 路由要求
+ 首页与主导航一一对应
+ 详情页独立路由
+ 404 页面可简单处理为重定向首页或空状态页

---

## 7.2 前端模块划分
### app-shell
负责：

+ 侧边导航
+ 顶部头部区
+ 全局搜索
+ 页面切换
+ 全局 Toast

### dashboard
负责：

+ 统计卡片
+ 最近记录物品
+ 提醒摘要
+ 分类概览

### items
负责：

+ 物品列表
+ 搜索 / 筛选 / 排序
+ 新增物品
+ 编辑物品
+ 删除物品

### item-detail
负责：

+ 物品详情页
+ 状态更新
+ 提醒展示
+ 删除确认

### categories
负责：

+ 分类列表
+ 新增分类
+ 编辑分类
+ 删除分类
+ 排序

### reminders
负责：

+ 提醒列表
+ 提醒处理
+ 提醒状态筛选

### analytics
负责：

+ 汇总指标
+ 分类统计
+ 高日均成本物品
+ 闲置物品
+ 洞察文本

### settings
负责：

+ 深色模式
+ 默认提醒时间
+ 右下角提示开关
+ 数据导出入口

---

## 7.3 UI 组件来源
必须优先用 shadcn/ui CLI 添加以下组件：

+ button
+ input
+ select
+ card
+ dialog
+ alert-dialog
+ sidebar
+ badge
+ table
+ switch
+ dropdown-menu
+ sonner

shadcn 官方文档推荐通过 CLI 初始化和添加组件；同时官方也明确标注 Toast 组件已废弃，推荐使用 Sonner。Sonner 文档支持右下角位置展示，并支持 success、info、warning、error 等类型，这正符合你的提醒要求。([Shadcn](https://ui.shadcn.com/docs/cli?utm_source=chatgpt.com))

### 原则
+ 不手写 Button、Dialog、Toast、Sidebar、Switch 等底层 UI
+ 业务页面只负责组合组件，不重写基础交互

---

## 7.4 表单体系
所有表单使用：

+ React Hook Form
+ Zod
+ shadcn Form 组合

### 适用范围
+ 新增物品
+ 编辑物品
+ 新增分类
+ 编辑分类
+ 设置页
+ 导出确认弹窗

### 原则
+ 前端校验和后端校验同时存在
+ Zod schema 统一放在 `packages/shared`
+ 表单错误信息由统一组件渲染

---

## 7.5 表格与列表体系
列表类页面使用 TanStack Table 作为逻辑层。

### 适用页面
+ 物品列表
+ 分类管理列表
+ 提醒中心列表

### 说明
TanStack Table 是 headless 方案，只提供表格逻辑，不强制 UI；这意味着项目可以继续使用当前统一 UI 风格，不需要换成某种重型表格库。([TanStack](https://tanstack.com/table/latest/docs?utm_source=chatgpt.com))

### 支持能力
+ 排序
+ 过滤
+ 列定义
+ 行渲染
+ 后续分页扩展

---

## 7.6 前端状态管理
### 服务端数据状态
使用 TanStack Query 管理：

+ 首页汇总
+ 物品列表
+ 分类列表
+ 提醒列表
+ 设置
+ 统计结果

### 表单状态
使用 React Hook Form 管理。

### 纯 UI 状态
使用 React 内置状态或轻量 context 管理：

+ 弹窗开关
+ 当前筛选
+ 当前排序
+ 深色模式
+ Toast 显示

---

## 7.7 深色模式
### 实现方式
+ Tailwind class 模式
+ 根节点加 `dark` 类
+ 设置页可切换
+ 偏好写入设置表，并在浏览器缓存一份最近值

### 要求
+ 首页、列表、详情、提醒、统计、设置页全部适配
+ 表格、输入框、badge、toast 在深色模式下可读
+ 深色模式切换不刷新页面

---

## 7.8 右下角小弹窗提醒
### 实现方式
使用 Sonner，位置固定为 bottom-right。

### 触发场景
+ 新增成功
+ 编辑成功
+ 删除成功
+ 导出成功
+ 导出失败
+ 提醒到期
+ 提醒标记完成
+ 提醒稍后处理

### 显示策略
+ 同时最多显示 3 条
+ 自动消失
+ 错误类型保留更久
+ 不阻塞用户操作

---

## 8. 后端技术设计
## 8.1 模块划分
### CategoryModule
负责：

+ 分类 CRUD
+ 分类排序
+ 删除校验

### ItemModule
负责：

+ 物品 CRUD
+ 物品状态更新
+ 列表查询
+ 详情查询
+ 成本计算服务

### ReminderModule
负责：

+ 提醒规则管理
+ 提醒列表
+ 标记完成
+ 稍后提醒
+ 定时扫描

### AnalyticsModule
负责：

+ 首页汇总
+ 分类统计
+ 日均成本排行
+ 闲置统计

### SettingsModule
负责：

+ 默认提醒时间
+ 深色模式偏好
+ Toast 开关
+ 导出格式偏好

### ExportModule
负责：

+ JSON 导出
+ CSV 导出
+ SQLite 备份导出

---

## 8.2 服务分层
推荐后端结构：

+ Controller：只处理请求和响应
+ Service：业务逻辑
+ Repository / Prisma Service：数据库访问
+ DTO：入参出参约束
+ Mapper：数据库对象转接口对象
+ Scheduler：提醒扫描任务

### 原则
+ Controller 不写业务规则
+ Service 不直接耦合 HTTP
+ 计算逻辑单独封装，便于单元测试

---

## 8.3 API 文档
使用 `@nestjs/swagger` 自动生成本地 API 文档。

### 地址
+ `http://localhost:3000/docs`

### 要求
+ 所有 DTO 写清楚校验规则
+ 列表查询参数要进 Swagger
+ 导出接口要写返回类型说明

Nest 官方文档说明 SwaggerModule 可以基于装饰器生成 OpenAPI 文档。([NestJS文档](https://docs.nestjs.com/openapi/introduction?utm_source=chatgpt.com))

---

## 8.4 本地定时任务
使用 `@nestjs/schedule`。

### 任务职责
+ 扫描固定周期提醒
+ 扫描持有时间提醒
+ 扫描高日均成本提醒
+ 扫描补购提醒

### 调度策略
+ 应用启动后先执行一次
+ 每 5 分钟执行一次扫描
+ 不依赖操作系统 cron
+ 扫描结果写入数据库表，不在前端临时计算

Nest 官方文档说明 `@nestjs/schedule` 可支持固定日期、固定间隔和类似 cron 的调度。([NestJS文档](https://docs.nestjs.com/techniques/task-scheduling?utm_source=chatgpt.com))

---

## 9. 数据库设计
## 9.1 选型
主数据库：SQLite

### 原因
SQLite 官方文档说明它是 in-process、self-contained、serverless、zero-configuration 的 SQL 引擎，非常适合单机本地应用。([SQLite](https://sqlite.org/about.html?utm_source=chatgpt.com))

---

## 9.2 数据表设计
## categories
```plain
id
name
sort_order
color
created_at
updated_at
```

## items
```plain
id
name
category_id
price
purchase_date
status
note
created_at
updated_at
```

## reminder_rules
```plain
id
item_id
type
cycle_days
threshold_value
enabled
next_trigger_at
created_at
updated_at
```

## reminders
```plain
id
item_id
rule_id
title
description
type
status
due_at
done_at
snoozed_until
created_at
updated_at
```

## settings
```plain
id
theme
default_reminder_time
toast_enabled
export_format
created_at
updated_at
```

---

## 9.3 Prisma schema（建议版）
```plain
datasource db {
  provider = "sqlite"
  url      = "file:../../data/app.db"
}

generator client {
  provider = "prisma-client-js"
}

enum ItemStatus {
  IN_USE
  IDLE
  REPLACE_SOON
  RESTOCK_SOON
  DISCARDED
}

enum ReminderType {
  FIXED_CYCLE
  OWNED_DAYS
  HIGH_DAILY_COST
  RESTOCK
}

enum ReminderStatus {
  PENDING
  DONE
  SNOOZED
}

enum ThemeMode {
  LIGHT
  DARK
  SYSTEM
}

model Category {
  id         Int      @id @default(autoincrement())
  name       String   @unique
  sortOrder  Int      @default(0)
  color      String   @default("neutral")
  items      Item[]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model Item {
  id            Int            @id @default(autoincrement())
  name          String
  categoryId    Int
  category      Category       @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  price         Decimal
  purchaseDate  DateTime
  status        ItemStatus     @default(IN_USE)
  note          String?
  reminderRules ReminderRule[]
  reminders     Reminder[]
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
}

model ReminderRule {
  id             Int            @id @default(autoincrement())
  itemId         Int
  item           Item           @relation(fields: [itemId], references: [id], onDelete: Cascade)
  type           ReminderType
  cycleDays      Int?
  thresholdValue Float?
  enabled        Boolean        @default(true)
  nextTriggerAt  DateTime?
  reminders      Reminder[]
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
}

model Reminder {
  id           Int             @id @default(autoincrement())
  itemId        Int
  item          Item           @relation(fields: [itemId], references: [id], onDelete: Cascade)
  ruleId        Int?
  rule          ReminderRule?  @relation(fields: [ruleId], references: [id], onDelete: SetNull)
  title         String
  description   String
  type          ReminderType
  status        ReminderStatus @default(PENDING)
  dueAt         DateTime
  doneAt        DateTime?
  snoozedUntil  DateTime?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
}

model Setting {
  id                  Int       @id @default(1)
  theme               ThemeMode @default(LIGHT)
  defaultReminderTime String    @default("09:00")
  toastEnabled        Boolean   @default(true)
  exportFormat        String    @default("json")
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
}
```

### 说明
+ 价格建议用 `Decimal`
+ 分类删除默认 Restrict，避免误删关联物品
+ 设置表只保留单行

Prisma 官方文档说明 Prisma Client 是自动生成且 type-safe 的查询器，适合这种 schema 驱动方式。([Prisma](https://www.prisma.io/docs/prisma-orm/quickstart/sqlite?utm_source=chatgpt.com))

---

## 10. 业务规则
## 10.1 持有天数
```plain
daysOwned = max(1, floor(today - purchaseDate) + 1)
```

### 规则
+ 购买当天按 1 天
+ 未来日期录入也兜底为 1 天
+ 无效日期视为校验失败，不允许写库

---

## 10.2 日均成本
```plain
dailyCost = price / daysOwned
```

### 规则
+ 价格为 0，结果为 0
+ 保留 2 位小数
+ 所有展示和统计都使用统一计算函数
+ 不把 dailyCost 持久化到数据库，运行时计算即可

---

## 10.3 提醒规则
### 固定周期提醒
适用：

+ 牙刷
+ 刀头
+ 消耗品

规则：

+ 有 `cycleDays`
+ 到 `nextTriggerAt` 时生成提醒

### 持有时间提醒
规则：

+ 当前持有天数达到阈值时生成提醒

### 高日均成本提醒
规则：

+ 当前日均成本高于阈值时生成提醒

### 补购提醒
规则：

+ 依据设定周期或阈值生成提醒

---

## 11. API 设计
## 11.1 分类接口
### 获取分类列表
`GET /api/categories`

### 新增分类
`POST /api/categories`

请求体：

```json
{
  "name": "数码",
  "color": "violet"
}
```

### 编辑分类
`PATCH /api/categories/:id`

### 删除分类
`DELETE /api/categories/:id`

### 调整排序
`PATCH /api/categories/reorder`

---

## 11.2 物品接口
### 获取物品列表
`GET /api/items`

查询参数：

+ `keyword`
+ `categoryId`
+ `status`
+ `sortBy`
+ `sortOrder`

### 获取物品详情
`GET /api/items/:id`

### 新增物品
`POST /api/items`

请求体：

```json
{
  "name": "AirPods Pro",
  "categoryId": 2,
  "price": 1899,
  "purchaseDate": "2026-04-01",
  "status": "IN_USE",
  "note": "通勤使用"
}
```

### 编辑物品
`PATCH /api/items/:id`

### 删除物品
`DELETE /api/items/:id`

### 更新状态
`PATCH /api/items/:id/status`

---

## 11.3 提醒接口
### 获取提醒列表
`GET /api/reminders`

查询参数：

+ `status`
+ `type`
+ `itemId`

### 标记完成
`PATCH /api/reminders/:id/done`

### 稍后提醒
`PATCH /api/reminders/:id/snooze`

请求体：

```json
{
  "until": "2026-04-04T09:00:00"
}
```

---

## 11.4 首页与统计接口
### 首页汇总
`GET /api/dashboard/summary`

返回内容：

+ 总物品数
+ 总花费
+ 待处理提醒数
+ 平均日均成本
+ 最近物品
+ 提醒摘要
+ 分类概览

### 统计汇总
`GET /api/analytics/summary`

### 分类统计
`GET /api/analytics/categories`

### 高日均成本物品
`GET /api/analytics/high-daily-cost`

### 闲置物品
`GET /api/analytics/idle-items`

---

## 11.5 设置接口
### 获取设置
`GET /api/settings`

### 更新设置
`PATCH /api/settings`

请求体：

```json
{
  "theme": "DARK",
  "defaultReminderTime": "09:00",
  "toastEnabled": true,
  "exportFormat": "json"
}
```

---

## 11.6 导出接口
### 导出 JSON
`POST /api/export/json`

### 导出 CSV
`POST /api/export/csv`

### 导出本地备份包
`POST /api/export/backup`

返回：

```json
{
  "filePath": "data/exports/export-2026-04-03.json",
  "fileName": "export-2026-04-03.json"
}
```

---

## 12. DTO 与校验
## 12.1 分类 DTO
```plain
name: string (1~30)
color?: string
```

## 12.2 物品 DTO
```plain
name: string (1~100)
categoryId: number
price: number (>= 0)
purchaseDate: string (valid date)
status: enum
note?: string (<= 1000)
```

## 12.3 设置 DTO
```plain
theme: LIGHT | DARK | SYSTEM
defaultReminderTime: string (HH:mm)
toastEnabled: boolean
exportFormat: json | csv | backup
```

### 校验要求
+ 前后端都校验
+ 前端校验用于即时反馈
+ 后端校验用于最终可信性

---

## 13. 搜索、排序、筛选规则
## 13.1 搜索
支持：

+ 物品名称
+ 分类名称

### 实现建议
SQLite `LIKE` 即可，数据量小不需要全文索引。

---

## 13.2 排序
支持：

+ 价格
+ 购买日期
+ 持有时间
+ 日均成本
+ 最近更新

### 注意
+ `持有时间` 和 `日均成本` 不是数据库原生字段，建议先查出后在服务层计算后排序；若未来数据量大，再考虑增加缓存字段

---

## 13.3 筛选
支持：

+ 分类
+ 状态
+ 是否有提醒
+ 是否高日均成本

---

## 14. 数据导出设计
## 14.1 导出内容
+ 分类
+ 物品
+ 提醒规则
+ 提醒记录
+ 设置

## 14.2 支持格式
+ JSON
+ CSV
+ SQLite 备份包

## 14.3 输出位置
固定写入：

```plain
data/exports/
```

## 14.4 前端交互
+ 顶部“导出数据”
+ 设置页“数据导出”
+ 导出前出现确认弹窗
+ 导出后右下角 Toast 提示

---

## 15. 深色模式设计
## 15.1 存储位置
+ 数据库 `settings.theme`
+ 浏览器本地缓存最近值

## 15.2 渲染策略
前端启动时优先读取：

1. 本地缓存
2. 后端设置
3. 系统默认

## 15.3 范围
需要覆盖：

+ 页面背景
+ 卡片
+ 表格
+ 表单
+ Badge
+ Toast
+ 导航
+ 弹窗

---

## 16. 右下角小弹窗提醒设计
## 16.1 技术实现
使用 Sonner。

### 原因
shadcn 官方明确推荐 Sonner 替代旧 Toast，并支持位置控制。([Shadcn](https://ui.shadcn.com/docs/components/radix/toast?utm_source=chatgpt.com))

## 16.2 展示位置
`bottom-right`

## 16.3 类型
+ success
+ info
+ warning
+ error

## 16.4 文案来源
+ 前端主动操作结果
+ 后端接口返回消息
+ 提醒到期摘要

---

## 17. 本地配置与环境变量
建议配置：

```plain
PORT=3000
WEB_PORT=5173
DATABASE_URL="file:../../data/app.db"
EXPORT_DIR="../../data/exports"
BACKUP_DIR="../../data/backups"
LOG_DIR="../../data/logs"
APP_TIMEZONE="Asia/Tokyo"
```

### 原则
+ 所有路径都可配置
+ 默认仍指向本地 `data/` 目录
+ 不配置任何云端凭证

---

## 18. 错误处理
## 18.1 前端
+ 表单错误：字段下展示
+ 请求错误：右下角 Toast
+ 空状态：页面内展示
+ 详情不存在：跳转列表并提示

## 18.2 后端
统一返回结构：

```json
{
  "success": false,
  "message": "分类不存在",
  "code": "CATEGORY_NOT_FOUND"
}
```

### 原则
+ 业务错误可读
+ 不把数据库底层报错直接抛给前端
+ 服务端保留日志

---

## 19. 日志设计
## 19.1 日志位置
写到：

```plain
data/logs/
```

## 19.2 记录内容
+ 应用启动
+ 定时扫描结果
+ 导出结果
+ 业务错误
+ 未捕获异常

## 19.3 日志级别
+ info
+ warn
+ error

### 建议
MVP 可先用 Nest Logger + 文件追加方案，不引入重型日志平台。

---

## 20. 安全与隐私
## 20.1 当前安全边界
这是单机本地工具，主要关注：

+ 本地数据不外发
+ 导出文件路径可控
+ 危险操作有确认
+ 输入校验避免异常数据

## 20.2 不需要做的
+ OAuth
+ 多租户
+ 第三方登录
+ 云安全策略
+ 复杂权限系统

## 20.3 需要做的
+ DTO 校验
+ SQL/ORM 安全写法
+ 路径白名单
+ 删除确认
+ 备份导出确认

---

## 21. 初始化与脚手架命令
## 21.1 前端初始化
按官方文档，Vite 可用 `create-vite` 初始化；Tailwind 文档给出 Vite 插件接法；React Router 文档支持在 Vite React 项目中直接接入。([vitejs](https://vite.dev/guide/?utm_source=chatgpt.com))

```bash
npm create vite@latest web -- --template react-ts
cd web
npm install
npm install tailwindcss @tailwindcss/vite
npm install react-router react-hook-form zod @hookform/resolvers
npm install @tanstack/react-query @tanstack/react-table
```

## 21.2 shadcn 初始化
shadcn 官方文档提供 `init` 和 `add`。([Shadcn](https://ui.shadcn.com/docs/cli?utm_source=chatgpt.com))

```bash
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button input select dialog alert-dialog sidebar card table badge switch sonner dropdown-menu
```

## 21.3 后端初始化
Nest 官方文档与 Prisma SQLite quickstart 都提供标准初始化方式。([NestJS文档](https://docs.nestjs.com/first-steps?utm_source=chatgpt.com))

```bash
npx @nestjs/cli new api
cd api
npm install @prisma/client prisma sqlite3
npx prisma init --datasource-provider sqlite
npm install @nestjs/schedule @nestjs/swagger swagger-ui-express
```

---

## 22. 本地运行方式
## 22.1 开发态
分别启动：

### 前端
```bash
cd apps/web
npm run dev
```

### 后端
```bash
cd apps/api
npm run start:dev
```

---

## 22.2 可选 Docker Compose
Compose 只作为本地一键启动辅助。

```yaml
services:
  api:
    build: ./apps/api
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data

  web:
    build: ./apps/web
    ports:
      - "5173:5173"
    depends_on:
      - api
```

---

## 23. 测试设计
## 23.1 后端单元测试
必须覆盖：

+ 持有天数计算
+ 日均成本计算
+ 提醒规则判断
+ 分类删除校验
+ 导出文件路径生成

## 23.2 后端集成测试
必须覆盖：

+ 分类 CRUD
+ 物品 CRUD
+ 提醒获取 / 完成 / 稍后提醒
+ 首页汇总
+ 统计接口
+ 设置接口
+ 导出接口

## 23.3 前端测试
必须覆盖：

+ 新增物品表单
+ 物品列表搜索 / 筛选 / 排序
+ 物品详情页打开
+ 深色模式切换
+ 导出确认流程
+ Toast 显示

---

## 24. 性能要求
### 数据规模预期
MVP 阶段按单机、单用户、小到中等数据量设计。

### 指标
+ 首屏打开快速
+ 常规列表查询在本地应即时返回
+ 导出在小数据量下应秒级完成
+ 深色模式切换不刷新页面

### 不做的优化
+ 不做 SSR
+ 不做 CDN
+ 不做缓存服务器
+ 不做复杂分页优化

---

## 25. 可维护性要求
+ 前后端均使用 TypeScript
+ DTO、schema、枚举统一放共享包
+ 计算逻辑单独抽函数
+ 页面与组件分离
+ API 文档自动生成
+ 数据迁移使用 Prisma migration
+ 所有本地路径集中配置

---

## 26. 交付清单
完整交付应包含：

### 前端
+ 首页
+ 物品列表
+ 物品详情页
+ 分类管理
+ 提醒中心
+ 统计分析
+ 设置页
+ 新增 / 编辑弹窗
+ 深色模式
+ 右下角小弹窗

### 后端
+ 分类 API
+ 物品 API
+ 提醒 API
+ 统计 API
+ 设置 API
+ 导出 API
+ 本地 Swagger 文档
+ 本地定时任务

### 数据层
+ SQLite 数据库
+ migration 文件
+ 初始种子数据（可选）

### 文档
+ 产品文档
+ UI 设计文档
+ 技术文档
+ 启动说明
+ 环境变量示例

---

## 27. 最终技术结论
这项目当前最合适的落地方案是：

### 前端
+ React
+ TypeScript
+ Vite
+ Tailwind CSS
+ shadcn/ui
+ React Router
+ React Hook Form
+ Zod
+ TanStack Table
+ TanStack Query

### 后端
+ NestJS
+ Prisma
+ SQLite
+ `@nestjs/schedule`
+ `@nestjs/swagger`

### 本地运行
+ 浏览器 + 本地 Node API + 本地 SQLite
+ 可选 Docker Compose
+ 不使用任何云端服务

### 明确不做
+ 图片上传
+ AI 录入
+ 浏览器通知
+ 所有云服务
+ 多用户 / 多端同步
+ 后续版本扩展内容



