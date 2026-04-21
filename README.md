# 🚢 Woship

> **Enterprise Internal Software DLC Platform**
> 从想法到部署，全链条自助服务平台

---

## 快速启动（本地开发）

```bash
# 1. 启动数据库 + 后端
docker compose up -d

# 2. 配置环境变量
cd backend
cp .env.example .env
# 编辑 .env 填入 VPC_ID, SUBNET_IDS 等

# 3. 启动后端
go run ./cmd/server

# 4. 启动前端
cd ../frontend
npm install
npm run dev
```

打开 `http://localhost:5173`，使用 `admin@woship.local` / `admin123` 登录。

---

## 部署到 EKS

### 前置条件

| 资源 | 说明 |
|------|------|
| EKS 集群 | 已创建，kubectl 可连接 |
| ECR 仓库 | `320236118172.dkr.ecr.us-east-1.amazonaws.com/woship/backend` |
| S3 Bucket | `woship-tf-state-320236118172`（存 terraform state） |
| RDS PostgreSQL | 后端数据库 |
| IRSA Role | `woship-backend-irsa`（Pod 的 AWS 权限） |

### 1. 构建并推送镜像

```bash
cd backend

# 登录 ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 320236118172.dkr.ecr.us-east-1.amazonaws.com

# 构建并推送
docker build --platform linux/amd64 -t woship-backend .
docker tag woship-backend:latest 320236118172.dkr.ecr.us-east-1.amazonaws.com/woship/backend:latest
docker push 320236118172.dkr.ecr.us-east-1.amazonaws.com/woship/backend:latest
```

### 2. 部署 K8s 资源

```bash
# RBAC + ServiceAccount（含 IRSA 注解）
kubectl apply -f deploy/k8s/rbac.yaml

# 创建 Secrets（修改实际值）
cp deploy/k8s/secrets.yaml.example deploy/k8s/secrets.yaml
# 编辑 secrets.yaml 填入 DB_HOST, DB_PASSWORD, JWT_SECRET
kubectl apply -f deploy/k8s/secrets.yaml

# 部署后端
kubectl apply -f deploy/k8s/deployment.yaml
```

### 3. 验证

```bash
kubectl get pods -n woship
kubectl logs -n woship -l app=woship-backend --tail=20
```

---

## 架构

```
用户 → 前端 → 后端 API → Worker (async)
                              ↓
                         Terraform (tofu)
                              ↓
                    ┌─────────┼─────────┐
                    RDS    ElastiCache  DocumentDB
                 (PG/MySQL)  (Redis)   (MongoDB)
                              ↓
                         K8s Deploy
                         + Route53 DNS
```

### 工单生命周期

```
draft → pending → approved → deploying → done
                     ↓                     ↓
                  rejected              failed
                                          ↓
                                    done → destroying → stopped
```

### 关键设计

| 模块 | 说明 |
|------|------|
| **Terraform State** | S3 backend，每个工单独立 key，无需 DynamoDB 锁 |
| **Provider 缓存** | Docker 镜像内 filesystem_mirror，init 不联网 |
| **K8s 认证** | Pod 内 in-cluster 模式，自动使用 ServiceAccount token |
| **AWS 认证** | IRSA，Pod 自动获取 IAM 临时凭证，零密钥管理 |
| **日志流** | SSE 实时推送 terraform 输出到前端 |

---

## 支持的资源类型

| 工单类型 | 数据库 | AWS 服务 |
|---------|--------|---------|
| db_request | PostgreSQL | RDS |
| db_request | MySQL | RDS |
| db_request | Redis | ElastiCache |
| db_request | MongoDB | DocumentDB |
| docker_deploy | - | EKS + Route53 |

---

## 技术栈

| 模块 | 技术 |
|------|------|
| 前端 | React + TypeScript + Vite + TailwindCSS |
| 后端 | Go + Echo + sqlx |
| IaC | OpenTofu (Terraform) |
| 容器编排 | AWS EKS (Kubernetes) |
| 域名管理 | AWS Route53 |
| 数据库 | PostgreSQL (后端) + RDS/ElastiCache/DocumentDB (用户资源) |

---

## 项目结构

```
├── backend/
│   ├── cmd/server/          # 入口
│   ├── internal/
│   │   ├── api/             # HTTP handlers + middleware
│   │   ├── service/         # 业务逻辑
│   │   ├── repo/            # 数据库操作
│   │   ├── worker/          # 异步任务执行
│   │   ├── terraform/       # tofu CLI 封装
│   │   └── model/           # 数据模型
│   ├── terraform/templates/ # IaC 模板 (db_request, docker_deploy)
│   └── migrations/          # 数据库迁移
├── frontend/src/
│   ├── pages/               # 页面组件
│   ├── api/                 # API 客户端
│   └── components/          # 通用组件
└── deploy/k8s/              # K8s 部署清单
```
