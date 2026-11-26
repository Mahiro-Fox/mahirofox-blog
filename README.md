# mahirofox-blog 项目

> 此项目是一个基于 Docker Compose 的博客项目，前端使用 Next.js，后端使用 Go 语言， 数据库使用 PostgreSQL,静态资源（如图片、视频等）托管在Cloudflare R2 上。项目结构如下：
>
> - `next-frontend`：Next.js 前端应用，负责渲染用户界面。
> - `backend-go`：Go 语言后端应用，负责处理业务逻辑和数据库交互。
> - 需要配置 `.env` 文件，设置数据库连接信息、端口号、以及其他必要的环境变量等，才能使用 docker 构建、启动项目。

## 启动 postgres + backend-go

```bash
docker compose up -d postgres backend-go
```

## 本地 dev 模式跑前端（已有 .env.local 配好）

```bash
pnpm dev
```

访问 http://localhost:3000/

## 或全栈容器化

```bash
docker-compose up -d --build
```

## 前端 http://localhost:3000，后端 http://localhost:8080，pgAdmin http://localhost:5050

## 日常运维命令

## 查看所有服务状态

```bash
docker compose ps
```

## 查看日志（实时）

```bash
docker compose logs -f backend-go # Go 后端日志
docker compose logs -f next-frontend # Next.js 日志
docker compose logs -f postgres # 数据库日志
```

## 重启单个服务

```bash
docker compose restart backend-go
```

## 更新代码后重新部署

```bash
git pull
docker compose up -d --build next-frontend backend-go
```

## 进入容器调试

```bash
docker compose exec next-frontend sh
docker compose exec backend-go sh
docker compose exec postgres psql -U mahiro -d mahiro
```
