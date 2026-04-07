# Woship Phase 1 Implementation Plan

> **For Hermes:** Use `subagent-driven-development` skill to implement this plan task-by-task.

**Goal:** 实现"填工单 → 人工审批 → 自动 EKS 部署 + Route53 域名绑定"完整闭环

**Architecture:** Go 后端提供 REST API，PostgreSQL 存储数据，Vite+React 前端，Cloud Provider 接口抽象后端 AWS 实现。工单审批通过后由 Worker goroutine 异步执行部署，执行日志通过 SSE 实时推送前端。

**Tech Stack:** Go 1.22, Echo v4, sqlx + PostgreSQL, JWT, AWS SDK Go v2, client-go, Vite + React + TypeScript, TailwindCSS

---

## 模块划分

```
M1: 项目骨架 & 本地开发环境       (Tasks 1-4)
M2: 用户认证 & RBAC              (Tasks 5-11)
M3: 工单系统核心                  (Tasks 12-20)
M4: Cloud Provider 抽象 & Mock   (Tasks 21-25)
M5: AWS Provider 实现            (Tasks 26-32)
M6: 任务执行引擎                  (Tasks 33-38)
M7: 前端基础框架                  (Tasks 39-43)
M8: 前端工单 UI                  (Tasks 44-50)
M9: 集成测试 & 部署               (Tasks 51-54)
```

---

## M1: 项目骨架 & 本地开发环境

### Task 1: 初始化 Go 模块和目录结构

**Objective:** 建立后端项目骨架，所有目录和 go.mod 就位

**Files:**
- Create: `backend/go.mod`
- Create: `backend/cmd/server/main.go`
- Create: `backend/internal/api/router.go`
- Create: `backend/internal/api/handler/.gitkeep`
- Create: `backend/internal/api/middleware/.gitkeep`
- Create: `backend/internal/model/.gitkeep`
- Create: `backend/internal/service/.gitkeep`
- Create: `backend/internal/repo/.gitkeep`
- Create: `backend/internal/provider/interface.go`
- Create: `backend/internal/provider/mock/mock.go`
- Create: `backend/internal/provider/aws/.gitkeep`
- Create: `backend/internal/worker/runner.go`
- Create: `backend/internal/worker/jobs/.gitkeep`

**Step 1: 初始化 Go 模块**

```bash
cd backend
go mod init github.com/claw-works/woship
```

**Step 2: 安装核心依赖**

```bash
go get github.com/labstack/echo/v4@latest
go get github.com/labstack/echo-jwt/v4@latest
go get github.com/golang-jwt/jwt/v5@latest
go get github.com/jmoiron/sqlx@latest
go get github.com/lib/pq@latest
go get github.com/google/uuid@latest
go get golang.org/x/crypto@latest
go get github.com/joho/godotenv@latest
```

**Step 3: 写 main.go 最小可运行版本**

```go
// backend/cmd/server/main.go
package main

import (
	"log"
	"github.com/claw-works/woship/internal/api"
)

func main() {
	srv := api.NewServer()
	log.Fatal(srv.Start(":8080"))
}
```

**Step 4: 写最小 router.go**

```go
// backend/internal/api/router.go
package api

import "github.com/labstack/echo/v4"

type Server struct {
	e *echo.Echo
}

func NewServer() *Server {
	e := echo.New()
	e.GET("/health", func(c echo.Context) error {
		return c.JSON(200, map[string]string{"status": "ok"})
	})
	return &Server{e: e}
}

func (s *Server) Start(addr string) error {
	return s.e.Start(addr)
}
```

**Step 5: 验证能跑起来**

```bash
cd backend && go run ./cmd/server/
# 另一个终端
curl http://localhost:8080/health
# 期望: {"status":"ok"}
```

**Step 6: Commit**

```bash
git add backend/
git commit -m "feat: initialize Go backend skeleton"
```

---

### Task 2: 数据库迁移框架 + 初始 schema

**Objective:** 建立迁移机制，创建 users/tickets/deployments/providers 四张表

**Files:**
- Create: `backend/migrations/001_initial_schema.sql`
- Create: `backend/internal/db/db.go`

**Step 1: 安装 migrate 工具**

```bash
go get -tool github.com/golang-migrate/migrate/v4/cmd/migrate
go get github.com/golang-migrate/migrate/v4/database/postgres@latest
go get github.com/golang-migrate/migrate/v4/source/file@latest
```

**Step 2: 写迁移文件**

```sql
-- backend/migrations/001_initial_schema.up.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name          VARCHAR(100),
    role          VARCHAR(20) NOT NULL DEFAULT 'user',  -- admin, approver, user
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE providers (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(100) NOT NULL,
    type       VARCHAR(50) NOT NULL,   -- aws, mock
    config     JSONB NOT NULL DEFAULT '{}',
    enabled    BOOL NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tickets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type        VARCHAR(50) NOT NULL,   -- docker_deploy
    title       VARCHAR(255) NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'draft',
    -- draft → pending → approved/rejected → deploying → done/failed
    payload     JSONB NOT NULL DEFAULT '{}',
    created_by  UUID NOT NULL REFERENCES users(id),
    reviewed_by UUID REFERENCES users(id),
    reject_reason VARCHAR(500),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE deployments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id   UUID NOT NULL REFERENCES tickets(id),
    provider_id UUID NOT NULL REFERENCES providers(id),
    namespace   VARCHAR(100) NOT NULL,
    app_name    VARCHAR(100) NOT NULL,
    image       VARCHAR(500) NOT NULL,
    domain      VARCHAR(255),
    status      VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- pending → running → stopped / failed
    logs        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 触发器：tickets.updated_at 自动更新
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tickets_updated_at
BEFORE UPDATE ON tickets
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_deployments_updated_at
BEFORE UPDATE ON deployments
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

```sql
-- backend/migrations/001_initial_schema.down.sql
DROP TABLE IF EXISTS deployments;
DROP TABLE IF EXISTS tickets;
DROP TABLE IF EXISTS providers;
DROP TABLE IF EXISTS users;
DROP FUNCTION IF EXISTS update_updated_at;
```

**Step 3: 写 db.go 数据库连接**

```go
// backend/internal/db/db.go
package db

import (
	"fmt"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

type Config struct {
	Host     string
	Port     int
	User     string
	Password string
	DBName   string
	SSLMode  string
}

func Connect(cfg Config) (*sqlx.DB, error) {
	dsn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.DBName, cfg.SSLMode,
	)
	return sqlx.Connect("postgres", dsn)
}
```

**Step 4: 跑迁移验证表创建成功**

```bash
# 确保 docker-compose postgres 在跑（Task 3 之后）
migrate -database "postgres://woship:woship@localhost:5432/woship?sslmode=disable" \
        -source "file://migrations" up
# psql 验证
psql -U woship -d woship -c "\dt"
# 期望: users, providers, tickets, deployments 四张表
```

**Step 5: Commit**

```bash
git add backend/migrations/ backend/internal/db/
git commit -m "feat: add database schema migrations"
```

---

### Task 3: Docker Compose 本地开发环境

**Objective:** 一条命令起 PostgreSQL + 后端，前端单独跑

**Files:**
- Create: `docker-compose.yml`
- Create: `backend/.env.example`
- Create: `backend/Dockerfile`

**Step 1: 写 docker-compose.yml**

```yaml
# docker-compose.yml
version: "3.9"
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: woship
      POSTGRES_PASSWORD: woship
      POSTGRES_DB: woship
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    build: ./backend
    ports:
      - "8080:8080"
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USER: woship
      DB_PASSWORD: woship
      DB_NAME: woship
      JWT_SECRET: dev-secret-change-in-prod
    depends_on:
      - postgres

volumes:
  pgdata:
```

**Step 2: 写 .env.example**

```
DB_HOST=localhost
DB_PORT=5432
DB_USER=woship
DB_PASSWORD=woship
DB_NAME=woship
JWT_SECRET=dev-secret-change-in-prod
```

**Step 3: 写 backend/Dockerfile**

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o server ./cmd/server/

FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/server .
COPY migrations/ migrations/
EXPOSE 8080
CMD ["./server"]
```

**Step 4: 验证**

```bash
docker compose up -d postgres
sleep 3
# 手动跑迁移
migrate -database "postgres://woship:woship@localhost:5432/woship?sslmode=disable" \
        -source "file://backend/migrations" up
```

**Step 5: Commit**

```bash
git add docker-compose.yml backend/.env.example backend/Dockerfile
git commit -m "chore: add docker-compose local dev environment"
```

---

### Task 4: 前端初始化 (Vite + React + TypeScript + TailwindCSS)

**Objective:** 初始化前端项目，配置好基础依赖

**Files:**
- Create: `frontend/` (Vite 初始化)

**Step 1: 初始化 Vite + React + TS**

```bash
cd /root/woship
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

**Step 2: 安装 UI 依赖**

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install react-router-dom axios @tanstack/react-query
npm install lucide-react
```

**Step 3: 配置 tailwind.config.js**

```js
// frontend/tailwind.config.js
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
}
```

**Step 4: 更新 src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 5: 配置 API proxy (vite.config.ts)**

```ts
// frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8080'
    }
  }
})
```

**Step 6: 验证前端能跑**

```bash
cd frontend && npm run dev
# 浏览器打开 http://localhost:5173，看到 Vite 默认页面
```

**Step 7: Commit**

```bash
git add frontend/
git commit -m "feat: initialize Vite+React+TS+Tailwind frontend"
```

---

## M2: 用户认证 & RBAC

### Task 5: User model & repo

**Objective:** 定义 User struct 和数据库 CRUD 操作

**Files:**
- Create: `backend/internal/model/user.go`
- Create: `backend/internal/repo/user_repo.go`
- Create: `backend/internal/repo/user_repo_test.go`

**Step 1: 写 User model**

```go
// backend/internal/model/user.go
package model

import "time"

type Role string

const (
	RoleAdmin    Role = "admin"
	RoleApprover Role = "approver"
	RoleUser     Role = "user"
)

type User struct {
	ID           string    `db:"id" json:"id"`
	Email        string    `db:"email" json:"email"`
	PasswordHash string    `db:"password_hash" json:"-"`
	Name         string    `db:"name" json:"name"`
	Role         Role      `db:"role" json:"role"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
}
```

**Step 2: 写 failing test**

```go
// backend/internal/repo/user_repo_test.go
//go:build integration

package repo_test

import (
	"testing"
	"github.com/claw-works/woship/internal/db"
	"github.com/claw-works/woship/internal/model"
	"github.com/claw-works/woship/internal/repo"
	"github.com/stretchr/testify/require"
)

func TestUserRepo_CreateAndGet(t *testing.T) {
	database := testDB(t)
	r := repo.NewUserRepo(database)

	user := &model.User{
		Email:        "test@example.com",
		PasswordHash: "hashed",
		Name:         "Test User",
		Role:         model.RoleUser,
	}
	err := r.Create(user)
	require.NoError(t, err)
	require.NotEmpty(t, user.ID)

	found, err := r.GetByEmail("test@example.com")
	require.NoError(t, err)
	require.Equal(t, user.ID, found.ID)
}
```

**Step 3: 实现 UserRepo**

```go
// backend/internal/repo/user_repo.go
package repo

import (
	"github.com/claw-works/woship/internal/model"
	"github.com/jmoiron/sqlx"
)

type UserRepo struct { db *sqlx.DB }

func NewUserRepo(db *sqlx.DB) *UserRepo { return &UserRepo{db: db} }

func (r *UserRepo) Create(u *model.User) error {
	query := `INSERT INTO users (email, password_hash, name, role)
	          VALUES (:email, :password_hash, :name, :role)
	          RETURNING id, created_at`
	rows, err := r.db.NamedQuery(query, u)
	if err != nil { return err }
	defer rows.Close()
	if rows.Next() { return rows.Scan(&u.ID, &u.CreatedAt) }
	return nil
}

func (r *UserRepo) GetByID(id string) (*model.User, error) {
	u := &model.User{}
	return u, r.db.Get(u, `SELECT * FROM users WHERE id=$1`, id)
}

func (r *UserRepo) GetByEmail(email string) (*model.User, error) {
	u := &model.User{}
	return u, r.db.Get(u, `SELECT * FROM users WHERE email=$1`, email)
}
```

**Step 4: Commit**

```bash
git add backend/internal/model/user.go backend/internal/repo/user_repo.go
git commit -m "feat: add User model and repo"
```

---

### Task 6: 密码工具 & 注册 Service

**Objective:** bcrypt 密码哈希，实现注册业务逻辑

**Files:**
- Create: `backend/internal/service/auth_service.go`
- Create: `backend/internal/service/auth_service_test.go`

**Step 1: 写 failing test**

```go
// backend/internal/service/auth_service_test.go
package service_test

import (
	"testing"
	"github.com/claw-works/woship/internal/service"
	"github.com/stretchr/testify/require"
)

func TestAuthService_Register_HashesPassword(t *testing.T) {
	// 用 mock repo
	mockRepo := &mockUserRepo{}
	svc := service.NewAuthService(mockRepo, "test-secret")

	user, err := svc.Register("alice@example.com", "plaintext123", "Alice")
	require.NoError(t, err)
	require.NotEqual(t, "plaintext123", user.PasswordHash)
	require.True(t, len(user.PasswordHash) > 20) // bcrypt hash
}

func TestAuthService_Login_ReturnsJWT(t *testing.T) {
	mockRepo := &mockUserRepo{}
	svc := service.NewAuthService(mockRepo, "test-secret")

	svc.Register("bob@example.com", "password", "Bob")
	token, err := svc.Login("bob@example.com", "password")
	require.NoError(t, err)
	require.NotEmpty(t, token)
}

func TestAuthService_Login_WrongPassword(t *testing.T) {
	mockRepo := &mockUserRepo{}
	svc := service.NewAuthService(mockRepo, "test-secret")
	svc.Register("carol@example.com", "correct", "Carol")

	_, err := svc.Login("carol@example.com", "wrong")
	require.ErrorIs(t, err, service.ErrInvalidCredentials)
}
```

**Step 2: 实现 AuthService**

```go
// backend/internal/service/auth_service.go
package service

import (
	"errors"
	"time"
	"github.com/claw-works/woship/internal/model"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var ErrInvalidCredentials = errors.New("invalid credentials")

type UserRepo interface {
	Create(u *model.User) error
	GetByEmail(email string) (*model.User, error)
	GetByID(id string) (*model.User, error)
}

type AuthService struct {
	repo      UserRepo
	jwtSecret string
}

func NewAuthService(repo UserRepo, jwtSecret string) *AuthService {
	return &AuthService{repo: repo, jwtSecret: jwtSecret}
}

func (s *AuthService) Register(email, password, name string) (*model.User, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil { return nil, err }
	u := &model.User{Email: email, PasswordHash: string(hash), Name: name, Role: model.RoleUser}
	return u, s.repo.Create(u)
}

func (s *AuthService) Login(email, password string) (string, error) {
	u, err := s.repo.GetByEmail(email)
	if err != nil { return "", ErrInvalidCredentials }
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)); err != nil {
		return "", ErrInvalidCredentials
	}
	return s.generateJWT(u)
}

func (s *AuthService) generateJWT(u *model.User) (string, error) {
	claims := jwt.MapClaims{
		"sub":  u.ID,
		"role": u.Role,
		"exp":  time.Now().Add(24 * time.Hour).Unix(),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(s.jwtSecret))
}
```

**Step 3: 运行 unit test**

```bash
cd backend && go test ./internal/service/... -v
# 期望: TestAuthService_Register_HashesPassword PASS
#       TestAuthService_Login_ReturnsJWT PASS
#       TestAuthService_Login_WrongPassword PASS
```

**Step 4: Commit**

```bash
git add backend/internal/service/auth_service.go backend/internal/service/auth_service_test.go
git commit -m "feat: add AuthService with bcrypt and JWT"
```

---

### Task 7: Auth HTTP Handler (POST /api/auth/register, /login)

**Objective:** 注册、登录接口上线

**Files:**
- Create: `backend/internal/api/handler/auth_handler.go`
- Modify: `backend/internal/api/router.go`

**Step 1: 写 auth handler**

```go
// backend/internal/api/handler/auth_handler.go
package handler

import (
	"net/http"
	"github.com/claw-works/woship/internal/service"
	"github.com/labstack/echo/v4"
)

type AuthHandler struct { svc *service.AuthService }

func NewAuthHandler(svc *service.AuthService) *AuthHandler {
	return &AuthHandler{svc: svc}
}

type registerReq struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=6"`
	Name     string `json:"name" validate:"required"`
}

func (h *AuthHandler) Register(c echo.Context) error {
	var req registerReq
	if err := c.Bind(&req); err != nil { return err }
	user, err := h.svc.Register(req.Email, req.Password, req.Name)
	if err != nil { return echo.NewHTTPError(http.StatusBadRequest, err.Error()) }
	return c.JSON(http.StatusCreated, user)
}

type loginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *AuthHandler) Login(c echo.Context) error {
	var req loginReq
	if err := c.Bind(&req); err != nil { return err }
	token, err := h.svc.Login(req.Email, req.Password)
	if err != nil { return echo.NewHTTPError(http.StatusUnauthorized, "invalid credentials") }
	return c.JSON(http.StatusOK, map[string]string{"token": token})
}
```

**Step 2: 注册路由**

在 `router.go` 中的 `NewServer()` 加入：
```go
auth := e.Group("/api/auth")
auth.POST("/register", authHandler.Register)
auth.POST("/login", authHandler.Login)
```

**Step 3: 手动验证**

```bash
# 注册
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"123456","name":"Admin"}'
# 期望: 201 返回 user 对象（无 password_hash）

# 登录
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"123456"}'
# 期望: {"token":"eyJ..."}
```

**Step 4: Commit**

```bash
git add backend/internal/api/handler/auth_handler.go backend/internal/api/router.go
git commit -m "feat: add /api/auth/register and /api/auth/login endpoints"
```

---

### Task 8: JWT 中间件 & GET /api/users/me

**Objective:** 受保护路由需要 Bearer token，返回当前用户信息

**Files:**
- Create: `backend/internal/api/middleware/auth.go`
- Create: `backend/internal/api/handler/user_handler.go`
- Modify: `backend/internal/api/router.go`

**Step 1: 写 JWT 中间件**

```go
// backend/internal/api/middleware/auth.go
package middleware

import (
	"github.com/golang-jwt/jwt/v5"
	echojwt "github.com/labstack/echo-jwt/v4"
	"github.com/labstack/echo/v4"
)

func JWTMiddleware(secret string) echo.MiddlewareFunc {
	return echojwt.WithConfig(echojwt.Config{
		SigningKey: []byte(secret),
	})
}

// 从 context 取 userID
func UserIDFromContext(c echo.Context) string {
	token := c.Get("user").(*jwt.Token)
	claims := token.Claims.(jwt.MapClaims)
	return claims["sub"].(string)
}

func RoleFromContext(c echo.Context) string {
	token := c.Get("user").(*jwt.Token)
	claims := token.Claims.(jwt.MapClaims)
	return claims["role"].(string)
}
```

**Step 2: 写 user handler**

```go
// backend/internal/api/handler/user_handler.go
package handler

import (
	"github.com/claw-works/woship/internal/api/middleware"
	"github.com/claw-works/woship/internal/repo"
	"github.com/labstack/echo/v4"
)

type UserHandler struct { repo *repo.UserRepo }

func NewUserHandler(r *repo.UserRepo) *UserHandler { return &UserHandler{repo: r} }

func (h *UserHandler) Me(c echo.Context) error {
	id := middleware.UserIDFromContext(c)
	user, err := h.repo.GetByID(id)
	if err != nil { return echo.ErrNotFound }
	return c.JSON(200, user)
}
```

**Step 3: 注册受保护路由**

```go
// router.go 中
api := e.Group("/api", middleware.JWTMiddleware(jwtSecret))
api.GET("/users/me", userHandler.Me)
```

**Step 4: 验证**

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"123456"}' | jq -r '.token')

curl http://localhost:8080/api/users/me \
  -H "Authorization: Bearer $TOKEN"
# 期望: 返回当前用户信息
```

**Step 5: Commit**

```bash
git add backend/internal/api/middleware/ backend/internal/api/handler/user_handler.go
git commit -m "feat: add JWT middleware and GET /api/users/me"
```

---

### Task 9: RBAC 中间件（角色校验）

**Objective:** `RequireRole("admin")` 中间件，审批接口将使用它做权限控制

**Files:**
- Modify: `backend/internal/api/middleware/auth.go`

**Step 1: 添加 RequireRole 函数**

```go
// 追加到 middleware/auth.go
func RequireRole(roles ...string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			role := RoleFromContext(c)
			for _, r := range roles {
				if role == r { return next(c) }
			}
			return echo.ErrForbidden
		}
	}
}
```

**Step 2: 写单元测试**

```go
// 验证 RequireRole 逻辑：user 访问 admin-only 路由 → 403
```

**Step 3: Commit**

```bash
git commit -m "feat: add RequireRole RBAC middleware"
```

---

### Task 10: 初始化 admin 用户（seed 脚本）

**Objective:** 能快速创建 admin 账号用于本地测试

**Files:**
- Create: `backend/cmd/seed/main.go`

**Step 1: 写 seed 脚本**

```go
// backend/cmd/seed/main.go
// 读取 .env，创建 admin@woship.local / admin123 的 admin 用户
// 如已存在则跳过
package main

import (
	"log"
	"golang.org/x/crypto/bcrypt"
	// ... db connect
)

func main() {
	// 连接 DB
	// 检查是否有 admin 用户
	// 没有则插入
	log.Println("Seeded admin user: admin@woship.local / admin123")
}
```

**Step 2: 验证**

```bash
cd backend && go run ./cmd/seed/
go run ./cmd/server/
# 用 admin 账号登录验证
```

**Step 3: Commit**

```bash
git commit -m "chore: add seed script for admin user"
```

---

## M3: 工单系统核心

### Task 11: Ticket model & repo

**Objective:** 定义 Ticket struct，实现基础 CRUD

**Files:**
- Create: `backend/internal/model/ticket.go`
- Create: `backend/internal/repo/ticket_repo.go`

**Step 1: 写 Ticket model**

```go
// backend/internal/model/ticket.go
package model

import (
	"encoding/json"
	"time"
)

type TicketStatus string
const (
	TicketDraft     TicketStatus = "draft"
	TicketPending   TicketStatus = "pending"
	TicketApproved  TicketStatus = "approved"
	TicketRejected  TicketStatus = "rejected"
	TicketDeploying TicketStatus = "deploying"
	TicketDone      TicketStatus = "done"
	TicketFailed    TicketStatus = "failed"
)

type Ticket struct {
	ID           string          `db:"id" json:"id"`
	Type         string          `db:"type" json:"type"`
	Title        string          `db:"title" json:"title"`
	Status       TicketStatus    `db:"status" json:"status"`
	Payload      json.RawMessage `db:"payload" json:"payload"`
	CreatedBy    string          `db:"created_by" json:"created_by"`
	ReviewedBy   *string         `db:"reviewed_by" json:"reviewed_by,omitempty"`
	RejectReason *string         `db:"reject_reason" json:"reject_reason,omitempty"`
	CreatedAt    time.Time       `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time       `db:"updated_at" json:"updated_at"`
}

// DockerDeployPayload — Ticket.Type == "docker_deploy" 时的 payload 结构
type DockerDeployPayload struct {
	Image      string            `json:"image"`
	Port       int               `json:"port"`
	Domain     string            `json:"domain"`
	Replicas   int               `json:"replicas"`
	Env        map[string]string `json:"env,omitempty"`
	Resources  ResourceSpec      `json:"resources"`
	ProviderID string            `json:"provider_id"`
}

type ResourceSpec struct {
	CPU    string `json:"cpu"`
	Memory string `json:"memory"`
}
```

**Step 2: 实现 TicketRepo**

```go
// backend/internal/repo/ticket_repo.go
package repo

// Create, GetByID, List(createdBy, status filters), UpdateStatus

func (r *TicketRepo) Create(t *model.Ticket) error { ... }
func (r *TicketRepo) GetByID(id string) (*model.Ticket, error) { ... }
func (r *TicketRepo) List(createdBy string, status string) ([]model.Ticket, error) { ... }
func (r *TicketRepo) UpdateStatus(id string, status model.TicketStatus, reviewerID *string, rejectReason *string) error { ... }
```

**Step 3: Commit**

```bash
git commit -m "feat: add Ticket model and repo"
```

---

### Task 12: TicketService — 创建 & 提交工单

**Objective:** 创建工单（draft），提交审批（pending），payload 格式校验

**Files:**
- Create: `backend/internal/service/ticket_service.go`
- Create: `backend/internal/service/ticket_service_test.go`

**Step 1: 写 failing tests**

```go
// ticket_service_test.go
func TestTicketService_Create_DockerDeploy(t *testing.T) {
	// 创建 docker_deploy 工单，payload 合法 → 成功
}
func TestTicketService_Create_InvalidPayload(t *testing.T) {
	// payload 中 image 为空 → 返回 ErrInvalidPayload
}
func TestTicketService_Submit_ChangesDraftToPending(t *testing.T) {
	// 提交草稿工单 → status 变成 pending
}
func TestTicketService_Submit_AlreadyPending(t *testing.T) {
	// 重复提交 → 返回 ErrInvalidTransition
}
```

**Step 2: 实现 TicketService**

```go
// ticket_service.go
var ErrInvalidPayload    = errors.New("invalid payload")
var ErrInvalidTransition = errors.New("invalid status transition")
var ErrForbidden         = errors.New("forbidden")

func (s *TicketService) Create(createdBy, title, ticketType string, payload json.RawMessage) (*model.Ticket, error) {
	// 校验 payload
	if err := s.validatePayload(ticketType, payload); err != nil { return nil, ErrInvalidPayload }
	t := &model.Ticket{Title: title, Type: ticketType, Status: model.TicketDraft, Payload: payload, CreatedBy: createdBy}
	return t, s.repo.Create(t)
}

func (s *TicketService) Submit(ticketID, userID string) error {
	t, err := s.repo.GetByID(ticketID)
	if err != nil { return err }
	if t.CreatedBy != userID { return ErrForbidden }
	if t.Status != model.TicketDraft { return ErrInvalidTransition }
	return s.repo.UpdateStatus(ticketID, model.TicketPending, nil, nil)
}

func (s *TicketService) validatePayload(ticketType string, raw json.RawMessage) error {
	switch ticketType {
	case "docker_deploy":
		var p model.DockerDeployPayload
		if err := json.Unmarshal(raw, &p); err != nil { return err }
		if p.Image == "" || p.Domain == "" || p.ProviderID == "" { return errors.New("missing required fields") }
	default:
		return errors.New("unknown ticket type")
	}
	return nil
}
```

**Step 3: 运行测试**

```bash
go test ./internal/service/... -run TestTicketService -v
```

**Step 4: Commit**

```bash
git commit -m "feat: add TicketService create and submit"
```

---

### Task 13: TicketService — 审批流（approve / reject）

**Objective:** approver/admin 可审批工单，校验权限和状态转换

**Files:**
- Modify: `backend/internal/service/ticket_service.go`

**Step 1: 写 failing tests**

```go
func TestTicketService_Approve_ByApprover(t *testing.T) { ... }  // 成功
func TestTicketService_Approve_ByUser_Forbidden(t *testing.T) { ... }  // 403
func TestTicketService_Reject_WithReason(t *testing.T) { ... }   // 成功，附原因
func TestTicketService_Approve_NotPending(t *testing.T) { ... }  // 非 pending 状态 → error
```

**Step 2: 实现 Approve / Reject**

```go
func (s *TicketService) Approve(ticketID, reviewerID string, reviewerRole model.Role) error {
	if reviewerRole != model.RoleApprover && reviewerRole != model.RoleAdmin {
		return ErrForbidden
	}
	t, err := s.repo.GetByID(ticketID)
	if err != nil { return err }
	if t.Status != model.TicketPending { return ErrInvalidTransition }
	return s.repo.UpdateStatus(ticketID, model.TicketApproved, &reviewerID, nil)
}

func (s *TicketService) Reject(ticketID, reviewerID, reason string, reviewerRole model.Role) error {
	if reviewerRole != model.RoleApprover && reviewerRole != model.RoleAdmin { return ErrForbidden }
	t, err := s.repo.GetByID(ticketID)
	if err != nil { return err }
	if t.Status != model.TicketPending { return ErrInvalidTransition }
	return s.repo.UpdateStatus(ticketID, model.TicketRejected, &reviewerID, &reason)
}
```

**Step 3: Commit**

```bash
git commit -m "feat: add ticket approve/reject with RBAC"
```

---

### Task 14: Ticket HTTP Handlers

**Objective:** 全套工单 REST API 上线

**Files:**
- Create: `backend/internal/api/handler/ticket_handler.go`
- Modify: `backend/internal/api/router.go`

**路由清单：**
```
POST   /api/tickets                  → Create
GET    /api/tickets                  → List（支持 ?status=pending 过滤）
GET    /api/tickets/:id              → GetByID
PUT    /api/tickets/:id/submit       → Submit（本人）
PUT    /api/tickets/:id/approve      → Approve（approver/admin）
PUT    /api/tickets/:id/reject       → Reject（approver/admin，body 带 reason）
GET    /api/tickets/:id/logs         → 执行日志 SSE（Task 36 实现）
```

**Step 1: 实现各 handler 方法**（参考 auth handler 的模式）

每个方法：
1. 从 context 取 userID 和 role
2. Bind request body
3. 调用 service 方法
4. 返回 JSON 或 error

**Step 2: 注册到路由（所有工单路由都需要 JWT）**

**Step 3: 手动测试完整流程**

```bash
# 1. admin 登录
TOKEN=$(curl -s -X POST .../login -d '{"email":"admin@...","password":"..."}' | jq -r .token)
# 2. 创建工单
curl -X POST .../api/tickets -H "Authorization: Bearer $TOKEN" \
  -d '{"type":"docker_deploy","title":"Test Deploy","payload":{...}}'
# 3. 提交审批
curl -X PUT .../api/tickets/:id/submit ...
# 4. 审批通过
curl -X PUT .../api/tickets/:id/approve ...
# 期望: status 变成 approved
```

**Step 4: Commit**

```bash
git commit -m "feat: add complete ticket REST API handlers"
```

---

## M4: Cloud Provider 抽象 & Mock

### Task 15: CloudProvider interface & AppSpec

**Objective:** 定义 Provider 抽象接口，所有 Provider 实现此接口

**Files:**
- Create: `backend/internal/provider/interface.go`

```go
// backend/internal/provider/interface.go
package provider

type AppSpec struct {
	Name       string
	Namespace  string
	Image      string
	Port       int
	Replicas   int
	Domain     string
	Env        map[string]string
	CPU        string
	Memory     string
}

type AppStatus struct {
	Name      string
	Status    string  // running, pending, failed, unknown
	Replicas  int
	Domain    string
	CreatedAt string
}

type CloudProvider interface {
	DeployApp(spec AppSpec) error
	UpdateApp(spec AppSpec) error
	DeleteApp(namespace, name string) error
	GetStatus(namespace, name string) (AppStatus, error)
	BindDomain(domain, targetIP string) error
	Test() error  // 连通性测试
}
```

**Commit:** `feat: define CloudProvider interface`

---

### Task 16: Mock Provider 实现

**Objective:** 本地开发用，模拟成功/失败场景，不需要真实 AWS

**Files:**
- Create: `backend/internal/provider/mock/mock.go`

```go
// backend/internal/provider/mock/mock.go
package mock

import (
	"fmt"
	"sync"
	"time"
	"github.com/claw-works/woship/internal/provider"
)

type MockProvider struct {
	mu   sync.Mutex
	apps map[string]provider.AppStatus  // namespace/name → status
}

func New() *MockProvider {
	return &MockProvider{apps: make(map[string]provider.AppStatus)}
}

func (m *MockProvider) DeployApp(spec provider.AppSpec) error {
	time.Sleep(2 * time.Second)  // 模拟部署耗时
	m.mu.Lock(); defer m.mu.Unlock()
	key := fmt.Sprintf("%s/%s", spec.Namespace, spec.Name)
	m.apps[key] = provider.AppStatus{
		Name: spec.Name, Namespace: spec.Namespace,
		Status: "running", Domain: spec.Domain,
	}
	return nil
}

func (m *MockProvider) GetStatus(namespace, name string) (provider.AppStatus, error) {
	m.mu.Lock(); defer m.mu.Unlock()
	key := fmt.Sprintf("%s/%s", namespace, name)
	if s, ok := m.apps[key]; ok { return s, nil }
	return provider.AppStatus{}, fmt.Errorf("app %s not found", key)
}

func (m *MockProvider) DeleteApp(namespace, name string) error {
	m.mu.Lock(); defer m.mu.Unlock()
	delete(m.apps, fmt.Sprintf("%s/%s", namespace, name))
	return nil
}

func (m *MockProvider) UpdateApp(spec provider.AppSpec) error { return m.DeployApp(spec) }
func (m *MockProvider) BindDomain(domain, ip string) error    { return nil }
func (m *MockProvider) Test() error                           { return nil }
```

**Step 1: 写单元测试验证 Mock 正确实现接口**

```go
func TestMockProvider_ImplementsInterface(t *testing.T) {
	var _ provider.CloudProvider = mock.New()  // 编译期检查
}
```

**Commit:** `feat: add mock CloudProvider for local development`

---

### Task 17: Provider Registry（按 ID 查找 Provider 实例）

**Objective:** 从数据库读取 Provider 配置，返回对应实例

**Files:**
- Create: `backend/internal/provider/registry.go`
- Create: `backend/internal/repo/provider_repo.go`

```go
// backend/internal/provider/registry.go
package provider

type Registry struct {
	providers map[string]CloudProvider  // providerID → instance
}

func NewRegistry() *Registry {
	return &Registry{providers: make(map[string]CloudProvider)}
}

func (r *Registry) Register(id string, p CloudProvider) {
	r.providers[id] = p
}

func (r *Registry) Get(id string) (CloudProvider, error) {
	if p, ok := r.providers[id]; ok { return p, nil }
	return nil, fmt.Errorf("provider %s not found", id)
}
```

**Commit:** `feat: add provider registry`

---

## M5: AWS Provider 实现

> ⚠️ **前提：需要有可用的 AWS 账号 + EKS 集群 + Route53 Hosted Zone**
> 本地开发阶段使用 Mock Provider，AWS Provider 通过集成测试验证

### Task 18: AWS Provider 骨架 & 连接测试

**Files:**
- Create: `backend/internal/provider/aws/provider.go`

```go
// backend/internal/provider/aws/provider.go
package aws

import (
	"context"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/route53"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

type Config struct {
	Region        string
	ClusterName   string
	KubeconfigPath string  // 或 in-cluster config
	HostedZoneID  string
	AccessKey     string  // 可选，优先用 IAM Role
	SecretKey     string
}

type AWSProvider struct {
	cfg       Config
	k8s       *kubernetes.Clientset
	route53   *route53.Client
}

func New(cfg Config) (*AWSProvider, error) {
	// 初始化 k8s client
	// 初始化 route53 client
	return &AWSProvider{cfg: cfg}, nil
}

func (p *AWSProvider) Test() error {
	// 测试 k8s 连接：list namespaces
	// 测试 route53：list hosted zones
	return nil
}
```

**安装依赖：**
```bash
go get github.com/aws/aws-sdk-go-v2/config@latest
go get github.com/aws/aws-sdk-go-v2/service/route53@latest
go get k8s.io/client-go@latest
go get k8s.io/apimachinery@latest
```

**Commit:** `feat: add AWS provider skeleton`

---

### Task 19: AWS EKS — DeployApp

**Files:**
- Create: `backend/internal/provider/aws/eks.go`

**实现 DeployApp：创建 Namespace + Deployment + Service + Ingress**

```go
// backend/internal/provider/aws/eks.go
func (p *AWSProvider) DeployApp(spec provider.AppSpec) error {
	ctx := context.Background()
	// 1. 确保 namespace 存在（Get or Create）
	p.ensureNamespace(ctx, spec.Namespace)
	// 2. 创建或更新 Deployment
	p.applyDeployment(ctx, spec)
	// 3. 创建或更新 Service (ClusterIP or LoadBalancer)
	p.applyService(ctx, spec)
	// 4. 创建或更新 Ingress（使用 nginx ingress controller）
	p.applyIngress(ctx, spec)
	return nil
}
```

具体实现参考 `k8s.io/client-go/kubernetes/typed/apps/v1` AppsV1().Deployments().Apply()

**Commit:** `feat: implement AWS EKS DeployApp`

---

### Task 20: AWS Route53 — BindDomain

**Files:**
- Create: `backend/internal/provider/aws/route53.go`

```go
// backend/internal/provider/aws/route53.go
func (p *AWSProvider) BindDomain(domain, targetHostname string) error {
	// 获取 Ingress 的 LoadBalancer hostname/IP
	// 在 HostedZoneID 中 Upsert CNAME/A 记录
	// 等待 DNS 传播（可选）
	return nil
}
```

**Commit:** `feat: implement AWS Route53 BindDomain`

---

### Task 21: Provider HTTP Handler（admin）

**Objective:** admin 可以 CRUD Cloud Provider 配置，并测试连通性

**路由：**
```
GET    /api/providers              → List
POST   /api/providers              → Create（含 type 和 config）
PUT    /api/providers/:id          → Update
DELETE /api/providers/:id          → Delete
GET    /api/providers/:id/test     → Test connectivity
```

**注意：** 以上路由全部加 `RequireRole("admin")` 中间件

**Commit:** `feat: add provider CRUD API for admin`

---

## M6: 任务执行引擎

### Task 22: Worker & Job 抽象

**Objective:** 审批通过后异步执行部署任务，Job 接口解耦工单类型

**Files:**
- Create: `backend/internal/worker/runner.go`
- Create: `backend/internal/worker/job.go`

```go
// backend/internal/worker/job.go
package worker

type Job interface {
	Execute(ctx context.Context, logger io.Writer) error
}

// backend/internal/worker/runner.go
type Runner struct {
	queue   chan Job
	logs    map[string]*bytes.Buffer  // ticketID → log buffer
	mu      sync.Mutex
}

func NewRunner(concurrency int) *Runner {
	r := &Runner{
		queue: make(chan Job, 100),
		logs:  make(map[string]*bytes.Buffer),
	}
	for i := 0; i < concurrency; i++ {
		go r.work()
	}
	return r
}

func (r *Runner) Enqueue(job Job) { r.queue <- job }

func (r *Runner) work() {
	for job := range r.queue {
		job.Execute(context.Background(), os.Stdout)
	}
}
```

**Commit:** `feat: add async worker runner`

---

### Task 23: DockerDeployJob

**Objective:** 实现 DockerDeployJob，调用 CloudProvider 完成部署，记录日志

**Files:**
- Create: `backend/internal/worker/jobs/docker_deploy_job.go`

```go
// docker_deploy_job.go
type DockerDeployJob struct {
	Ticket     *model.Ticket
	Deployment *model.Deployment
	Provider   provider.CloudProvider
	TicketRepo *repo.TicketRepo
	DeployRepo *repo.DeploymentRepo
	LogBuffer  *bytes.Buffer
}

func (j *DockerDeployJob) Execute(ctx context.Context, logger io.Writer) error {
	fmt.Fprintln(logger, "🚀 Starting deployment...")

	// 解析 payload
	var payload model.DockerDeployPayload
	json.Unmarshal(j.Ticket.Payload, &payload)

	// 更新 ticket status → deploying
	j.TicketRepo.UpdateStatus(j.Ticket.ID, model.TicketDeploying, nil, nil)

	// 调用 Provider
	spec := provider.AppSpec{
		Name:      j.Deployment.AppName,
		Namespace: j.Deployment.Namespace,
		Image:     payload.Image,
		Port:      payload.Port,
		Replicas:  payload.Replicas,
		Domain:    payload.Domain,
		Env:       payload.Env,
		CPU:       payload.Resources.CPU,
		Memory:    payload.Resources.Memory,
	}

	fmt.Fprintln(logger, "⚙️ Calling cloud provider DeployApp...")
	if err := j.Provider.DeployApp(spec); err != nil {
		j.TicketRepo.UpdateStatus(j.Ticket.ID, model.TicketFailed, nil, nil)
		fmt.Fprintf(logger, "❌ DeployApp failed: %v\n", err)
		return err
	}

	fmt.Fprintln(logger, "🌐 Binding domain...")
	if payload.Domain != "" {
		j.Provider.BindDomain(payload.Domain, "")
	}

	j.TicketRepo.UpdateStatus(j.Ticket.ID, model.TicketDone, nil, nil)
	fmt.Fprintln(logger, "✅ Deployment complete!")
	return nil
}
```

**Commit:** `feat: implement DockerDeployJob`

---

### Task 24: 审批通过后触发部署任务

**Objective:** TicketService.Approve() 成功后，自动向 Worker 入队 DockerDeployJob

**Modify:** `backend/internal/service/ticket_service.go`

```go
func (s *TicketService) Approve(ticketID, reviewerID string, role model.Role) error {
	// ... 原有审批逻辑 ...
	// 审批成功后：
	deployment := &model.Deployment{
		TicketID:  ticketID,
		// ... 从 payload 填充字段
	}
	s.deployRepo.Create(deployment)
	job := &jobs.DockerDeployJob{
		Ticket: t, Deployment: deployment,
		Provider: s.providerRegistry.Get(payload.ProviderID),
		// ...
	}
	s.worker.Enqueue(job)
	return nil
}
```

**Commit:** `feat: auto-enqueue deploy job on ticket approval`

---

### Task 25: SSE 执行日志流

**Objective:** GET /api/tickets/:id/logs 用 SSE 推送实时日志

**Files:**
- Modify: `backend/internal/api/handler/ticket_handler.go`

```go
func (h *TicketHandler) Logs(c echo.Context) error {
	ticketID := c.Param("id")
	c.Response().Header().Set("Content-Type", "text/event-stream")
	c.Response().Header().Set("Cache-Control", "no-cache")
	c.Response().Header().Set("Connection", "keep-alive")

	// 从 runner 获取 log buffer
	// 每 500ms 推送新内容，直到部署结束
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()
	for range ticker.C {
		logs := h.runner.GetLogs(ticketID)
		fmt.Fprintf(c.Response(), "data: %s\n\n", logs)
		c.Response().Flush()
		// 检查是否完成
		if h.ticketSvc.IsDone(ticketID) { return nil }
	}
	return nil
}
```

**Commit:** `feat: add SSE log streaming for ticket deployment`

---

## M7: 前端基础框架

### Task 26: 路由 & 布局

**Objective:** React Router 配置，登录/受保护路由，主布局（侧边栏 + 内容区）

**Files:**
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/router/index.tsx`
- Create: `frontend/src/components/Layout.tsx`
- Create: `frontend/src/components/Sidebar.tsx`

**路由结构：**
```
/login             → LoginPage（公开）
/                  → 重定向到 /tickets
/tickets           → TicketListPage（需登录）
/tickets/new       → CreateTicketPage
/tickets/:id       → TicketDetailPage
/admin/providers   → ProvidersPage（需 admin）
```

**Commit:** `feat: add React Router and main layout`

---

### Task 27: AuthContext & API client

**Objective:** JWT token 存 localStorage，axios 自动带上 Authorization header

**Files:**
- Create: `frontend/src/contexts/AuthContext.tsx`
- Create: `frontend/src/api/client.ts`

```typescript
// frontend/src/api/client.ts
import axios from 'axios'

const client = axios.create({ baseURL: '/api' })

client.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default client
```

**Commit:** `feat: add auth context and axios client with JWT`

---

### Task 28: LoginPage

**Objective:** 登录表单，成功后跳转 /tickets

**Files:**
- Create: `frontend/src/pages/LoginPage.tsx`

简洁卡片布局，email + password 输入，调用 `/api/auth/login`，token 存 localStorage。

**Commit:** `feat: add login page`

---

## M8: 前端工单 UI

### Task 29: TicketListPage

**Objective:** 展示当前用户的工单列表，支持 status 过滤 tab

**Files:**
- Create: `frontend/src/pages/TicketListPage.tsx`
- Create: `frontend/src/api/tickets.ts`

状态 tab：全部 / 草稿 / 待审批 / 已批准 / 已驳回 / 部署中 / 完成 / 失败

每行显示：标题、类型、状态 badge（颜色区分）、创建时间、操作按钮

**Commit:** `feat: add ticket list page`

---

### Task 30: CreateTicketPage（Docker Deploy 表单）

**Objective:** 填写 Docker 部署工单，选择 Provider，提交后跳转详情页

**Files:**
- Create: `frontend/src/pages/CreateTicketPage.tsx`

表单字段（对应 DockerDeployPayload）：
- Docker 镜像地址（必填）
- 端口（默认 8080）
- 域名（必填）
- 副本数（默认 2）
- Cloud Provider 下拉选择
- 环境变量（可动态增减 key=value 行）
- CPU / Memory 资源

**Commit:** `feat: add create docker deploy ticket form`

---

### Task 31: TicketDetailPage

**Objective:** 工单详情 + 状态流 + 审批操作 + 实时日志

**Files:**
- Create: `frontend/src/pages/TicketDetailPage.tsx`
- Create: `frontend/src/components/LogStream.tsx`

页面组成：
1. 基本信息（标题、类型、状态、创建时间）
2. Payload 展示（JSON pretty print 或结构化显示）
3. 操作按钮区：
   - 草稿 → "提交审批" 按钮
   - 待审批（approver/admin）→ "批准" / "驳回" 按钮（驳回弹出 reason 输入）
4. 部署日志区（status=deploying/done/failed 时显示）：
   - EventSource 连接 `/api/tickets/:id/logs`
   - 实时追加日志行，终端风格（黑底绿字）

**Commit:** `feat: add ticket detail page with approval actions and log stream`

---

### Task 32: Admin — ProvidersPage

**Objective:** admin 可以添加/管理 Cloud Provider 配置

**Files:**
- Create: `frontend/src/pages/admin/ProvidersPage.tsx`

功能：
- Provider 列表（名称、类型、状态）
- 新增 Provider 表单（名称、类型选择、config JSON 编辑器）
- "测试连通性" 按钮
- 启用/禁用 toggle

**Commit:** `feat: add admin providers management page`

---

## M9: 集成测试 & 上线准备

### Task 33: 端到端冒烟测试脚本

**Objective:** 一条命令验证完整流程：注册 → 创建工单 → 提交 → 审批 → 触发 Mock 部署

**Files:**
- Create: `scripts/e2e_smoke_test.sh`

```bash
#!/bin/bash
set -e
BASE=http://localhost:8080/api

# 1. 注册 & 登录
echo "=== 1. 注册 admin 用户 ==="
curl -sf -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"admin123","name":"Admin"}' > /dev/null

TOKEN=$(curl -sf -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"admin123"}' | jq -r .token)
echo "Token: ${TOKEN:0:20}..."

# 2. 创建 Mock Provider
echo "=== 2. 创建 Mock Provider ==="
PROVIDER_ID=$(curl -sf -X POST $BASE/providers -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"local-mock","type":"mock","config":{}}' | jq -r .id)

# 3. 创建工单
echo "=== 3. 创建 Docker Deploy 工单 ==="
TICKET_ID=$(curl -sf -X POST $BASE/tickets -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"docker_deploy\",\"title\":\"Test App\",\"payload\":{\"image\":\"nginx:latest\",\"port\":80,\"domain\":\"test.example.com\",\"replicas\":1,\"resources\":{\"cpu\":\"100m\",\"memory\":\"128Mi\"},\"provider_id\":\"$PROVIDER_ID\"}}" | jq -r .id)

# 4. 提交审批
curl -sf -X PUT $BASE/tickets/$TICKET_ID/submit -H "Authorization: Bearer $TOKEN"
echo "Ticket submitted"

# 5. 审批通过
curl -sf -X PUT $BASE/tickets/$TICKET_ID/approve -H "Authorization: Bearer $TOKEN"
echo "Ticket approved"

# 6. 轮询状态
sleep 5
STATUS=$(curl -sf $BASE/tickets/$TICKET_ID -H "Authorization: Bearer $TOKEN" | jq -r .status)
echo "Final status: $STATUS"
if [ "$STATUS" == "done" ]; then echo "✅ E2E PASS"; else echo "❌ E2E FAIL: status=$STATUS"; exit 1; fi
```

**Commit:** `test: add e2e smoke test script`

---

### Task 34: API 文档（OpenAPI）

**Objective:** 用 swaggo 生成 API 文档，方便前后端联调

```bash
go install github.com/swaggo/swag/cmd/swag@latest
swag init -g cmd/server/main.go -o docs/swagger
```

在 main.go 注册 swagger handler，访问 `http://localhost:8080/swagger/index.html`

**Commit:** `docs: add OpenAPI/Swagger documentation`

---

### Task 35: 生产 Dockerfile 优化 & CI 配置

**Objective:** 多阶段构建，前端 static 文件由后端直接 serve，GitHub Actions CI

**Files:**
- Modify: `backend/Dockerfile`（多阶段，包含前端 build）
- Create: `.github/workflows/ci.yml`

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  backend-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with: { go-version: '1.22' }
      - run: cd backend && go test ./... -v
  frontend-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd frontend && npm ci && npm run build
```

**Commit:** `ci: add GitHub Actions workflow`

---

## 开发顺序建议

```
Week 1:  Task 1-10  (骨架 + 认证)
Week 2:  Task 11-17 (工单系统 + Mock Provider)
Week 3:  Task 18-25 (AWS Provider + 执行引擎)
Week 4:  Task 26-35 (前端 + 集成测试)
```

## Mock 模式 vs AWS 模式

开发时在 `docker-compose.yml` 加环境变量控制：

```yaml
PROVIDER_MODE: mock   # 本地用 mock，不需要 AWS
# PROVIDER_MODE: aws  # 生产用真实 AWS，需配置 AWS credentials
```

---

> **执行提示（for Hermes）：** 使用 `subagent-driven-development` skill，按 M1 → M9 顺序逐 Task 执行。每个 Task 完成后验证测试通过再继续下一个。
