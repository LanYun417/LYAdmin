# LYAdmin 镜像（多阶段：web 构建 → api 构建 → 生产运行时）
#
# 构建（在仓库根目录执行，构建上下文必须是根目录，因为要同时拿 ly-admin-api 与 ly-admin-web）：
#   docker build -f deploy/Dockerfile -t ly-admin:latest .
# 或直接用 deploy/docker-compose.yml（它已配好 context 与 target）。
#
# 为什么用 bookworm-slim 而不是 alpine 作为运行时基镜像：
# 运行时依赖里有原生模块（sharp 图片缩放、@node-rs/bcrypt 口令哈希、ip2region 离线解析），
# alpine 是 musl libc，需依赖该组合的 musl 预编译包齐全；glibc 镜像没有这类风险，
# 代价只是镜像大 ~100MB。web 构建阶段不跑原生模块，故仍用 alpine（拉取更快）。

############################ 1. 前端构建 ############################
FROM node:24-alpine AS web-builder
WORKDIR /build/ly-admin-web

# 先只拷依赖清单：依赖未变时可命中缓存，改源码不会触发重新 npm ci
COPY ly-admin-web/package.json ly-admin-web/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY ly-admin-web/ ./
# 用 build:only 跳过 vue-tsc：类型检查由 CI 单独把关，镜像构建只求产物
RUN npm run build:only

############################ 2. 后端构建 ############################
FROM node:24-bookworm-slim AS api-builder
WORKDIR /build/ly-admin-api

COPY ly-admin-api/package.json ly-admin-api/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY ly-admin-api/ ./
# prebuild 会自动跑 docs:gen（接口文档产物），确保镜像内文档与实现一致
RUN npm run build

############################ 3. 运行时 ############################
FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    UPLOAD_DIR=uploads \
    LOG_DIR=logs \
    WEB_DIST_DIR=web

WORKDIR /app

# 生产依赖只装 dependencies；package.json 同时也承担「ESM 类型声明」的作用 ——
# 后端是纯 ESM（dist/main.js 为 ESM），Node 需要最近的 package.json 里 type: module 才能解析，
# 漏拷这一步启动即报 "Cannot use import statement outside a module"。
COPY ly-admin-api/package.json ly-admin-api/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --from=api-builder /build/ly-admin-api/dist ./dist
# 迁移与 schema：migrate 服务要用（运行时不需要，但同镜像保留可省一层 base）
COPY ly-admin-api/prisma ./prisma
COPY ly-admin-api/prisma.config.ts ./prisma.config.ts
# 前端产物：后端同源托管（history 回退 + 预压缩副本）
COPY --from=web-builder /build/ly-admin-web/dist ./web

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
