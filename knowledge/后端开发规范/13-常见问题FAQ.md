# 13 - 常见问题 FAQ

## 启动 / 配置

**Q1：VS Code 报 `Argument "url" is missing in data source block "db"`？**
Prisma 7 禁止在 schema 写 `url`。这是 VS Code 的 Prisma 扩展回落到 Prisma 6 语义导致的误报：
确认 `.vscode/settings.json` 未把 `prisma.pinToPrisma6` 设为 `true`，且每个 `.prisma` 文件首行都有 `// use prisma-next`。

**Q2：启动报缺少 `JWT_ACCESS_SECRET`？**
两个 JWT 密钥必填且必须不同。按 `01-快速开始` 生成两次随机值写入 `ly-admin-api/.env`。

**Q3：`Access denied` / `Unknown database 'ly_admin'`？**
MySQL 未启动或库未创建；核对 `.env` 的 `DB_*`（或 `DATABASE_URL`），先执行建库 SQL。

**Q4：`Table 'ly_admin.sys_user' doesn't exist`？**
Prisma 7 不在启动时建表。执行 `npm run prisma:push`，随后 `npm run prisma:comments`。

## Prisma

**Q5：改了 schema，代码里类型还是旧的？**
执行 `npm run prisma:generate`；生成物在 `src/generated/prisma/`，需要一起提交。

**Q6：表 / 字段注释是空的？**
`///` 不会自动进库。执行 `npm run prisma:comments`；`--force-reset` 之后也要补跑。

**Q7：`Unknown argument 'dept'` / `roles`？**
Prisma 的 `SelectSubset` 会让不在模型上的 `where` 键静默失效。`User` 没有 `dept` 关系（deptId=0 哨兵），
用 `lookupDeptName`；角色关系必须走显式中间表 `userRoles.role`，不要用隐式多对多。

**Q8：`db-*.log` 没有内容？**
需要 `DB_LOGGING=true`（默认 true）且查询耗时超过 `LOG_SLOW_SQL_MS`（默认 200ms）。

## 鉴权 / 权限

**Q9：登录成功但接口 403？**
1）接口声明了权限码，当前角色没有；2）角色刚改过权限，鉴权缓存最多 30s 生效；
3）菜单 / 角色关联写错了表（必须是 `sys_user_role` / `sys_role_menu`）。

**Q10：登录后菜单为空？**
种子未写入：`npm run seed`；普通角色需在「角色管理 → 菜单授权」勾选。超管仍为空说明种子异常。

**Q11：退出登录后旧 Token 还能用？**
登出黑名单依赖 Redis；未配置 `REDIS_HOST` 时黑名单不生效（降级为「未失效」）。多实例部署必须配 Redis。

**Q12：`GET /api/menus/abc` 返回 500？**
路径参数必须用 `IdParamDto`；若新写的接口出现该现象，说明用了 `@Param('id') id: string` + `Number(id)`。

## 校验 / 响应

**Q13：新增接口收到的字段全是 `undefined`？**
DTO 没有校验装饰器，被全局 `whitelist` 清空了。给每个字段加 `@IsString` / `@IsInt` 等（见 `08-DTO与校验`）。

**Q14：校验失败返回英文？**
DTO 的 `message` 没写中文，且没有用 `MSG`。契约测试会断言错误信息必须是中文。

**Q15：POST 返回 200 而不是 201？**
这是刻意契约：所有成功响应恒 200，由 `OkExpressAdapter` 保证。

## 上传 / 静态资源

**Q16：上传后访问 404？**
确认 `uploads/` 存在且可写、后端已启动、前端代理转发了 `/static`；同源部署由后端托管。

**Q17：图片 403「外链访问被拒绝」？**
分离部署时把前端 origin 配进 `UPLOAD_ALLOWED_REFERERS`；同源部署无需配置。

**Q18：缩略图不生效？**
`?scale=` 需为 `1..2000` 的整数；缓存目录 `UPLOAD_CACHE_DIR` 必须在 `UPLOAD_DIR` 之外。

## 测试

**Q19：e2e 登录失败 / 验证码为空？**
契约测试从 Redis 取验证码答案。确认 Redis 可用且 `REDIS_HOST` 已配置；`prisma:push` 与种子已执行。

**Q20：e2e 互相干扰？**
`vitest.config.e2e.ts` 已串行（`fileParallelism: false`）。不要改成并行——每个 spec 都会启动应用并写种子。

## 日志

**Q21：操作日志没有记录？**
端点是否加了 `@OperationLog`；方法是否是 POST/PUT/PATCH/DELETE；路径是否命中 `/api/auth/` 排除前缀。

**Q22：HTTP 日志列表里看不到请求体 / 响应体？**
列表接口返回的是摘要（不含 `reqBody` / `resBody`）以降低响应体积；点击表格行展开或调用 `GET /api/logs/http/detail/:id` 可获取完整请求体与响应体。注意请求体超过 2KB 仍会截断，敏感键（password/token/secret…）会被替换为 `******`；用户名搜索已改为前缀匹配（`startsWith`），可更精准地命中索引。
