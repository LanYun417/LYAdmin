# 08 - DTO 与校验

## 1. 全局校验管道

`app.setup.ts` 注册了：

```ts
new ValidationPipe({
  whitelist: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});
```

- `whitelist`：**剥掉**没有校验装饰器的字段（防越权字段注入）。
- `transform`：把 JSON 值转成 DTO 实例，路径 / 查询参数转成声明类型。
- 校验失败由 `AllExceptionsFilter` 转成 400 + 中文 `message`。

## 2. 最重要的规则：DTO 必须有校验装饰器

`whitelist` 的依据是「字段上有没有校验元数据」。一个只有属性的空 DTO：

```ts
// ❌ 所有字段都会被清空，service 收到 {}
export class MenuUpsertDto {
  menuName!: string;
  menuType!: string;
}
```

必须给每个字段加至少一个校验装饰器：

```ts
// ✅
export class MenuUpsertDto {
  @IsString({ message: MSG.isString })
  @IsNotEmpty({ message: '菜单名称不能为空' })
  @MaxLength(50, { message: MSG.maxLength(50) })
  menuName!: string;

  @IsIn(['M', 'C', 'F'], { message: '菜单类型非法' })
  menuType!: 'M' | 'C' | 'F';
}
```

> 这类缺陷不会在编译期暴露，运行时才表现为「新增的记录字段全是 undefined」。
> 新增 DTO 后务必用 `npm run test:e2e` 或手工请求验证一次。

## 3. 类型转换

- 数值：`@Type(() => Number)` + `@IsInt()` + `@Min/Max`。
- 字符串：`@Transform(({ value }) => value.trim())`。
- 可选字符串传空串：归一为 `undefined`，service 再落 `null`。

```ts
const trimToOptional = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};
```

- 默认值写在属性初始化上（`parentId?: number = 0`），service 里仍用 `??` 兜底。
- 布尔字段用 `@IsBoolean()`；不要用 `@IsIn([0, 1])` 混同数字与布尔。

## 4. 路径参数

统一用 `common/dto/id-param.dto.ts`：

```ts
@Get(':id')
detail(@Param() params: IdParamDto) {
  return this.service.getDetail(params.id); // params.id 已是 number
}
```

**不要**写 `@Param('id') id: string` 再 `Number(id)`：`GET /api/menus/abc` 会得到 `NaN`，
在 `BigInt(NaN)` 处抛未捕获异常，返回 500 而不是 400。

## 5. 查询参数

两种写法，按复杂度选择：

| 场景                       | 写法                                                                    |
| -------------------------- | ----------------------------------------------------------------------- |
| 通用列表（多条件、可扩展） | `@Query() query: Record<string, unknown>` + `readString` / `readNumber` |
| 固定少量参数               | 专用 Query DTO（如 `CheckQueryDto`、`LoginTrendQueryDto`）              |

```ts
const menuName = readString(query.menuName);
const status = readNumber(query.status);
```

`readString` / `readNumber` 会处理空串与非数字，避免 `String(undefined)` = `"undefined"` 这类问题。

## 6. 嵌套与数组

```ts
@IsArray({ message: MSG.isArray })
@ValidateNested({ each: true })
@Type(() => GenColumnOptionDto)
columnOptions?: GenColumnOptionDto[];
```

嵌套对象必须同时有 `@ValidateNested` 与 `@Type`，否则内部字段不会被校验。

## 7. 文案

- 字段级关键提示内联写中文（`'账号不能为空'`）。
- 通用约束用 `MSG`（`isString` / `isInt` / `maxLength(n)` …）。
- 禁止英文默认文案漏出；契约测试会断言错误信息含中文且不含 `must be` 等英文片段。

## 8. 批量导入：复用 DTO + 逐行报告

CSV 导入（`POST /api/users/import`）不另起一套校验规则，而是**把每一行交给同一个 DTO**：

```ts
const dto = plainToInstance(CreateUserDto, { username, nickname, password, ... });
const violations = await validate(dto, { whitelist: true });
violations.forEach((v) => rowErrors.push(...Object.values(v.constraints ?? {})));
```

- 好处：导入与接口新增的校验口径**天然一致**，DTO 加一条规则导入立刻生效，不存在两套规则漂移。
- 跨字段规则（如"密码不得包含账号"）DTO 装饰器管不到，在导入服务里显式调用对应断言。
- 表头归一化：`状态(启用/禁用)` 这类带取值说明的表头会被剥掉括号部分再匹配，
  所以模板可以自带说明，用户也不必死抠表头写法。

### 返回口径：行级问题 200 + 报告，请求级问题才 400

| 情形                                                        | 响应                                                                 | 理由                                                                    |
| ----------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 文件为空 / 缺必填列 / 只有表头 / 超行数上限 / 非 CSV 扩展名 | `400`                                                                | 请求本身不合法，交给统一异常信封                                        |
| 某些行校验不通过                                            | `200` + `{ total, created: 0, failed: [{line, username, message}] }` | 报告是"处理结果"不是异常；且异常信封的 `data` 恒为 null，装不下逐行明细 |

- **全成功或全不写**：任意一行不合格则整批不落库。导入是批量新建，半成功会让管理员
  猜"到底导进去几条"；删除则相反（幂等、可部分成功，见 `common/utils/batch.ts`）。
- 失败明细里的 `line` 是**文件里的物理行号（含表头）**，用户按第 N 行就能定位；
  多行单元格（引号内换行）不会把行号算错。
- 文件大小限制 2MB、解析行数上限 5000 行（`CSV_MAX_ROWS`），超限直接拒绝而不是静默截断。

### CSV 解析为什么自己写

`common/utils/csv-parse.ts` 是零依赖手写实现（约 100 行），因为项目的身份约束是
"零第三方运行时依赖"。它覆盖 Excel / WPS 真实会产出的形态：UTF-8 BOM、CRLF/LF/裸 CR、
引号内含逗号与换行、`""` 转义、末尾空行。**不猜编码**：文件按 UTF-8 解码，
GBK 导出会让中文变乱码，此时提示用户另存为 UTF-8 比自动猜测更可靠。

- 导入文件的 multer 配置是独立的 `CSV_IMPORT_MULTER_OPTIONS`（**memoryStorage**）：
  复用通用上传配置会把导入文件永久写进 `uploads/`（临时数据不该出现在文件管理页），
  且那份白名单不含 csv。

## 9. 命名与位置

- 文件：`src/modules/<domain>/dto/<domain>.dto.ts`（如 `dto/menu.dto.ts`）。
- 类名：`CreateXxxDto` / `UpdateXxxDto` / `XxxUpsertDto` / `XxxQueryDto`。
- 新增与编辑字段完全一致时共用 `Upsert` 结构（前端编辑传全量）。
- 编辑 DTO 不包含不可变字段（如 `configKey` / `dictType` / 角色 `roleCode`），即便前端误传也会被 `whitelist` 剔除。
