# LYAdmin 镜像（多阶段：web 构建 → api 构建 → 生产运行时）
#
# 构建（在仓库根目录执行，构建上下文必须是根目录，因为要同时拿 ly-admin-api 与 ly-admin-web）：
#   docker build -f deploy/Dockerfile -t ly-admin:latest .
# 或直接用 deploy/docker-compose.yml（它已配好 context 与 target）。
#
# 依赖管理：pnpm monorepo（仓库根一份 pnpm-lock.yaml）。各阶段用
# `pnpm deploy --filter` 只保留该子包的依赖，避免把整个 workspace 的 devDependencies 打进来。
#
# 为什么用 bookworm-slim 而不是 alpine 作为运行时基镜像：
# 运行时依赖里有原生模块（sharp 图片缩放、@node-rs/bcrypt 口令哈希、ip2region 离线解析），
# alpine 是 musl libc，需依赖该组合的 musl 预编译包齐全；glibc 镜像没有这类风险，
# 代价只是镜像大 ~100MB。web 构建阶段不跑原生模块，故仍用 alpine（拉取更快）。

############################ 1. 前端构建 ############################
FROM node:24-alpine AS web-builder
WORKDIR /build

# 先只拷依赖清单：依赖未变时可命中缓存，改源码不会触发重新安装
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY ly-admin-web/package.json ly-admin-web/package.json
COPY ly-admin-api/package.json ly-admin-api/package.json
RUN corepack enable && pnpm install --frozen-lockfile --filter ly-admin-web...

WORKDIR /build/ly-admin-web
COPY ly-admin-web/ ./
# 用 build:only 跳过 vue-tsc：类型检查由 CI 单独把关，镜像构建只求产物
RUN pnpm run build:only

############################ 2. 后端构建 ############################
FROM node:24-bookworm-slim AS api-builder
WORKDIR /build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY ly-admin-web/package.json ly-admin-web/package.json
COPY ly-admin-api/package.json ly-admin-api/package.json
RUN corepack enable && pnpm install --frozen-lockfile --filter ly-admin-api...

WORKDIR /build/ly-admin-api
COPY ly-admin-api/ ./
# prebuild 会自动跑 docs:gen（接口文档产物），确保镜像内文档与实现一致
RUN pnpm prisma generate && pnpm run build

############################ 3. 运行时 ############################
FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    UPLOAD_DIR=uploads \
    LOG_DIR=logs \
    WEB_DIST_DIR=web

WORKDIR /app

# 生产依赖只装 dependencies：`pnpm deploy --prod` 把后端子包的**生产依赖**
# （含原生模块二进制）单独解析到 /prod，devDependencies 不会进最终层。
# 需要先按 lockfile 建出 workspace，再 deploy —— 已验证该命令会带上
# ldapjs / nodemailer / @prisma/client / sharp 等运行时依赖，并排除 prisma / vitest 等开发依赖。
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY ly-admin-api/package.json ./ly-admin-api/package.json
COPY ly-admin-web/package.json ./ly-admin-web/package.json
RUN corepack enable && \
    pnpm install --frozen-lockfile --filter ly-admin-api... >/dev/null && \
    pnpm --filter ly-admin-api exec prisma generate >/dev/null && \
    pnpm deploy --filter ly-admin-api --prod /prod >/dev/null && \
    pnpm store prune

# 部署产物：package.json 承担「ESM 类型声明」职责 —— 后端是纯 ESM，
# Node 需要最近的 package.json 里 type: module 才能解析 dist/main.js
COPY --from=api-builder /build/ly-admin-api/dist ./dist
COPY --from=api-builder /build/ly-admin-api/node_modules ./node_modules
# 迁移与 schema：migrate 服务要用（运行时不需要，但同镜像保留可省一层 base）
COPY ly-admin-api/prisma ./prisma
COPY ly-admin-api/prisma.config.ts ./prisma.config.ts
# 前端产物：后端同源托管（history 回退 + 预压缩副本）
COPY --from=web-builder /build/ly-admin-web/dist ./web
# package.json 用子包原文件（含 type: module 与依赖声明）
COPY ly-admin-api/package.json ./package.json

# 运行期目录：uploads / logs / cache 需持久化，compose 里以卷挂载
RUN mkdir -p uploads logs cache

# 版本与环境标识（健康检查 /api/health/live 会带出，便于确认线上跑的是哪个提交）
ARG APP_VERSION=dev
ARG GIT_COMMIT=
ENV APP_VERSION=${APP_VERSION} \
    GIT_COMMIT=${GIT_COMMIT}

EXPOSE 3000

# 用 ready 探针：DB 不可用即 unhealthy（Redis 抖动只标记 degraded，不会误判）
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
