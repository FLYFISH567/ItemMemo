# ItemMemo
物记 (ItemMemo), a practical household item management tool for tracking, reminders, analytics, and export.
# 物记 ItemMemo

物记（ItemMemo）是一个本地优先的生活物品管理项目，帮助你完成物品记录、提醒处理、统计分析与数据导出。

项目目标是让日常物品管理从“记不清、找不到、算不明白”，变成“记录清晰、状态可追踪、成本可复盘”。

## 功能概览

- 首页总览：总物品数、总花费、待处理提醒、平均日均成本
- 物品管理：新增、编辑、删除、详情查看、使用记录
- 分类管理：新增、重命名、迁移、合并、删除（带规则限制）
- 提醒中心：筛选、单条处理、批量完成、清空记录
- 统计分析：分类分布、高日均成本排行、闲置物品分析
- 设置中心：提醒阈值配置、导出、危险操作
- 数据导出：JSON、CSV、SQLite 备份下载

## 技术栈

### 前端

- React
- TypeScript
- Vite
- React Router

### 后端

- Node.js
- Express
- Prisma
- SQLite
- Zod

## 项目结构

```text
writedown/
├─ apps/
│  ├─ web/                 # 前端应用
│  └─ api/                 # 后端服务
├─ packages/               # 共享模块
├─ data/                   # 本地数据库与导出目录
├─ PRDs/                   # 产品/设计/开发文档
├─ package.json            # monorepo 根脚本
└─ README.md
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化后端环境变量

```bash
copy apps\api\.env.example apps\api\.env
```

### 3. 初始化数据库（首次）

```bash
npm run prisma:generate -w apps/api
npm run prisma:migrate -w apps/api
```

### 4. 一行命令启动前后端

```bash
npm run dev:all
```

默认地址：

- 前端：http://localhost:5173
- 后端：http://localhost:3000

## 常用命令

```bash
# 仅启动后端
npm run dev:api

# 仅启动前端
npm run dev:web

# 构建前后端
npm run build
```

## 环境变量说明（apps/api/.env）

- DATABASE_URL：SQLite 数据库路径
- PORT：后端端口，默认 3000
- HIGH_DAILY_COST_THRESHOLD：高日均成本阈值，默认 5
- IDLE_DAYS_THRESHOLD：闲置阈值，默认 60

## 数据说明

- 本地数据库：data/app.db
- 导出目录：data/exports

说明：`node_modules`、本地缓存、运行时数据库文件不应上传到 GitHub，这是正常做法。

## 许可证

本项目使用仓库中的 LICENSE。

