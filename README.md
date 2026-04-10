# 🚢 Woship

> **Enterprise Internal Software DLC Platform**  
> 从想法到部署，全链条自助服务平台

---

## 是什么？

Woship 是一个企业内部软件自助服务平台。业务部门申请基础设施、产品部门把想法直接变成可运行的 Demo，全部通过 Woship 完成——无需等待 IT 排期，无需手动配置服务器。

---

## 三阶段规划

### 第一阶段：工单驱动的资源部署

> **核心：填工单 → 自动部署**

用户通过工单系统申请资源，平台自动完成 EKS 部署 + 域名绑定。

**功能：**
- 内建工单系统（后续可对接 Jira 等）
- 用户填写 Docker 镜像地址 + 域名需求
- 自动创建 EKS Deployment / Service / Ingress
- AWS Route53 自动绑定域名
- 工单审批流程（申请 → 审批 → 自动部署）

**基础设施：**
- AWS EKS（Kubernetes）
- AWS Route53
- 后续可扩展至其他云

---

### 第二阶段：从想法到软件

> **核心：描述需求 → AI 生成代码 → 实时预览**

- AI 辅助代码生成（对接 Claude Code / Hermes Agent 等）
- 代码托管：GitHub / GitLab
- 云端开发环境（EKS Pod 内热加载）
- 实时预览：临时域名 + 热重载（nodemon / vite / air 等）
- 代码变更自动同步到 Pod

---

### 第三阶段：全链条闭环

> **核心：想法 → 开发 → 测试 → 上线，一站完成**

- 第一、二阶段能力整合
- 从 Demo 一键晋升到生产环境
- 完整的环境管理（dev / staging / prod）
- 监控、日志、回滚

---

## 目标用户

| 角色 | 使用场景 |
|------|---------|
| 业务部门 | 申请基础设施资源，无需找 IT |
| 产品经理 | 把想法变成可交互 Demo |
| 开发团队 | 快速启动项目，省去环境配置 |
| 运维团队 | 统一管理所有部署，审批流可控 |

---

## 技术选型（初步）

| 模块 | 技术 |
|------|------|
| 前端 | TBD |
| 后端 | TBD |
| 容器编排 | AWS EKS (Kubernetes) |
| 域名管理 | AWS Route53 |
| 代码托管 | GitHub / GitLab |
| AI 代码生成 | Claude Code / Hermes Agent |
| 工单系统 | 自研（后续对接 Jira） |

---

## 快速启动

```bash
# 1. 启动数据库 + 后端
docker compose up -d

# 2. 初始化管理员账号
cd backend
cp .env.example .env
go run ./cmd/seed

# 3. 启动前端
cd ../frontend
npm install
npm run dev
```

打开 `http://localhost:5173`，使用以下账号登录：

| 邮箱 | 密码 | 角色 |
|------|------|------|
| `admin@woship.local` | `admin123` | 管理员 |

> seed 脚本位于 `backend/cmd/seed/main.go`，可自行修改或新增用户。

---

## 项目状态

🟡 **规划阶段** — 需求讨论中

---

*Woship = 窝 + Ship（发布）。我们的窝，我们发布。*
