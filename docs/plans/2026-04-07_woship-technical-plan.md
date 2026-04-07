# Woship 技术方案 v0.1

> 企业内部软件 DLC 平台 — 从想法到部署，全链条自助服务

**状态：** 规划中  
**日期：** 2026-04-07  
**作者：** cloudbeer + 猪猪

---

## 一、项目目标

Woship 是一个企业内部自助服务平台，让业务/产品/开发人员无需依赖 IT 排期，自助完成资源申请、软件开发、测试和生产部署。

**核心价值：**
- 业务部门：填工单申请基础设施，审批通过自动部署
- 产品部门：描述想法 → AI 生成代码 → 实时预览 → 一键上线
- 运维团队：统一管理所有部署，审批流可控，资源清晰

---

## 二、三阶段规划

### Phase 1：工单驱动的资源部署 ← 当前重点

**目标：** 用户提交工单 → 人工审批 → 自动完成 EKS 部署 + 域名绑定

**核心功能：**
- 用户注册/登录（Woship 自带账号系统，预留 SSO 对接口）
- 工单系统（可扩展类型，Phase 1 只实现"Docker 部署"类型）
- 审批流（有审批权限的用户可审核/拒绝工单）
- Cloud Provider 抽象层（先实现 AWS，预留其他云接入）
- 自动执行：EKS Deployment + Service + Ingress + Route53

**工单类型（可扩展）：**
```
TicketType interface
  ├── DockerDeployTicket    ← Phase 1 实现
  ├── DevDeployTicket       ← Phase 2 实现
  └── ...（后续扩展）
```

---

### Phase 2：从想法到软件

**目标：** 用户描述需求 → AI 生成代码 → 云端热加载预览

**核心功能：**
- AI 代码生成（对接 Claude Code / Hermes Agent）
- 代码托管（GitHub / GitLab）
- 云端开发环境（EKS Pod + 文件同步 + 热重载）
- 临时预览域名（自动分配子域名）
- 新增工单类型：DevDeployTicket

---

### Phase 3：全链条闭环

**目标：** 想法 → 开发 → 测试 → 生产，一站完成

**核心功能：**
- Phase 1 + Phase 2 能力整合
- Demo 环境一键晋升生产环境
- 完整环境管理（dev / staging / prod）
- 监控、日志、回滚

---

## 三、系统架构

```
┌─────────────────────────────────────────────────────┐
│                    前端 (Vite + React)                │
│         工单提交 / 审批管理 / 部署状态 / 开发预览       │
└──────────────────────┬──────────────────────────────┘
                       │ REST API / WebSocket
┌──────────────────────▼──────────────────────────────┐
│                   后端 (Go)                           │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │  用户/权限   │  │   工单系统    │  │  任务执行引擎 │ │
│  │  Auth/RBAC  │  │  Ticket CRUD │  │  Job Runner  │ │
│  └─────────────┘  └──────────────┘  └──────┬──────┘ │
│                                             │        │
│  ┌──────────────────────────────────────────▼──────┐ │
│  │           Cloud Provider 抽象层                  │ │
│  │  CloudProvider interface {                       │ │
│  │    DeployApp(spec) error                         │ │
│  │    BindDomain(domain) error                      │ │
│  │    DeleteApp(name) error                         │ │
│  │    GetStatus(name) AppStatus                     │ │
│  │  }                                               │ │
│  │  ┌──────────────┐   ┌──────────────┐            │ │
│  │  │  AWS Provider │   │  未来其他云  │            │ │
│  │  │  EKS + R53    │   │  GCP / 阿里  │            │ │
│  │  └──────────────┘   └──────────────┘            │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                  数据层 (PostgreSQL)                  │
│     users / tickets / deployments / providers        │
└─────────────────────────────────────────────────────┘
```

---

## 四、技术选型

| 模块 | 技术 | 说明 |
|------|------|------|
| 前端 | Vite + React | UI 设计待定 |
| 后端 | Go | 高性能，适合 infra 类工具 |
| 数据库 | PostgreSQL | 主数据存储 |
| 容器编排 | AWS EKS | 外部 Infra Provider，不在项目内 |
| 域名管理 | AWS Route53 | 通过 AWS Provider 统一管理 |
| 代码托管 | GitHub / GitLab | Phase 2 |
| AI 代码生成 | Claude Code / Hermes Agent | Phase 2 |
| 认证 | JWT（预留 OAuth2 / SSO 接口）| 自带简单账号系统 |

---

## 五、数据模型（初版）

### users
```sql
id            uuid PRIMARY KEY
email         varchar UNIQUE NOT NULL
password_hash varchar NOT NULL
name          varchar
role          varchar  -- admin, approver, user
created_at    timestamp
```

### tickets
```sql
id          uuid PRIMARY KEY
type        varchar     -- docker_deploy, dev_deploy, ...
title       varchar
status      varchar     -- draft, pending, approved, rejected, deploying, done, failed
payload     jsonb       -- 不同类型工单的具体参数
created_by  uuid → users.id
reviewed_by uuid → users.id
created_at  timestamp
updated_at  timestamp
```

### deployments
```sql
id          uuid PRIMARY KEY
ticket_id   uuid → tickets.id
provider    varchar     -- aws, gcp, ...
region      varchar
namespace   varchar
app_name    varchar
image       varchar
domain      varchar
status      varchar     -- pending, running, stopped, failed
created_at  timestamp
updated_at  timestamp
```

### providers
```sql
id          uuid PRIMARY KEY
name        varchar     -- aws-prod, aws-staging, ...
type        varchar     -- aws, gcp, aliyun
config      jsonb       -- region, cluster_name, hosted_zone_id, ...
enabled     bool
created_at  timestamp
```

---

## 六、Phase 1 详细功能拆解

### 6.1 用户与权限
- 注册 / 登录（JWT）
- 角色：`admin`（全部权限）、`approver`（可审批）、`user`（提工单）
- 预留：OAuth2 / SSO 扩展点

### 6.2 工单流程
```
用户填写工单（Docker镜像 + 域名 + 描述）
    ↓
工单状态: draft → pending（提交审批）
    ↓
审批人收到通知（站内 + 可选邮件/飞书）
    ↓
审批通过 → status: approved → 触发执行任务
审批拒绝 → status: rejected（附拒绝原因）
    ↓
执行引擎 → 调用 AWS Provider
    ↓
创建 EKS Deployment + Service + Ingress
配置 Route53 A/CNAME 记录
    ↓
状态更新 → done / failed（附错误信息）
```

### 6.3 Docker 部署工单参数（payload）
```json
{
  "image": "registry.example.com/myapp:v1.2.3",
  "port": 8080,
  "domain": "myapp.internal.example.com",
  "replicas": 2,
  "env": {
    "ENV": "production",
    "DB_URL": "..."
  },
  "resources": {
    "cpu": "500m",
    "memory": "512Mi"
  },
  "provider_id": "uuid-of-aws-provider"
}
```

### 6.4 AWS Provider 实现
- 使用 AWS SDK for Go v2
- EKS：通过 Kubernetes client-go 创建/更新/删除资源
- Route53：创建/更新 DNS 记录
- 权限：IAM Role / Access Key 配置在 providers 表的 config 字段

---

## 七、API 设计（Phase 1 初版）

### 认证
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
```

### 用户
```
GET  /api/users/me
PUT  /api/users/me
```

### 工单
```
GET    /api/tickets              # 列表（支持过滤）
POST   /api/tickets              # 创建工单
GET    /api/tickets/:id          # 工单详情
PUT    /api/tickets/:id/submit   # 提交审批
PUT    /api/tickets/:id/approve  # 审批通过（approver/admin）
PUT    /api/tickets/:id/reject   # 审批拒绝（附原因）
GET    /api/tickets/:id/logs     # 执行日志（实时 SSE）
```

### 部署
```
GET    /api/deployments          # 部署列表
GET    /api/deployments/:id      # 部署详情
DELETE /api/deployments/:id      # 下线
```

### Cloud Provider（admin）
```
GET    /api/providers
POST   /api/providers
PUT    /api/providers/:id
DELETE /api/providers/:id
GET    /api/providers/:id/test   # 测试连通性
```

---

## 八、项目目录结构（后端）

```
woship/
├── cmd/
│   └── server/
│       └── main.go
├── internal/
│   ├── api/
│   │   ├── handler/         # HTTP handlers
│   │   ├── middleware/      # Auth, RBAC, logging
│   │   └── router.go
│   ├── model/               # DB 模型
│   ├── service/             # 业务逻辑
│   ├── repo/                # 数据库操作
│   ├── provider/            # Cloud Provider 抽象
│   │   ├── interface.go     # CloudProvider interface
│   │   └── aws/             # AWS 实现
│   │       ├── eks.go
│   │       └── route53.go
│   └── worker/              # 任务执行引擎
│       ├── runner.go
│       └── jobs/
│           └── docker_deploy.go
├── migrations/              # SQL 迁移文件
├── frontend/                # Vite + React
├── docker-compose.yml       # 本地开发
├── Dockerfile
└── README.md
```

---

## 九、开放问题

- [ ] 前端 UI 设计（啤酒云负责）
- [ ] 审批通知方式：站内信 + 邮件？或对接飞书？
- [ ] AWS Provider 的认证方式：IAM Role（推荐）还是 Access Key？
- [ ] 本地开发环境：mock AWS Provider，还是直接用真实 AWS？
- [ ] 执行日志是存 DB 还是直接 stream？（建议 SSE 实时 + DB 持久化）
- [ ] 工单的 payload 校验：每种类型单独 JSON Schema 验证

---

## 十、下一步

1. ✅ 确认技术方案（本文档）
2. ⬜ 前端 UI 设计
3. ⬜ 用 `writing-plans` 出 Phase 1 详细开发计划
4. ⬜ 搭建项目骨架（Go + PostgreSQL + Vite）
5. ⬜ 实现用户/认证模块
6. ⬜ 实现工单系统核心
7. ⬜ 实现 AWS Provider
8. ⬜ 端到端联调
