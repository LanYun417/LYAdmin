/**
 * 代码生成模板。
 * 模块职责：根据表结构渲染出前后端 CRUD 代码文本，风格对齐项目现有模块（user / role / menu）。
 *
 * 说明：生成物是「可直接落地的骨架」，生成器不追求覆盖全部业务细节，
 * 生成的 README 会写明接线步骤（注册模型、挂载路由、补菜单与权限码）。
 */
import type { GenColumn, GenConfig, GenFile } from './gen.service';

/** 时间戳类字段：不参与新增/编辑表单。 */
const TIMESTAMP_FIELDS = ['created_at', 'updated_at', 'deleted_at', 'create_time', 'update_time'];

/** 首字母大写（PascalCase）。 */
export function toPascal(name: string): string {
  return name
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/** 驼峰（camelCase）。 */
export function toCamel(name: string): string {
  const pascal = toPascal(name);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/** SQL 类型 → TypeScript 类型。 */
export function toTsType(dataType: string): GenColumn['tsType'] {
  const t = dataType.toLowerCase();
  if (['tinyint', 'smallint', 'mediumint', 'int', 'integer', 'bigint', 'decimal', 'float', 'double'].includes(t)) {
    return 'number';
  }
  if (['bit', 'bool', 'boolean'].includes(t)) {
    return 'boolean';
  }
  if (['date', 'datetime', 'timestamp', 'time', 'year'].includes(t)) {
    return 'Date';
  }
  return 'string';
}

/** SQL 字段 → Sequelize DataType 表达式。 */
function toSequelizeType(col: GenColumn): string {
  const t = col.dataType.toLowerCase();
  if (t === 'bigint') {
    return 'DataType.BIGINT.UNSIGNED';
  }
  if (['int', 'integer', 'mediumint'].includes(t)) {
    return 'DataType.INTEGER';
  }
  if (['smallint'].includes(t)) {
    return 'DataType.SMALLINT';
  }
  if (['tinyint'].includes(t)) {
    return 'DataType.TINYINT';
  }
  if (['decimal', 'numeric'].includes(t)) {
    return 'DataType.DECIMAL(10, 2)';
  }
  if (['float'].includes(t)) {
    return 'DataType.FLOAT';
  }
  if (['double'].includes(t)) {
    return 'DataType.DOUBLE';
  }
  if (['date', 'datetime', 'timestamp'].includes(t)) {
    return 'DataType.DATE';
  }
  if (['time'].includes(t)) {
    return 'DataType.TIME';
  }
  if (['year'].includes(t)) {
    return 'DataType.INTEGER';
  }
  if (['text', 'longtext', 'mediumtext', 'tinytext'].includes(t)) {
    return 'DataType.TEXT';
  }
  if (['json'].includes(t)) {
    return 'DataType.JSON';
  }
  // 字符类：带上长度
  const len = col.columnType.match(/\((\d+)\)/);
  return len ? `DataType.STRING(${len[1]})` : 'DataType.STRING(255)';
}

/**
 * SQL 字段 → zod 校验表达式。
 * 注意链序：zod 必须先接校验器再接 .optional()，ZodOptional 上没有 min/int 等方法。
 * @param col 字段
 * @param forceOptional 强制可选（编辑表单/查询参数统一可选）
 */
function toZod(col: GenColumn, forceOptional = false): string {
  const max = col.columnType.match(/\((\d+)\)/);
  const maxLen = max ? Number(max[1]) : 255;
  let base: string;
  switch (col.tsType) {
    case 'number':
      base =
        col.dataType === 'decimal' || col.dataType === 'float' || col.dataType === 'double'
          ? 'z.coerce.number()'
          : 'z.coerce.number().int()';
      break;
    case 'boolean':
      base = 'z.coerce.number().int().min(0).max(1)';
      break;
    case 'Date':
      base = 'z.coerce.date()';
      break;
    default:
      base = `z.string().trim().max(${maxLen}, '长度不能超过 ${maxLen}')`;
      break;
  }
  // 可空字段或强制可选：校验链收尾后统一 .optional()
  if (forceOptional || col.isNullable) {
    return `${base}.optional()`;
  }
  return col.tsType === 'string' ? `${base}.min(1, '${col.columnComment || col.columnName}不能为空')` : base;
}

/** 参与新增/编辑的字段（排除主键与时间戳）。 */
function editableColumns(columns: GenColumn[]): GenColumn[] {
  return columns.filter((c) => !c.isPk && !TIMESTAMP_FIELDS.includes(c.columnName));
}

/** 参与列表查询的字段（仅字符串与数字，避免过多条件）。 */
function queryColumns(columns: GenColumn[]): GenColumn[] {
  return editableColumns(columns)
    .filter((c) => c.tsType === 'string' || c.tsType === 'number')
    .slice(0, 4);
}

/** 渲染 Sequelize 模型。 */
function renderModel(config: GenConfig, columns: GenColumn[], tableComment: string): string {
  const cls = toPascal(config.businessName);
  const fields = columns
    .filter((c) => !TIMESTAMP_FIELDS.includes(c.columnName))
    .map((c) => {
      if (c.isPk) {
        return [
          '  @PrimaryKey',
          '  @AutoIncrement',
          `  @Column({ type: DataType.BIGINT.UNSIGNED, comment: '${c.columnComment || '主键'}' })`,
          `  declare id: number;`,
        ].join('\n');
      }
      const nullSuffix = c.tsType === 'Date' ? ' | null' : c.isNullable ? ' | null' : '';
      return [
        `  @Column({ type: ${toSequelizeType(c)}, allowNull: ${c.isNullable}, comment: '${c.columnComment || c.columnName}' })`,
        `  declare ${c.fieldName}: ${c.tsType}${nullSuffix};`,
      ].join('\n');
    })
    .join('\n\n');

  return [
    `/**`,
    ` * ${tableComment || config.tableName} 模型 \`${config.tableName}\`。`,
    ` * 模块职责：映射数据表字段（由代码生成器生成，请按需补充关联与约束）。`,
    ` */`,
    `import {`,
    `  AutoIncrement,`,
    `  Column,`,
    `  DataType,`,
    `  Model,`,
    `  PrimaryKey,`,
    `  Table,`,
    `} from 'sequelize-typescript';`,
    ``,
    `@Table({`,
    `  tableName: '${config.tableName}',`,
    `  underscored: true,`,
    `  timestamps: true,`,
    `  comment: '${tableComment || config.tableName}',`,
    `})`,
    `export class ${cls} extends Model {`,
    fields,
    `}`,
    ``,
  ].join('\n');
}

/** 渲染 zod 校验器。 */
function renderValidator(config: GenConfig, columns: GenColumn[]): string {
  const name = toCamel(config.businessName);
  const pascal = toPascal(config.businessName);
  const editable = editableColumns(columns);
  const query = queryColumns(columns);

  const queryFields = [
    '  page: z.coerce.number().int().positive().optional(),',
    '  pageSize: z.coerce.number().int().positive().optional(),',
    ...query.map((c) => `  ${c.fieldName}: ${toZod(c, true)},`),
  ].join('\n');

  const writeFields = (withRequired: boolean): string =>
    editable.map((c) => `  ${c.fieldName}: ${toZod(c, !withRequired)},`).join('\n');

  return [
    `/**`,
    ` * ${config.businessName} 模块校验 schema。`,
    ` * 模块职责：列表查询、新增、编辑的 zod 规则（由代码生成器生成）。`,
    ` */`,
    `import { z } from 'zod';`,
    ``,
    `/** 列表查询。 */`,
    `export const ${name}ListQuerySchema = z.object({`,
    queryFields,
    `});`,
    ``,
    `/** 新增。 */`,
    `export const create${pascal}Schema = z.object({`,
    writeFields(true),
    `});`,
    ``,
    `/** 编辑。 */`,
    `export const update${pascal}Schema = z.object({`,
    writeFields(false),
    `});`,
    ``,
    `export type Create${pascal}Input = z.infer<typeof create${pascal}Schema>;`,
    `export type Update${pascal}Input = z.infer<typeof update${pascal}Schema>;`,
    ``,
  ].join('\n');
}

/** 渲染 service。 */
function renderService(config: GenConfig, columns: GenColumn[]): string {
  const cls = toPascal(config.businessName);
  const name = toCamel(config.businessName);
  const query = queryColumns(columns);
  const whereLines = query
    .map((c) => {
      if (c.tsType === 'string') {
        return [
          `  const ${c.fieldName} = typeof query.${c.fieldName} === 'string' ? String(query.${c.fieldName}).trim() : '';`,
          `  if (${c.fieldName}) {`,
          `    where.${c.fieldName} = { [Op.like]: \`%\${${c.fieldName}}%\` };`,
          `  }`,
        ].join('\n');
      }
      return [
        `  if (query.${c.fieldName} !== undefined && query.${c.fieldName} !== '') {`,
        `    where.${c.fieldName} = Number(query.${c.fieldName});`,
        `  }`,
      ].join('\n');
    })
    .join('\n\n');

  return [
    `/**`,
    ` * ${config.businessName} 服务。`,
    ` * 模块职责：分页查询与 CRUD（由代码生成器生成）。`,
    ` */`,
    `import { Op, type WhereOptions } from 'sequelize';`,
    `import { ${cls} } from '@/models';`,
    `import type { PageResult } from '@/types';`,
    `import { buildPageResult, parsePagination } from '@/utils/pagination';`,
    `import { AppError } from '@/utils/response';`,
    ``,
    `/**`,
    ` * 分页查询${config.businessName}。`,
    ` * @param query 查询参数`,
    ` */`,
    `export async function list${toPascal(config.businessName)}s(query: Record<string, unknown>): Promise<PageResult<${cls}>> {`,
    `  const { page, pageSize, offset, limit } = parsePagination(query);`,
    `  const where: WhereOptions = {};`,
    ``,
    whereLines || '  // 无可用查询条件，可按业务补充',
    ``,
    `  const { rows, count } = await ${cls}.findAndCountAll({`,
    `    where,`,
    `    order: [['id', 'DESC']],`,
    `    offset,`,
    `    limit,`,
    `  });`,
    ``,
    `  return buildPageResult(rows, count, page, pageSize);`,
    `}`,
    ``,
    `/**`,
    ` * 查询详情。`,
    ` * @param id 主键`,
    ` */`,
    `export async function get${cls}Detail(id: number): Promise<${cls}> {`,
    `  const record = await ${cls}.findByPk(id);`,
    `  if (!record) {`,
    `    throw AppError.notFound('记录不存在');`,
    `  }`,
    `  return record;`,
    `}`,
    ``,
    `/**`,
    ` * 新增。`,
    ` * @param input 新增参数`,
    ` */`,
    `export async function create${cls}(input: Record<string, unknown>): Promise<${cls}> {`,
    `  return ${cls}.create(input as never);`,
    `}`,
    ``,
    `/**`,
    ` * 编辑。`,
    ` * @param id 主键`,
    ` * @param input 编辑参数`,
    ` */`,
    `export async function update${cls}(id: number, input: Record<string, unknown>): Promise<${cls}> {`,
    `  const record = await get${cls}Detail(id);`,
    `  await record.update(input as never);`,
    `  return record;`,
    `}`,
    ``,
    `/**`,
    ` * 删除。`,
    ` * @param id 主键`,
    ` */`,
    `export async function remove${cls}(id: number): Promise<void> {`,
    `  const record = await get${cls}Detail(id);`,
    `  await record.destroy();`,
    `}`,
    ``,
    `/** 供 controller 复用的导出别名（保持命名一致）。 */`,
    `export const ${name}Service = {`,
    `  list: list${toPascal(config.businessName)}s,`,
    `  detail: get${cls}Detail,`,
    `  create: create${cls},`,
    `  update: update${cls},`,
    `  remove: remove${cls},`,
    `};`,
    ``,
  ].join('\n');
}

/** 渲染 controller。 */
function renderController(config: GenConfig): string {
  const cls = toPascal(config.businessName);
  const plural = `${toPascal(config.businessName)}s`;
  return [
    `/**`,
    ` * ${config.businessName} 控制器。`,
    ` * 模块职责：接收请求参数、调用 service、返回统一响应（由代码生成器生成）。`,
    ` */`,
    `import type { Request, Response } from 'express';`,
    `import * as ${toCamel(config.businessName)}Service from '@/services/${toCamel(config.businessName)}.service';`,
    `import { ok } from '@/utils/response';`,
    ``,
    `/** 分页列表。 */`,
    `export async function list${plural}(req: Request, res: Response): Promise<void> {`,
    `  const result = await ${toCamel(config.businessName)}Service.list${plural}(req.query as Record<string, unknown>);`,
    `  ok(res, result);`,
    `}`,
    ``,
    `/** 详情。 */`,
    `export async function get${cls}(req: Request, res: Response): Promise<void> {`,
    `  const record = await ${toCamel(config.businessName)}Service.get${cls}Detail(Number(req.params.id));`,
    `  ok(res, record);`,
    `}`,
    ``,
    `/** 新增。 */`,
    `export async function create${cls}(req: Request, res: Response): Promise<void> {`,
    `  const record = await ${toCamel(config.businessName)}Service.create${cls}(req.body as Record<string, unknown>);`,
    `  ok(res, record, '新增成功');`,
    `}`,
    ``,
    `/** 编辑。 */`,
    `export async function update${cls}(req: Request, res: Response): Promise<void> {`,
    `  const record = await ${toCamel(config.businessName)}Service.update${cls}(Number(req.params.id), req.body as Record<string, unknown>);`,
    `  ok(res, record, '修改成功');`,
    `}`,
    ``,
    `/** 删除。 */`,
    `export async function remove${cls}(req: Request, res: Response): Promise<void> {`,
    `  await ${toCamel(config.businessName)}Service.remove${cls}(Number(req.params.id));`,
    `  ok(res, null, '删除成功');`,
    `}`,
    ``,
  ].join('\n');
}

/** 渲染路由（含独立权限码）。 */
function renderRoutes(config: GenConfig): string {
  const cls = toPascal(config.businessName);
  const plural = `${cls}s`;
  const perm = `${config.moduleName}:${toCamel(config.businessName)}`;
  return [
    `/**`,
    ` * ${config.businessName} 路由 \`/api/${toCamel(config.businessName)}\`。`,
    ` * 模块职责：挂载 CRUD 接口并施加鉴权与权限码（由代码生成器生成）。`,
    ` */`,
    `import { Router } from 'express';`,
    `import * as ${toCamel(config.businessName)}Controller from '@/controllers/${toCamel(config.businessName)}.controller';`,
    `import { authenticate } from '@/middlewares/auth';`,
    `import { requirePermission } from '@/middlewares/permission';`,
    `import { validate } from '@/middlewares/validate';`,
    `import { asyncHandler } from '@/utils/asyncHandler';`,
    `import {`,
    `  create${cls}Schema,`,
    `  update${cls}Schema,`,
    `  ${toCamel(config.businessName)}ListQuerySchema,`,
    `} from '@/validators/${toCamel(config.businessName)}.validator';`,
    ``,
    `const router = Router();`,
    ``,
    `router.use(authenticate);`,
    ``,
    `router.get('/', validate({ query: ${toCamel(config.businessName)}ListQuerySchema }), requirePermission('${perm}:list'), asyncHandler(${toCamel(config.businessName)}Controller.list${plural}));`,
    ``,
    `router.get('/:id', requirePermission('${perm}:query'), asyncHandler(${toCamel(config.businessName)}Controller.get${cls}));`,
    ``,
    `router.post('/', validate({ body: create${cls}Schema }), requirePermission('${perm}:add'), asyncHandler(${toCamel(config.businessName)}Controller.create${cls}));`,
    ``,
    `router.put('/:id', validate({ body: update${cls}Schema }), requirePermission('${perm}:edit'), asyncHandler(${toCamel(config.businessName)}Controller.update${cls}));`,
    ``,
    `router.delete('/:id', requirePermission('${perm}:remove'), asyncHandler(${toCamel(config.businessName)}Controller.remove${cls}));`,
    ``,
    `export default router;`,
    ``,
  ].join('\n');
}

/** 渲染前端 api。 */
function renderFrontendApi(config: GenConfig): string {
  const cls = toPascal(config.businessName);
  const name = toCamel(config.businessName);
  return [
    `/**`,
    ` * ${config.businessName} 接口封装（由代码生成器生成）。`,
    ` */`,
    `import { del, get, post, put } from './request';`,
    `import type { PageResult } from '@/types/api';`,
    ``,
    `const BASE = '/${name}';`,
    ``,
    `/** ${config.businessName} 记录。 */`,
    `export interface ${cls} {`,
    `  id: number;`,
    `  [key: string]: unknown;`,
    `}`,
    ``,
    `/** 分页查询。 */`,
    `export function get${cls}List(params: Record<string, unknown>): Promise<PageResult<${cls}>> {`,
    `  return get<PageResult<${cls}>>(BASE, params);`,
    `}`,
    ``,
    `/** 详情。 */`,
    `export function get${cls}(id: number): Promise<${cls}> {`,
    `  return get<${cls}>(BASE + '/' + id);`,
    `}`,
    ``,
    `/** 新增。 */`,
    `export function create${cls}(data: Partial<${cls}>): Promise<${cls}> {`,
    `  return post<${cls}>(BASE, data);`,
    `}`,
    ``,
    `/** 编辑。 */`,
    `export function update${cls}(id: number, data: Partial<${cls}>): Promise<${cls}> {`,
    `  return put<${cls}>(BASE + '/' + id, data);`,
    `}`,
    ``,
    `/** 删除。 */`,
    `export function delete${cls}(id: number): Promise<null> {`,
    `  return del<null>(BASE + '/' + id);`,
    `}`,
    ``,
  ].join('\n');
}

/** 渲染前端页面。 */
function renderFrontendView(config: GenConfig, columns: GenColumn[]): string {
  const cls = toPascal(config.businessName);
  const name = toCamel(config.businessName);
  const perm = `${config.moduleName}:${name}`;
  const editable = editableColumns(columns);
  const tableCols = editable
    .slice(0, 8)
    .map(
      (c) =>
        `        <el-table-column prop="${c.fieldName}" label="${c.columnComment || c.columnName}" min-width="120" show-overflow-tooltip />`,
    )
    .join('\n');

  const formItems = editable
    .map((c) =>
      [
        `        <el-form-item label="${c.columnComment || c.columnName}" prop="${c.fieldName}">`,
        `          <el-input v-model="form.${c.fieldName}" placeholder="请输入${c.columnComment || c.columnName}" />`,
        `        </el-form-item>`,
      ].join('\n'),
    )
    .join('\n');

  const searchItems = queryColumns(columns)
    .map((c) =>
      [
        `        <el-form-item label="${c.columnComment || c.columnName}">`,
        `          <el-input v-model="query.${c.fieldName}" placeholder="请输入${c.columnComment || c.columnName}" clearable />`,
        `        </el-form-item>`,
      ].join('\n'),
    )
    .join('\n');

  const formInit = editable.map((c) => `    ${c.fieldName}: ${c.tsType === 'number' ? '0' : "''"},`).join('\n');
  // 查询字段必须先在 reactive 中声明，否则模板绑定 query.xxx 会产生类型错误
  const queryInit = queryColumns(columns)
    .map((c) => `    ${c.fieldName}: '',`)
    .join('\n');

  return [
    `<script setup lang="ts">`,
    `/**`,
    ` * ${config.businessName} 列表页（由代码生成器生成）。`,
    ` */`,
    `import { onMounted, reactive, ref } from 'vue';`,
    `import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';`,
    `import { BIconPencilSquare, BIconPlus, BIconSearch, BIconTrash } from 'bootstrap-icons-vue';`,
    `import {`,
    `  create${cls},`,
    `  delete${cls},`,
    `  get${cls}List,`,
    `  update${cls},`,
    `  type ${cls},`,
    `} from '@/api/${name}';`,
    ``,
    `const list = ref<${cls}[]>([]);`,
    `const loading = ref(false);`,
    `const total = ref(0);`,
    `const dialogVisible = ref(false);`,
    `const editingId = ref<number | null>(null);`,
    `const formRef = ref<FormInstance>();`,
    ``,
    `const query = reactive({`,
    `  page: 1,`,
    `  pageSize: 10,`,
    queryInit || `    // 无可用查询字段`,
    `});`,
    `const form = reactive({`,
    formInit || `    // 无可用字段`,
    `});`,
    ``,
    `/** 加载列表。 */`,
    `async function loadList() {`,
    `  loading.value = true;`,
    `  try {`,
    `    const res = await get${cls}List(query);`,
    `    list.value = res.list;`,
    `    total.value = res.total;`,
    `  } finally {`,
    `    loading.value = false;`,
    `  }`,
    `}`,
    ``,
    `/** 打开新增。 */`,
    `function handleAdd() {`,
    `  editingId.value = null;`,
    `  dialogVisible.value = true;`,
    `}`,
    ``,
    `/** 打开编辑。 */`,
    `function handleEdit(row: ${cls}) {`,
    `  editingId.value = row.id;`,
    `  Object.assign(form, row);`,
    `  dialogVisible.value = true;`,
    `}`,
    ``,
    `/** 提交表单。 */`,
    `async function handleSubmit() {`,
    `  await formRef.value?.validate();`,
    `  if (editingId.value) {`,
    `    await update${cls}(editingId.value, form);`,
    `    ElMessage.success('修改成功');`,
    `  } else {`,
    `    await create${cls}(form);`,
    `    ElMessage.success('新增成功');`,
    `  }`,
    `  dialogVisible.value = false;`,
    `  loadList();`,
    `}`,
    ``,
    `/** 删除。 */`,
    `async function handleDelete(row: ${cls}) {`,
    `  await ElMessageBox.confirm('确定删除该记录吗？', '删除确认', { type: 'warning' });`,
    `  await delete${cls}(row.id);`,
    `  ElMessage.success('删除成功');`,
    `  loadList();`,
    `}`,
    ``,
    `onMounted(loadList);`,
    `</script>`,
    ``,
    `<template>`,
    `  <div>`,
    `    <el-card shadow="never" class="mb-3">`,
    `      <el-form :model="query" inline>`,
    searchItems || `        <!-- 无可用查询条件 -->`,
    `        <el-form-item>`,
    `          <el-button type="primary" :icon="BIconSearch" @click="loadList">查询</el-button>`,
    `        </el-form-item>`,
    `      </el-form>`,
    `    </el-card>`,
    ``,
    `    <el-card shadow="never">`,
    `      <div class="flex items-center justify-between mb-3">`,
    `        <span class="table-title">${config.businessName} 列表</span>`,
    `        <el-button v-permission="'${perm}:add'" type="primary" :icon="BIconPlus" @click="handleAdd">新增</el-button>`,
    `      </div>`,
    ``,
    `      <el-table v-loading="loading" :data="list">`,
    tableCols || `        <el-table-column prop="id" label="ID" width="80" />`,
    `        <el-table-column label="操作" width="160" fixed="right">`,
    `          <template #default="{ row }">`,
    `            <el-button v-permission="'${perm}:edit'" type="primary" link :icon="BIconPencilSquare" @click="handleEdit(row as ${cls})">编辑</el-button>`,
    `            <el-button v-permission="'${perm}:remove'" type="danger" link :icon="BIconTrash" @click="handleDelete(row as ${cls})">删除</el-button>`,
    `          </template>`,
    `        </el-table-column>`,
    `      </el-table>`,
    `    </el-card>`,
    ``,
    `    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑' : '新增'" width="520">`,
    `      <el-form ref="formRef" :model="form" label-width="100px">`,
    formItems,
    `      </el-form>`,
    `      <template #footer>`,
    `        <el-button @click="dialogVisible = false">取消</el-button>`,
    `        <el-button type="primary" @click="handleSubmit">确定</el-button>`,
    `      </template>`,
    `    </el-dialog>`,
    `  </div>`,
    `</template>`,
    ``,
  ].join('\n');
}

/** 渲染接线说明。 */
function renderReadme(config: GenConfig, columns: GenColumn[], tableComment: string): string {
  const cls = toPascal(config.businessName);
  const name = toCamel(config.businessName);
  const perm = `${config.moduleName}:${name}`;
  return [
    `# ${tableComment || config.tableName} 代码生成产物`,
    ``,
    `- 数据表：\`${config.tableName}\``,
    `- 模块名：\`${config.moduleName}\``,
    `- 业务名：\`${config.businessName}\``,
    `- 生成时间：由代码生成器生成`,
    ``,
    `## 目录说明`,
    ``,
    `\`\`\``,
    `backend/models/${cls}.ts              Sequelize 模型`,
    `backend/validators/${name}.validator.ts   zod 校验`,
    `backend/services/${name}.service.ts       业务逻辑`,
    `backend/controllers/${name}.controller.ts 接口层`,
    `backend/routes/${name}.routes.ts          路由（含权限码）`,
    `frontend/api/${name}.ts                   前端接口封装`,
    `frontend/views/${config.moduleName}/${name}/index.vue  前端列表页`,
    `\`\`\``,
    ``,
    `## 接线步骤（生成后需手动完成）`,
    ``,
    `1. **注册模型**：在 \`api/src/models/index.ts\` 中导入并加入 \`models\` 数组`,
    `   - \`import { ${cls} } from './${cls}';\``,
    `   - \`export { ${cls} } from './${cls}';\``,
    `   - \`export const models = [..., ${cls}];\``,
    ``,
    `2. **挂载路由**：在 \`api/src/routes/index.ts\` 中注册`,
    `   - \`router.use('/${name}', ${name}Routes);\``,
    ``,
    `3. **补菜单与权限码**：在 \`api/src/seed/menu.seed.ts\` 增加菜单节点，权限码如下（务必逐个建独立节点）`,
    `   - \`${perm}:list\``,
    `   - \`${perm}:query\``,
    `   - \`${perm}:add\``,
    `   - \`${perm}:edit\``,
    `   - \`${perm}:remove\``,
    ``,
    `4. **角色授权**：在 \`api/src/seed/role.seed.ts\` 按需授予；只读角色一律不得授予 add/edit/remove`,
    ``,
    `5. **字段核对**：生成的表单控件目前统一用 \`el-input\`，状态类、枚举类、时间类字段请替换为对应控件`,
    ``,
    `## 字段清单`,
    ``,
    `| 列名 | 类型 | 驼峰 | 主键 | 可空 | 说明 |`,
    `| --- | --- | --- | --- | --- | --- |`,
    ...columns.map(
      (c) =>
        `| ${c.columnName} | ${c.columnType} | ${c.fieldName} | ${c.isPk ? '是' : '否'} | ${c.isNullable ? '是' : '否'} | ${c.columnComment || ''} |`,
    ),
    ``,
  ].join('\n');
}

/**
 * 生成全部文件。
 * @param config 生成配置
 * @param columns 字段列表
 * @param tableComment 表注释
 * @returns 文件列表
 */
export function generateFiles(config: GenConfig, columns: GenColumn[], tableComment: string): GenFile[] {
  const cls = toPascal(config.businessName);
  const name = toCamel(config.businessName);
  return [
    { path: `backend/models/${cls}.ts`, content: renderModel(config, columns, tableComment) },
    { path: `backend/validators/${name}.validator.ts`, content: renderValidator(config, columns) },
    { path: `backend/services/${name}.service.ts`, content: renderService(config, columns) },
    { path: `backend/controllers/${name}.controller.ts`, content: renderController(config) },
    { path: `backend/routes/${name}.routes.ts`, content: renderRoutes(config) },
    { path: `frontend/api/${name}.ts`, content: renderFrontendApi(config) },
    { path: `frontend/views/${config.moduleName}/${name}/index.vue`, content: renderFrontendView(config, columns) },
    { path: 'README.md', content: renderReadme(config, columns, tableComment) },
  ];
}
