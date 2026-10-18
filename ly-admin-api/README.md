# ly-admin-api

蓝云后台管理系统的**后端服务**（NestJS 12 + Prisma 7 + MySQL 8）。

项目整体介绍、快速开始、部署与完整环境变量清单见根目录 [README](../README.md)；本文只描述后端工程自身。

## 技术栈

| 层       | 技术                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 框架     | NestJS 12（纯 ESM，Express 5 适配层）                                                                                                |
| 数据层   | Prisma 7 + `@prisma/adapter-mariadb`（driver adapter 提供运行期连接；CLI 连接串见 `prisma.config.ts`）                               |
| 鉴权     | jose（JWT 双 Token）+ @node-rs/bcrypt（口令）                                                                                        |
| 其他能力 | class-validator（校验）、multer（上传）、sharp（图片处理）、redis（验证码 / 黑名单 / 限流，可选）、ip2region.js（IP 归属地离线解析） |

## 目录结构

```
ly-admin-api/
├─ prisma/
│  ├─ schema/                 # 目录式 schema，按域拆分（合并顺序 = 文件名字典序）
│  │  ├─ base.prisma          #   公共约定 + generator + datasource
│  │  ├─ system.prisma        #   用户 / 角色 / 菜单 / 部门 + 三张关联表
│  │  ├─ dict-config.prisma   #   字典类型 / 字典项 / 系统参数
│  │  ├─ file.prisma          #   文件元信息
│  │  ├─ log.prisma           #   登录 / 操作 / HTTP 访问日志
│  │  └─ generated.prisma     #   代码生成器注入区（[GEN-ANCHOR]，勿手工放业务模型）
│  └─ seed.ts                 # CLI 种子入口（npm run seed）
├─ scripts/
│  ├─ prisma-comments.ts      # 把 schema 的 /// 同步为库内 COMMENT
│  ├─ gen-api-docs.mjs        # 扫描控制器生成接口文档数据（docs:gen / build 的 prebuild）
│  └─ update-ip2region.ts    # 更新 IP 归属地数据文件 data/ip2region_v4.xdb
├─ src/
│  ├─ common/                 # 横切能力（@Global CommonModule，按职责分组）
│  │  ├─ common.module.ts     #   统一 provider / exports
│  │  ├─ types.ts             #   跨层共享类型
│  │  ├─ config/              #   环境变量入口 / 常量（错误码、枚举、正则、白名单）
│  │  ├─ utils/               #   纯函数（分页 / 树 / CSV / 时间 / 口令 / 部门名补查 / UA / 校验文案）
│  │  ├─ exception/           #   AppException + 全局异常过滤
│  │  ├─ http/                #   响应适配器 / 统一响应包装 / 静态资源鉴权
│  │  ├─ auth/                #   守卫 / JWT / 黑名单 / 登录限流 / 验证码 / 数据权限
│  │  ├─ log/                 #   操作日志（装饰器 / 拦截器 / 落库）+ 访问日志（中间件 / 队列 / 文件日志）
│  │  ├─ file/                #   上传 / 秒传 / 下载 / 删除 + 防盗链 / 图片缩放 + multer 配置
│  │  ├─ ip/                  #   IP → 归属地（ip2region）
│  │  ├─ redis/               #   可选共享存储（未配置即降级）
│  │  └─ dto/                 #   路径参数 :id 的统一校验
│  ├─ modules/                # 业务模块（module / controller / service / dto）
│  │                          #   auth / menu / users / roles / depts / dict / config /
│  │                          #   dashboard / gen / files / profile / logs / docs
│  ├─ prisma/                 # PrismaModule / PrismaService / seed.service（启动即幂等种子）
│  ├─ generated/              # Prisma Client 生成产物（提交入库，勿手改）
│  ├─ app.module.ts           # 根模块：全局守卫 / 拦截器 / 过滤器 / 中间件
│  ├─ app.setup.ts            # 装配（main.ts 与 e2e 共用）
│  └─ main.ts                 # 入口
├─ test/                      # vitest 单测 + e2e（setup-app / 冒烟 / 契约快照）
├─ data/                      # IP 归属地数据文件（ip2region_v4.xdb，不入库，见下）
├─ prisma.config.ts           # Prisma CLI 连接串与 schema 路径
└─ package.json
```

分层约定与新增模块步骤见 [后端开发规范](../knowledge/后端开发规范/00-导读.md)。

## 常用脚本

| 命令                            | 说明                                                       |
| ------------------------------- | ---------------------------------------------------------- |
| `npm run start:dev`             | Nest watch 模式热重载（:3000）                             |
| `npm run build`                 | 编译到 `dist/`（prebuild 自动重新生成接口文档）            |
| `npm run start:prod`            | 运行编译产物 `node dist/main`                              |
| `npm run prisma:push`           | 建表 / 同步表结构（首次必执行；Prisma 7 启动时不自动建表） |
| `npm run prisma:comments`       | 把 schema 的 `///` 同步为库内表 / 字段 COMMENT（幂等）     |
| `npm run prisma:comments:check` | 检查库内注释是否漂移（有差异退出码 1）                     |
| `npm run prisma:generate`       | 重新生成 Prisma Client                                     |
| `npm run seed`                  | 单独执行种子数据（幂等；服务启动时也会自动执行）           |
| `npm run docs:gen`              | 扫描控制器重新生成接口文档                                 |
| `npm run ip2region:update`      | 更新 IP 归属地数据文件（下载 → 校验 → 原子替换）           |
| `npm run typecheck`             | 类型检查（`tsc --noEmit`）                                 |
| `npm run lint`                  | oxlint（type-aware）                                       |
| `npm run test`                  | vitest 单元测试                                            |
| `npm run test:e2e`              | vitest e2e 契约测试（需本地 MySQL / Redis）                |

## 环境变量

至少需要配置 `DB_*` 与 `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`（**必填且无默认值**，缺失将拒绝启动）。
完整清单见根目录 [README - 环境变量](../README.md#环境变量)。

IP 归属地数据文件默认读取 `data/ip2region_v4.xdb`（约 10 MB，**不入库**）：

- 首次使用执行 `npm run ip2region:update` 拉取；
- 可用环境变量 `IP2REGION_DB_PATH` 覆盖路径；
- 文件缺失或损坏时服务照常启动，仅 IP 归属地解析降级为空，不影响其他功能。

## 开发约定速查

- 环境变量只允许出现在 `src/common/config/`；常量集中在 `src/common/config/constants.ts`。
- 每张核心表只允许一个 service 直接读写；跨模块取数注入对方 service。
- 写操作加 `@OperationLog('模块名', '动作')` 留痕；接口权限码遵循 `:list` / `:query` / `:add` / `:edit` / `:remove`。
- 表结构变更改 `prisma/schema/` 对应域文件后，依次执行 `prisma:push` + `prisma:comments` + `prisma:generate`。
- 提交遵循 Conventional Commits（中文 subject），见 [Git 提交规范](../knowledge/Git提交规范/01-提交信息规范.md)。
