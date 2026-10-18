# 07 - 数据层与 Prisma

## 1. schema 是目录式的

```
prisma/schema/
├─ base.prisma         # 公共约定 + generator + datasource
├─ system.prisma       # 用户 / 角色 / 菜单 / 部门 + 三张关联表
├─ dict-config.prisma  # 字典类型 / 字典项 / 系统参数
├─ file.prisma         # 文件
├─ log.prisma          # 登录 / 操作 / HTTP 访问日志
└─ generated.prisma    # 代码生成器注入区（[GEN-ANCHOR]）
```

- Prisma 按**文件名字典序**合并；顺序只影响生成客户端的模型排列，不影响语义。
- 刻意不加 `NN-` 数字前缀；确实需要固定顺序时再加，并留间隔。
- 每个 `.prisma` 文件**首行**都必须是 `// use prisma-next`，否则 VS Code 扩展会回落到 Prisma 6 语义并误报
  `Argument "url" is missing`。
- `generator client.output = "../../src/generated/prisma"` 是**相对 schema 目录**解析的，改动前先确认路径。

## 2. 连接方式

Prisma 7 禁止在 schema 写 `datasource.url`：

| 场景   | 连接来源                                                                        |
| ------ | ------------------------------------------------------------------------------- |
| CLI    | `prisma.config.ts` 的 `datasource.url`（读 `.env` 的 `DB_*` 或 `DATABASE_URL`） |
| 运行期 | `PrismaService` 构造时注入 `PrismaMariaDb` driver adapter                       |

- CLI 与运行期读同一份 `.env`，不要给两边配不同的库。
- 连接池上限 10（`connectionLimit`），避免高并发耗尽 MySQL 连接数。

## 3. 建模约定

| 约定              | 说明                                                                   |
| ----------------- | ---------------------------------------------------------------------- |
| 主键              | `BigInt @id @default(autoincrement()) @db.BigInt`；对外 `Number()`     |
| 列名              | 字段 `camelCase` + `@map("snake_case")`，库内一律 snake_case           |
| 表名              | `@@map("sys_xxx")`                                                     |
| 时间字段          | `createdAt @default(now())`、`updatedAt @updatedAt`，均 `@map`         |
| 哨兵值 `0`        | `parent_id` / `dept_id` 为 0 表示根 / 未分配，**不建外键、不声明关系** |
| 中间表            | 显式 model（`UserRole` / `RoleMenu` / `RoleDept`），不用隐式多对多     |
| 二进制列          | 不建；文件只存元信息，内容落磁盘                                       |
| 金额 / 高精度小数 | 用 `Decimal`，对外按字符串输出（避免 JS 精度丢失）                     |

**为什么不用隐式多对多**：隐式关系会让 Prisma 另建 `_userroles` 表，与业务读写的 `sys_user_role`
不互通，表现为角色为空、权限码为空、所有带权限码的接口 403。

**为什么 `dept_id` 没有关系**：0 不在 `sys_dept` 中，声明关系会生成外键并拒绝写入。部门名一律用
`lookupDeptName` / `lookupDeptNames` 显式补查（批量查询避免 N+1）。

## 4. `///` 注释与数据库 COMMENT

- `///` 是 schema 级文档注释，只进 DMMF 与 Client JSDoc，**不会写入数据库**。
- 表 / 字段 COMMENT 由 `npm run prisma:comments` 从 `///` 生成 DDL 同步，幂等可重复执行。
- `npm run prisma:comments:check` 检查漂移（有差异退出码 1，可用于 CI）。
- 代码生成器从 `information_schema` 读 `TABLE_COMMENT` / `COLUMN_COMMENT` 作为业务名与表单标签，
  注释缺失时生成物会退化为英文列名。

> 改表结构或字段说明 → 改 `///` → `prisma:push` → `prisma:comments`。
> `db push --force-reset` 会清空 COMMENT，重建后必须补跑 `prisma:comments`。

## 5. 迁移（migrate）与 db push 的分工

| 场景                                  | 用法                                                      |
| ------------------------------------- | --------------------------------------------------------- |
| 生产 / 共享环境（必须可审计、可回滚） | `npm run migrate:deploy`（只应用已有迁移，不改 schema）   |
| 本地开发改表                          | `npm run migrate:dev -- --name <语义名>` → 生成迁移并应用 |
| 查看迁移是否落后库                    | `npm run migrate:status`                                  |
| 本地一次性试错（不产生迁移文件）      | `npm run prisma:push`（**仅限本地**，勿用于生产）         |
| 同步表/字段 COMMENT                   | `npm run prisma:comments`（与迁移无关，独立执行）         |

- 迁移目录固定为 `prisma/migrations`，在 `prisma.config.ts` 的 `migrations.path` **显式指定**：
  schema 指向的是目录（`prisma/schema`），不显式指定时默认迁移目录会跟着 schema 走，
  导致 `migrate status` 报「找不到迁移」。
- 初始迁移 `20261018210000_init` 是**基线**：它是用
  `prisma migrate diff --from-empty --to-schema prisma/schema --script` 从当前 schema 生成的，
  并已通过 `prisma migrate resolve --applied` 标记为「已在存量库执行」——
  存量库不会被重复建表，新库则能从零跑出完整结构。
- `migrate:dev` 需要**影子库**权限（Prisma 自动创建/删除临时库）：MySQL 账号需有
  `CREATE DATABASE` 权限，否则报 P3014；生产部署只用 `migrate:deploy`，不需要影子库。
- 迁移 SQL 只含**结构**（Prisma 不建模 COMMENT）；COMMENT 仍由 `prisma:comments` 负责，
  两条流水线互不影响。
- ⚠️ 本地用 `db push` 改过结构后，`migrate:dev` 可能会提示漂移（drift）：此时用
  `migrate:dev` 生成迁移会先要求 `migrate reset`（清库）。**试错期就用 push，定稿时再走 migrate**，
  或直接 `migrate:dev --name xxx` 让 Prisma 记录结构变更。

## 6. 查询约定

- 列表分页：`skip: offset` / `take: limit`，与 `parsePagination` 对齐；`total` 单独 `count`。
- 只取需要的列：`select` 明确字段；大文本 / 二进制列必须排除。
- 关联查询注意「未知参数不报错」：Prisma 的 `SelectSubset` 会让不在模型上的 `where` 键静默失效
  （类型检查也可能通过）。写关系过滤前先确认 schema 里真的有该关系。
- 多表写入用 `$transaction`；删除主表前先清中间表（有外键时）。
- 原生 SQL 仅限代码生成器（表名来自 `information_schema` 白名单），业务查询不得使用 `$queryRawUnsafe`。
- 慢 SQL 日志：`DB_LOGGING=true` 时 Prisma 发出查询事件，超过 `LOG_SLOW_SQL_MS`（默认 200ms）写
  `logs/db-YYYY-MM-DD.log`。

## 7. 生成物

- `src/generated/prisma/` **提交入库**，保证未跑 `prisma generate` 的机器也能编译。
- 不要手改生成物；schema 变更后执行 `npm run prisma:generate` 并单独提交（`chore(api):`）。
- 修改 schema 后必须跑 `npx prisma validate`，确保目录式 schema 合法。
