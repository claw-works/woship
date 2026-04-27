# 🚢 Woship

> **Enterprise Internal Software DLC Platform**
> 从想法到部署，全链条自助服务平台

---

## 快速启动（本地开发）

```bash
# 1. 启动数据库
docker compose up -d postgres

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

## Docker 部署

前后端打包在同一个镜像中，镜像通过 GitHub Actions 自动构建并推送到 GHCR。

### 镜像地址

```
ghcr.io/claw-works/woship:latest
```

### 发布新版本

```bash
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions 自动构建并推送，生成 tag：`0.1.0`、`0.1`、`latest`。

### 直接运行

```bash
docker run -d --name woship \
  -p 8080:8080 \
  -e DB_HOST=your-db-host \
  -e DB_PORT=5432 \
  -e DB_USER=woship \
  -e DB_PASSWORD=your-password \
  -e DB_NAME=woship \
  -e DB_SSLMODE=disable \
  -e JWT_SECRET=your-jwt-secret \
  -e VPC_ID=vpc-xxx \
  -e SUBNET_IDS=subnet-aaa,subnet-bbb \
  -e TF_STATE_BUCKET=your-tf-state-bucket \
  -e TF_STATE_REGION=us-east-1 \
  ghcr.io/claw-works/woship:latest
```

打开 `http://localhost:8080` 即可访问（前端 + API 同端口）。

### 使用 docker compose

```yaml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: woship
      POSTGRES_PASSWORD: woship
      POSTGRES_DB: woship
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  woship:
    image: ghcr.io/claw-works/woship:latest
    ports:
      - "8080:8080"
    environment:
      DB_HOST: postgres
      DB_PORT: "5432"
      DB_USER: woship
      DB_PASSWORD: woship
      DB_NAME: woship
      DB_SSLMODE: disable
      JWT_SECRET: change-this-secret
      VPC_ID: vpc-xxx
      SUBNET_IDS: subnet-aaa,subnet-bbb
      TF_STATE_BUCKET: your-tf-state-bucket
      TF_STATE_REGION: us-east-1
    depends_on:
      - postgres

volumes:
  postgres_data:
```

### 环境变量

| 变量 | 必填 | 说明 |
|------|:---:|------|
| `DB_HOST` | ✅ | PostgreSQL 地址 |
| `DB_PORT` | | 默认 5432 |
| `DB_USER` | ✅ | 数据库用户 |
| `DB_PASSWORD` | ✅ | 数据库密码 |
| `DB_NAME` | ✅ | 数据库名 |
| `DB_SSLMODE` | | 默认 disable |
| `JWT_SECRET` | ✅ | JWT 签名密钥 |
| `PORT` | | 服务端口，默认 8080 |
| `VPC_ID` | ✅ | AWS VPC ID |
| `SUBNET_IDS` | ✅ | 私有子网 ID（逗号分隔） |
| `ALLOWED_CIDR` | | 安全组入站 CIDR，默认 10.0.0.0/8 |
| `TF_STATE_BUCKET` | | S3 bucket 存 terraform state（不设则用本地） |
| `TF_STATE_REGION` | | S3 bucket region，默认 us-east-1 |
| `EKS_CLUSTER_NAME` | | EKS 集群名（docker_deploy 工单需要） |
| `ROUTE53_ZONE_DOMAIN` | | Route53 域名（如 example.com） |
| `WEB_ROOT` | | 前端静态文件目录，默认 public |

---

## 部署到 EKS

### 前置条件

| 资源 | 说明 |
|------|------|
| EKS 集群 | 已创建，kubectl 可连接 |
| RDS PostgreSQL | 后端数据库（建议在同 VPC 私有子网） |
| S3 Bucket | 存 terraform state |
| Route53 Hosted Zone | 可选，用于 docker_deploy 工单的域名绑定 |

### 1. 创建 IRSA Role

Woship 后端 Pod 需要 AWS 权限来操作 RDS/ElastiCache/DocumentDB/Route53/EC2 等资源。通过 IRSA（IAM Roles for Service Accounts）实现零密钥管理。

```bash
# 创建 OIDC provider（如果还没有）
eksctl utils associate-iam-oidc-provider --cluster woship-cluster --approve

# 创建 IRSA role
eksctl create iamserviceaccount \
  --cluster woship-cluster \
  --namespace woship \
  --name woship-backend \
  --attach-policy-arn arn:aws:iam::aws:policy/AmazonRDSFullAccess \
  --attach-policy-arn arn:aws:iam::aws:policy/AmazonElastiCacheFullAccess \
  --attach-policy-arn arn:aws:iam::aws:policy/AmazonDocDBFullAccess \
  --attach-policy-arn arn:aws:iam::aws:policy/AmazonRoute53FullAccess \
  --attach-policy-arn arn:aws:iam::aws:policy/AmazonEC2ReadOnlyAccess \
  --attach-policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess \
  --attach-policy-arn arn:aws:iam::aws:policy/AmazonEKSClusterPolicy \
  --approve --override-existing-serviceaccounts
```

> 生产环境建议用最小权限的自定义 Policy 替代 FullAccess。

创建完成后，更新 `deploy/k8s/rbac.yaml` 中的 IRSA role ARN：

```yaml
annotations:
  eks.amazonaws.com/role-arn: arn:aws:iam::<ACCOUNT_ID>:role/<ROLE_NAME>
```

### 2. 推送镜像

镜像通过 GitHub Actions 自动构建推送到 GHCR（`ghcr.io/claw-works/woship`），打 tag 即触发：

```bash
git tag v0.1.0
git push origin v0.1.0
```

如果 EKS 节点无法拉取 GHCR，可以推到 ECR：

```bash
# 登录 ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com

# 构建并推送
docker build -f backend/Dockerfile -t <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/woship:latest .
docker push <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/woship:latest
```

然后修改 `deploy/k8s/deployment.yaml` 中的 `image` 字段。

### 3. 创建 Secrets

```bash
kubectl create namespace woship

kubectl create secret generic woship-backend-secrets -n woship \
  --from-literal=DB_HOST=<rds-endpoint> \
  --from-literal=DB_PORT=5432 \
  --from-literal=DB_USER=woship \
  --from-literal=DB_PASSWORD=<password> \
  --from-literal=DB_NAME=woship \
  --from-literal=DB_SSLMODE=require \
  --from-literal=JWT_SECRET=$(openssl rand -hex 32)
```

### 4. 部署

```bash
# RBAC + ServiceAccount
kubectl apply -f deploy/k8s/rbac.yaml

# Deployment + Service
kubectl apply -f deploy/k8s/deployment.yaml
```

`deployment.yaml` 中的环境变量需要根据实际基础设施修改：

| 变量 | 示例值 | 说明 |
|------|--------|------|
| `EKS_CLUSTER_NAME` | `woship-cluster` | 当前 EKS 集群名 |
| `VPC_ID` | `vpc-08cc4493...` | VPC ID |
| `SUBNET_IDS` | `subnet-04d0...,subnet-06d2...` | 私有子网（逗号分隔） |
| `TF_STATE_BUCKET` | `woship-tf-state-xxx` | S3 bucket |
| `ROUTE53_ZONE_DOMAIN` | `example.com` | Route53 托管域名 |

### 5. 验证

```bash
# Pod 状态
kubectl get pods -n woship

# 日志
kubectl logs -n woship -l app=woship-backend --tail=20

# 获取 LoadBalancer 地址
kubectl get svc -n woship woship-backend -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

打开 LoadBalancer 地址即可访问，默认账号 `admin@woship.local` / `admin123`。

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
├── deploy/k8s/              # K8s 部署清单
└── .github/workflows/       # CI/CD
```
