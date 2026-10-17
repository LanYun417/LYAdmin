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

## 5. 查询约定

- 列表分页：`skip: offset` / `take: limit`，与 `parsePagination` 对齐；`total` 单独 `count`。
- 只取需要的列：`select` 明确字段；大文本 / 二进制列必须排除。
- 关联查询注意「未知参数不报错」：Prisma 的 `SelectSubset` 会让不在模型上的 `where` 键静默失效
  （类型检查也可能通过）。写关系过滤前先确认 schema 里真的有该关系。
- 多表写入用 `$transaction`；删除主表前先清中间表（有外键时）。
- 原生 SQL 仅限代码生成器（表名来自 `information_schema` 白名单），业务查询不得使用 `$queryRawUnsafe`。
- 慢 SQL 日志：`DB_LOGGING=true` 时 Prisma 发出查询事件，超过 `LOG_SLOW_SQL_MS`（默认 200ms）写
  `logs/db-YYYY-MM-DD.log`。

## 6. 生成物

- `src/generated/prisma/` **提交入库**，保证未跑 `prisma generate` 的机器也能编译。
- 不要手改生成物；schema 变更后执行 `npm run prisma:generate` 并单独提交（`chore(api):`）。
- 修改 schema 后必须跑 `npx prisma validate`，确保目录式 schema 合法。
