# AI-Chat-Project

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg?style=flat-square&logo=typescript)
![Vue 3](https://img.shields.io/badge/Vue-3.5-brightgreen.svg?style=flat-square&logo=vue.js)
![Vite](https://img.shields.io/badge/Vite-7.1-646CFF.svg?style=flat-square&logo=vite)
![Electron](https://img.shields.io/badge/Electron-39.1-47848F.svg?style=flat-square&logo=electron)
![NestJS](https://img.shields.io/badge/NestJS-11.0-E0234E.svg?style=flat-square&logo=nestjs)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-8.16-4169E1.svg?style=flat-square&logo=postgresql)
![Redis](https://img.shields.io/badge/Redis-5.11-DC382D.svg?style=flat-square&logo=redis)
![Ant Design Vue](https://img.shields.io/badge/Ant%20Design%20Vue-4.2-1890FF.svg?style=flat-square&logo=antdesign)

**基于 Vue 3 + TypeScript + Vite + Electron + Pinia + NestJS + PostgreSQL + TypeORM 实现的高性能全栈 AI 智能辅助创作平台**  
同时支持现代化 Web 浏览器端与跨平台原生桌面端（Windows / macOS / Linux）

</div>

---

## 📖 项目简介

**AI-Chat-Project** 是一套开箱即用、企业级设计的全栈式 AI 对话与图像创作平台。项目采用前后端分离与多端一体化架构：
- 前端基于 **Vue 3 + Vite + Ant Design Vue**，结合自研 **Command Deck 一体化指令控制台** 与 **自适应平滑吸底滚动引擎**，提供媲美顶尖商业产品的交互质感；
- 桌面端基于 **Electron** 提供跨平台原生窗口应用，支持快捷打包；
- 后端基于 **NestJS 11** 企业级框架开发，搭配 **PostgreSQL + TypeORM** 持久化存储与 **Redis** 高性能缓存，内建供应商与模型种子自动同步（Seeder）、SSE 流式响应、多模态附件解析与完备的积分预占结算体系。

---

## ✨ 核心特性

### 1. 💬 智能多模态对话 (AI Chat Workbench)
- **SSE 流式传输与逐字打字机**：基于 Server-Sent Events 实现毫秒级响应流式输出，平滑且无页面阻塞。
- **深度思考模型（Reasoning Panel）支持**：原生兼容带思维链（Chain of Thought）的模型（如 DeepSeek-R1、Grok 系列思考模型），支持思考耗时统计与思考过程折叠收起。
- **动态模型热切换**：支持随时切换已启用的文本对话模型（`grok-chat-fast`、`grok-4.5`、`grok-build-0.1`、`GLM-5`、`claude-opus-4-5` 等），并在聊天模式下严格隐藏生图专用模型。
- **多模态图像与附件上传**：支持用户在对话中上传图片、PDF、Word 附件，由多模态大模型进行综合语义理解与图文交互。
- **精美 Markdown 排版**：内置代码高亮、一键免密复制代码、标准 LaTeX 数学公式渲染、自适应优雅数据表格。
- **会话持久化与无限滚动**：多会话自由创建、重命名、归档清理，向上滚动自动加载更早历史消息。
- **自研贴底稳定滚动算法**：融合 `useScrollManager`、多帧 RAF 沉降追踪（`trackSettling`）与 `ResizeObserver`，彻底杜绝复杂表格排版膨胀引发的滚动条卡在中部问题。

### 2. 🎨 灵感生图工作台 (AI Image Workbench)
- **生图引擎接入**：直连 Grok Imagine（`grok-imagine-image-2.0`）顶级生图引擎。
- **参数控制台 (Command Deck)**：极简药丸胶囊风格设计，无死角配置生成张数（1x~4x）、宽高比（1:1、16:9、9:16 等）、分辨率（1k/2k）与生图质量。
- **多状态卡片画廊**：
  - 创作请求发出后自动平滑置顶；
  - 绘制中展现现代呼吸感骨架屏与动态进度条；
  - 生成完毕支持大图无缝灯箱预览与高保真原图一键下载；
  - 失败任务展示清晰状态与重试引导。

### 3. 💳 账户与积分结算机制 (Credits & Billing)
- **双轨结算模型**：
  - 对话模式：发送前预占最低消耗额度，完成后按实际 Token 消耗精准核销多退少补；
  - 生图模式：按张数与模型定价精准扣除。
- **积分流水明细 (Credit Ledger)**：实时追踪每一笔积分扣除、预占与结余记录，提供独立个人中心看板。

### 4. 🖥️ 多端一致性体验 (Web & Desktop)
- **Web 端**：响应式现代化单页应用，极速 Vite 热重载。
- **桌面端**：基于 Electron 的独立原生客户端，集成自定义无边框窗口与系统托盘。

### 5. 🛡️ 企业级后端服务 (NestJS Architecture)
- **依赖自愈与健康检查**：提供 `/health` 多维探活（PostgreSQL、Redis、AI Providers 实时联通性）。
- **供应商多路分发**：支持 Grok2API、通用 OpenAI 兼容接口等多供应商热插拔。
- **安全认证体系**：JWT Token 鉴权、RBAC 角色权限控制（User / Admin）、图形验证码（svg-captcha）及阿里云 DirectMail/SMS 验证。
- **Swagger OpenAPI 规范**：全量接口自动文档化，内建清晰的请求示例。

---

## 🏗️ 技术栈一览

| 领域 | 核心技术 | 说明 |
| :--- | :--- | :--- |
| **前端框架** | Vue 3.5 + TypeScript 5.9 | Composition API + `<script setup>` 响应式架构 |
| **工程构建** | Vite 7.1 + Vitest 3.2 | 毫秒级冷启动与极速模块热替换，极速单测环境 |
| **UI 组件库** | Ant Design Vue 4.2 | 深度定制现代化扁平与 Bento 2.0 视觉规范 |
| **状态管理** | Pinia 3.0 | 模块化响应式 Store（User、Conversation、App） |
| **桌面运行时** | Electron 39.1 + electron-builder | 跨平台桌面客户端开发与发布套件 |
| **后端框架** | NestJS 11.0 + Express | 模块化架构、依赖注入、中间件与管道拦截器 |
| **数据库/ORM** | PostgreSQL 8.16 + TypeORM 0.3 | 关系型持久化存储，自动化迁移（Migration）支持 |
| **高速缓存** | Redis 5.11 | 验证码、流式限流、探活缓存与用户会话缓存 |
| **多模态/大模型** | Grok2API / OpenAI SDK | 统一适配器兼容各种模型对话与图片生成接口 |

---

## 📂 项目工程目录

```text
AI-Chat-Project/
├── .github/workflows/         # GitHub Actions 持续集成自动化工作流
│   ├── backend-ci.yml         # 后端构建与 Jest 测试 CI
│   └── frontend-ci.yml        # 前端类型检查与 Vitest CI
├── aiChatFront/               # 前端与 Electron 桌面端工程
│   ├── src/
│   │   ├── api/               # 后端接口封装（Axios 请求体系）
│   │   ├── assets/            # 全局样式与静态图标资源
│   │   ├── components/        # 全局通用组件（导航栏、通用卡片等）
│   │   ├── hooks/             # 核心组合式函数（useScrollManager、useInfiniteScroll 等）
│   │   ├── interface/         # 前端 TypeScript 类型定义契约
│   │   ├── stores/            # Pinia 全局状态（auth、conversation 等）
│   │   ├── utils/             # Markdown 解析、流式解码与校验工具
│   │   └── views/             # 核心业务页面（Chat 聊天、Image 生图、Account 个人中心）
│   ├── electron/              # Electron 主进程与预加载脚本配置
│   ├── vite.config.ts         # Web 模式 Vite 配置
│   └── vite.config.electron.ts# Electron 模式构建配置
├── aiChatNode/                # NestJS 企业级后端服务工程
│   ├── src/
│   │   ├── common/            # 全局过滤器、守卫、拦截器、Redis 服务及数据种子 Seeder
│   │   ├── database/          # TypeORM 数据源及数据库迁移文件
│   │   ├── modules/           # 核心业务模块
│   │   │   ├── ai-provider/   # AI 供应商与可用模型管理
│   │   │   ├── auth/          # 用户登录、注册、验证码与 JWT 鉴权
│   │   │   ├── chat/          # 对话会话、消息流式转发与计费
│   │   │   ├── credits/       # 积分账本与流水核销
│   │   │   ├── files/         # 附件上传、格式验证与本地存储
│   │   │   ├── images/        # Grok 生图任务下发、轮询与资源下载
│   │   │   └── user/          # 用户角色、资料与个人账户接口
│   │   └── main.ts            # NestJS 应用入口与 Swagger 初始化
│   └── .env.example           # 后端环境变量模板
├── package.json               # 根目录并发调度脚本配置
└── README.md                  # 项目详细说明文档
```

---

## 🚀 快速上手

### 1. 环境准备

确保本地已安装以下环境：
- **Node.js**：`^20.19.0` 或 `>=22.12.0`
- **PostgreSQL**：`>= 14`（默认端口 5432）
- **Redis**：`>= 6`（默认端口 6379）

> [!TIP]
> 可使用 Docker 快速拉起本地基础依赖：
> ```bash
> # 启动 Redis
> docker run -d --name aichat-redis -p 6379:6379 redis:latest
> 
> # 启动 PostgreSQL
> docker run -d --name aichat-postgres -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=postgres postgres:latest
> ```

---

### 2. 一键安装依赖

在仓库根目录下执行：

```bash
npm run setup
```
该命令会自动递归为 `aiChatNode`（后端）与 `aiChatFront`（前端）安装完整的生产与开发依赖。

---

### 3. 配置后端环境变量

进入 `aiChatNode` 目录并复制配置模板：

```bash
cd aiChatNode
cp .env.example .env
```

打开 `.env` 检查并配置核心字段：

```env
# 基础服务
PORT=3000
NODE_ENV=development

# 数据库配置 (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=postgres
DB_SYNCHRONIZE=true

# 缓存配置 (Redis)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_DB=0

# JWT 鉴权密钥（至少 32 位的长字符串）
JWT_SECRET=your-secure-random-jwt-secret-key-at-least-32-chars

# 上游模型服务（如 Grok2API 或 OpenAI 兼容代理）
GROK2API_BASE_URL=http://127.0.0.1:18000/v1
GROK2API_API_KEY=your-grok2api-key
DEFAULT_IMAGE_MODEL=grok-imagine-image-2.0
```

---

### 4. 运行服务

根目录下提供了统一的并发启动命令：

#### 方案 A：Web 全栈开发模式（同时启动前端与后端）
```bash
npm run dev
```
- 后端服务：`http://localhost:3000`
- Swagger 文档：`http://localhost:3000/api-docs`
- 前端 Web 访问地址：`http://localhost:5173`

#### 方案 B：Electron 桌面端开发模式
```bash
npm run dev:electron
```
该命令将同时启动 NestJS 后端并唤起原生 Electron 桌面窗口。

#### 方案 C：分端独立启动
```bash
# 仅启动后端
npm run dev:backend

# 仅启动前端 Web
npm run dev:frontend
```

---

## 🧪 自动化测试与质量检验

本项目严格贯彻高标准工程规范，具备完善的静态检查与双端自动化测试套件：

### 前端质量检查
```bash
# TypeScript 严格类型检查 (0 报错)
npm --prefix aiChatFront run type-check

# 运行全量 Vitest 单元与集成测试 (16 套件，51 用例全部通过)
npm --prefix aiChatFront test
```

### 后端质量检查
```bash
# NestJS 编译构建验证
npm --prefix aiChatNode run build

# 运行全量 Jest 测试套件 (14 套件，61 用例全部通过)
npm --prefix aiChatNode test
```

### 健康探活检查
后端启动后，可直接通过浏览器或 curl 检查系统各组件连接健康状态：
- 全局综合健康：`http://localhost:3000/health`
- 数据库连接探活：`http://localhost:3000/health/database`
- Redis 状态检测：`http://localhost:3000/health/redis`
- AI 供应商探活：`http://localhost:3000/health/providers`

---

## 📦 桌面端客户端打包构建

项目内置 `electron-builder`，可在前端目录下直接打包全平台可执行分发包：

```bash
# 进入前端目录
cd aiChatFront

# 打包 Windows 安装包 (.exe)
npm run build:win

# 打包 macOS 镜像 (.dmg / .zip)
npm run build:mac

# 打包 Linux 安装包 (.AppImage / .deb)
npm run build:linux
```
生成的安装包将自动输出至 `aiChatFront/dist-electron/` 目录下。

---

## 📄 开源许可证

本项目遵循 [MIT License](LICENSE) 开源协议。
