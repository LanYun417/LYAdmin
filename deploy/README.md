# LYAdmin 部署说明（Docker Compose）

## 1. 前置要求

- Docker 24+ 与 Docker Compose v2（`docker compose` 子命令）
- 2GB 以上可用内存（MySQL 8 + Node 各占一份）；Windows / Docker Desktop 建议给到 4GB+
- **国内网络注意**：Docker Hub（`registry-1.docker.io` / `auth.docker.io`）经常连不通，
  拉取 `node:24-*` 等基础镜像会超时。两条路选一条：
  1. Docker Desktop → Settings → Docker Engine，加 `"registry-mirrors": ["https://docker.m.daocloud.io"]` 后重启；
  2. 或先手动拉取再打标签（build 时命中本地镜像，不再走远端）：
     ```bash
     docker pull docker.m.daocloud.io/library/node:24-bookworm-slim
     docker pull docker.m.daocloud.io/library/node:24-alpine
     docker tag docker.m.daocloud.io/library/node:24-bookworm-slim node:24-bookworm-slim
     docker tag docker.m.daocloud.io/library/node:24-alpine      node:24-alpine
     ```
     （`mysql:8.4` / `redis:7-alpine` 一般能直接拉；本仓库需要的三个基础镜像见 `deploy/Dockerfile`。）

## 2. 首次部署

```bash
# 1) 准备环境变量（模板见下方第 4 节；该文件已被 .gitignore 忽略，不会进仓库）
cp deploy/.env.example deploy/.env
vi deploy/.env          # 必改：DB_PASSWORD / JWT_ACCESS_SECRET / JWT_REFRESH_SECRET；建议设 SEED_ADMIN_PASSWORD

# 2) 构建并启动（含一次性迁移服务）
docker compose -f deploy/docker-compose.yml up -d --build

# 3) 验证（注意本机 shell 可能走代理，curl 需加 --noproxy）
curl --noproxy '*' http://localhost:3000/api/health/live
curl --noproxy '*' http://localhost:3000/api/health/ready
# 期望：live → status ok；ready → status ready 且 checks.db.status = up
```

> 一键生成 `.env`（随机 JWT 密钥 + 本地口令），适合本机试跑：
>
> ```bash
> node -e "
> const fs=require('fs'),crypto=require('crypto');
> const gen=()=>crypto.randomBytes(32).toString('hex');
> let s=fs.readFileSync('deploy/.env.example','utf8');
> s=s.replace(/^DB_PASSWORD=.*/m,'DB_PASSWORD=local-mysql-root')
>  .replace(/^JWT_ACCESS_SECRET=.*/m,'JWT_ACCESS_SECRET='+gen())
>  .replace(/^JWT_REFRESH_SECRET=.*/m,'JWT_REFRESH_SECRET='+gen())
>  .replace(/^SEED_ADMIN_PASSWORD=.*/m,'SEED_ADMIN_PASSWORD=Admin@2026');
> fs.writeFileSync('deploy/.env',s);
> "
> ```
>
> 然后 `admin` / `Admin@2026` 登录。**仅限本机试跑**，生产必须用强口令。

启动顺序由 compose 的依赖条件保证：`mysql`/`redis` 健康 → `migrate` 执行
`prisma migrate deploy` **并补齐表/字段注释**后成功退出 → `api` 启动
（启动时自动跑幂等种子，建出超管与菜单）。

> 为什么迁移后还要补注释：Prisma 生成的 `migration.sql` **不含 `COMMENT` 语句**
> （列注释是本项目用 `scripts/prisma-comments.ts` 单独维护的，见 `prisma/schema/*.prisma` 里的
> `///` 注释）。若只跑 `migrate deploy`，线上库一条注释都没有，
> `npm run prisma:comments:check` 也会报差异——所以 compose 的 `migrate` 服务把两件事串在一起做。

浏览器访问 `http://<host>:3000`（api 容器同时托管前端产物并做 history 回退）。

## 3. 常用运维命令

```bash
# 查看迁移状态 / 手动补迁移（手动执行时记得把注释一起补上，与 compose 内的默认流程保持一致）
docker compose -f deploy/docker-compose.yml run --rm migrate npx prisma migrate status
docker compose -f deploy/docker-compose.yml run --rm migrate sh -c   'npx prisma migrate deploy && npm run prisma:comments'

# 部署后自检：注释与 schema 是否一致（无输出即一致，有差异时退出码非 0）
docker compose -f deploy/docker-compose.yml run --rm migrate npm run prisma:comments:check

# 重新构建并滚动重启（只重建 api，不动数据库）
docker compose -f deploy/docker-compose.yml up -d --build api

# 日志（容器内同时写文件到 logs 卷，便于归档）
docker compose -f deploy/docker-compose.yml logs -f --tail=200 api

# 备份数据库（卷内数据用 mysqldump）
docker compose -f deploy/docker-compose.yml exec mysql \
  sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --databases "$MYSQL_DATABASE"' > backup.sql

# 升级前端（改了 web 源码后必须重建镜像：产物是构建期烘焙进镜像的）
docker compose -f deploy/docker-compose.yml up -d --build
```

## 4. 必需 / 关键环境变量（写入 `deploy/.env`）

| 变量                                       | 必需 | 说明                                                                           |
| ------------------------------------------ | ---- | ------------------------------------------------------------------------------ |
| `DB_PASSWORD`                              | ✅   | MySQL root 口令；compose 里用 `${DB_PASSWORD:?}` 强制，缺失直接报错退出        |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | ✅   | 两个密钥无默认值，缺失后端拒绝启动（刻意如此）；用 `openssl rand -hex 32` 生成 |
| `SEED_ADMIN_PASSWORD`                      | 建议 | 超管初始口令。**不设置时用开发默认弱口令，并在 production 打 warn**            |
| `DB_NAME`                                  | 否   | 默认 `ly_admin`                                                                |
| `HOST_PORT`                                | 否   | 宿主机映射端口，默认 `3000`                                                    |
| `CORS_ORIGIN`                              | 否   | 同源部署保持默认 `*`；分离部署必须写成前端域名白名单                           |
| `APP_VERSION` / `GIT_COMMIT`               | 否   | 会出现在 `/api/health/live` 里，便于确认线上跑的是哪个提交                     |
| `UPLOAD_MAX_SIZE`                          | 否   | 默认 10MB；改了要同步 nginx 的 `client_max_body_size`                          |
| `UPLOAD_USER_QUOTA_MB`                     | 否   | 单用户累计上传配额（MB），默认 512，`0` = 不限；防止单个账号塞满磁盘           |
| `CAPTCHA_ENABLED`                          | 否   | 默认开启登录图形验证码                                                         |
| `SECURITY_HSTS` / `CSP_POLICY`             | 否   | HSTS 默认跟随 production 开启；CSP 默认不下发（SPA 需按实际配置）              |

其余可调项见 `knowledge/后端开发规范/03-环境与配置.md`。

## 5. 数据与备份

| 卷           | 内容                       | 备份方式                                                 |
| ------------ | -------------------------- | -------------------------------------------------------- |
| `mysql-data` | 业务数据                   | `mysqldump`（见上）                                      |
| `uploads`    | 上传文件（按扩展名分目录） | 归档卷目录或用 `docker cp` 拉出                          |
| `logs`       | 应用日志与归档 `tar.gz`    | 保留期由 `LOG_*_RETENTION_DAYS` 控制，归档目录可定期转存 |
| `cache`      | 图片缩略图缓存             | **无需备份**（可再生）                                   |
| `redis-data` | 黑名单 / 限流计数 / 验证码 | 无需备份（AOF 只为平滑重启）                             |

## 6. 反向代理与 HTTPS

`deploy/nginx.conf` 是可直接套用的示例：nginx 托管前端产物、反代 `/api` 与 `/static`。
两个必须注意的点：

1. `/static/` 要**反代给 api**，不要把 uploads 目录映射成 nginx 静态目录 —— 否则绕过防盗链与缩放；
2. 反代后必须在 api 侧设置 `TRUST_PROXY=1`（compose 已内置），否则限流与审计日志记录的是网关 IP。

## 7. 已知限制

- **ip2region 离线库不进镜像**：`ly-admin-api/data/ip2region_v4.xdb`（约 10MB）未入库，
  compose 以只读方式挂载宿主目录；缺失时归属地解析静默降级为空串（不影响登录与日志写入）。
  需要时先在宿主机执行 `npm --prefix ly-admin-api run ip2region:update`。
- **镜像不含 `prisma` CLI**：运行时阶段只装 `dependencies`，迁移由 `migrate` 服务
  （`api-builder` 阶段镜像，含 devDependencies）执行，这也是它能用 `npx prisma` 的原因。
- **前端产物是构建期烘焙的**：改了前端代码必须重新 `--build`，没有「挂载宿主 dist 热更」的用法。
- **部署链路由 CI 的 `compose-smoke` job 持续验证**：它会在每次 push 时真的把整套 compose 跑起来
  （构建镜像 → 迁移 → api 就绪 → 登录冒烟 → 前端 index.html 可达），失败即红。
  本地同样可以直接跑：`docker compose -f deploy/docker-compose.yml up -d --build` 后按第 2 节探活。
  这条路径曾经只有"构建镜像"的覆盖，导致 `migrate` 服务里一个"缺 JWT 密钥即抛错"的问题
  在本地从未被发现（见 `ly-admin-api/src/common/config/db-config.ts` 的注释）。
- **`deploy/.env.example` 是唯一模板**：仓库根没有 `.env.example`，
  本地开发用的模板在 `ly-admin-api/.env.example`（后端 `cp .env.example .env`）。
