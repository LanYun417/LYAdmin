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

## 8. 命名与位置

- 文件：`src/modules/<domain>/dto/<domain>.dto.ts`（如 `dto/menu.dto.ts`）。
- 类名：`CreateXxxDto` / `UpdateXxxDto` / `XxxUpsertDto` / `XxxQueryDto`。
- 新增与编辑字段完全一致时共用 `Upsert` 结构（前端编辑传全量）。
- 编辑 DTO 不包含不可变字段（如 `configKey` / `dictType` / 角色 `roleCode`），即便前端误传也会被 `whitelist` 剔除。
