#!/usr/bin/env node
/**
 * 接口文档生成器。
 *
 * 模块职责：用 TypeScript AST 扫描全部控制器源码，提取
 * 「路由方法 / 完整路径 / JSDoc 说明 / 权限码 / 是否公开 / 操作日志语义」，
 * 产出 `src/modules/docs/api-docs.generated.ts`，供 `GET /api/docs` 直接返回。
 *
 * 为什么在构建期生成而非运行时反射：
 * ① 说明文案的单一事实来源是代码里的 JSDoc——运行时 JS 已丢失注释，无法读取；
 * ② 无需引入 `DiscoveryService`/反射，运行时零开销，产物即数据；
 * ③ 与项目既有的 `prisma:comments` 生成式脚本风格一致。
 *
 * 用法：`npm run docs:gen`（已接入 `prebuild`，`npm run build` 会自动执行）。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_ROOT = resolve(__dirname, '..');
const SRC_DIR = join(API_ROOT, 'src');
/** 额外纳入扫描的非 controller 文件（内含 @Controller 的类，如健康检查）。 */
const EXTRA_FILES = [join(SRC_DIR, 'app.module.ts')];
const OUT_FILE = join(SRC_DIR, 'modules', 'docs', 'api-docs.generated.ts');
/** OpenAPI 3.0 导出文件（由同一份扫描数据重映射生成，供 Swagger UI / Postman / 代码生成使用）。 */
const OUT_OPENAPI = join(SRC_DIR, 'modules', 'docs', 'openapi.generated.ts');
/** 全局路由前缀（与 app.setup.ts 的 setGlobalPrefix 保持一致）。 */
const GLOBAL_PREFIX = 'api';

/** Nest HTTP 方法装饰器 → 标准方法名。 */
const HTTP_DECORATORS = new Map([
  ['Get', 'GET'],
  ['Post', 'POST'],
  ['Put', 'PUT'],
  ['Delete', 'DELETE'],
  ['Patch', 'PATCH'],
]);

/** 端点排序权重（同模块内按 读→写→删 排列）。 */
const METHOD_ORDER = { GET: 0, POST: 1, PUT: 2, PATCH: 3, DELETE: 4 };

/**
 * 无 `@OperationLog` 可推断模块名的控制器 → 模块名覆盖。
 * 说明：模块名默认取「操作日志里出现最多的 module」，但纯读控制器（仪表盘/健康检查）
 * 没有写操作，只能显式指定，避免回退成英文类名或整段类注释。
 */
const GROUP_OVERRIDES = {
  DashboardController: '仪表盘',
  HealthController: '系统',
  // 接口文档接口自身（GET /api/docs）也纳入清单，归入「接口文档」组
  DocsController: '接口文档',
};

/** 个别方法的说明覆盖（键为 `类名.方法名`）。 */
const SUMMARY_OVERRIDES = {
  'HealthController.health': '健康检查：返回服务名称、状态与服务器时间',
};

/** 模块展示顺序（未列出的模块排在最后，按名称排序）。 */
const GROUP_ORDER = [
  '仪表盘',
  '认证',
  '用户管理',
  '角色管理',
  '菜单管理',
  '部门管理',
  '字典管理',
  '参数管理',
  '日志管理',
  '文件管理',
  '代码生成',
  '个人中心',
  '接口文档',
  '系统',
];

/** 递归收集控制器源码文件。 */
function collectControllerFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...collectControllerFiles(full));
      continue;
    }
    if (name.endsWith('.controller.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** 读取节点上的装饰器（兼容不同 TS 版本的 API）。 */
function getDecorators(node) {
  if (typeof ts.getDecorators === 'function' && ts.canHaveDecorators(node)) {
    return ts.getDecorators(node) ?? [];
  }
  return node.decorators ?? [];
}

/** 取装饰器名（形如 `Get`），非标识符调用返回 null。 */
function decoratorName(dec) {
  if (ts.isCallExpression(dec.expression) && ts.isIdentifier(dec.expression.expression)) {
    return dec.expression.expression.text;
  }
  return null;
}

/** 取装饰器实参列表。 */
function decoratorArgs(dec) {
  return ts.isCallExpression(dec.expression) ? dec.expression.arguments : [];
}

/** 取装饰器实参中的全部字符串字面量。 */
function stringArgs(dec) {
  return decoratorArgs(dec)
    .filter((arg) => ts.isStringLiteral(arg))
    .map((arg) => arg.text);
}

/** 读取成员节点紧邻其前的 JSDoc 文本（多行折叠为一段）。 */
function leadingJsDoc(source, node) {
  const trivia = source.slice(node.getFullStart(), node.getStart());
  const match = trivia.match(/\/\*\*([\s\S]*?)\*\//);
  if (!match) {
    return '';
  }
  return match[1]
    .split('\n')
    .map((line) => line.replace(/^\s*\*?\s?/, '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

/**
 * 去掉说明末尾的句号。
 * 说明取自 JSDoc，源码里通常以「。」结尾；文档页展示（及任何消费方）都不需要结尾句号，
 * 这里统一裁掉**末尾一个**，句中句号保留（如「登录。 挂载频率限制：…」只去最后那个）。
 */
function stripTrailingPeriod(text) {
  return text.replace(/。\s*$/, '');
}

/** 拼接完整路径（自动补全局前缀、去除多余斜杠）。 */
function joinPath(controllerPath, methodPath) {
  const parts = [GLOBAL_PREFIX, controllerPath, methodPath]
    .map((seg) => (seg ?? '').replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);
  return `/${parts.join('/')}`;
}

/* ----------------------------- 请求 / 响应示例 ----------------------------- */

/** 示例用的主机地址（仅文档展示，不影响运行）。 */
const DOC_BASE_URL = 'http://localhost:3000';

/** 字段名 → 更贴合业务语义的示例值；未命中则按类型给通用值。 */
const SAMPLE_VALUES = {
  username: 'admin',
  password: '123456',
  oldPassword: '123456',
  newPassword: '123456',
  confirmPassword: '123456',
  nickname: '示例用户',
  email: 'demo@example.com',
  phone: '13800138000',
  remark: '示例备注',
  avatar: '/static/2026/avatar.png',
  url: 'https://example.com',
  roleIds: [1],
  menuIds: [1],
  deptIds: [1],
  roleName: '示例角色',
  roleCode: 'demo_role',
  menuName: '示例菜单',
  menuType: 'C',
  deptName: '示例部门',
  leader: '张三',
  dictName: '示例字典',
  dictType: 'sys_demo',
  dictLabel: '示例标签',
  dictValue: '1',
  gender: '1',
  columnOptions: [],
  configName: '示例参数',
  configKey: 'sys.demo.key',
  configValue: '示例值',
  tableName: 'sys_config',
  moduleName: 'demo',
  businessName: 'demo',
  author: '作者',
  isTree: false,
  overwrite: false,
  days: 7,
  hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  captchaId: 'b7f3c1a2-0000-4a1b-9c3d-8e6f5a4b3c2d',
  captchaCode: 'A1B2',
  refreshToken: '<登录返回的 refreshToken>',
  originName: 'demo.png',
  minSize: 0,
  maxSize: 5242880,
  startTime: '2026-10-01 00:00:00',
  endTime: '2026-10-18 23:59:59',
};

/** 收集 DTO 源文件。 */
function collectDtoFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...collectDtoFiles(full));
      continue;
    }
    if (name.endsWith('.dto.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** 解析 DTO 文件：类名 → 字段定义列表（名称 / 类型 / 是否可选 / JSDoc）。 */
function parseDtoFile(file, into) {
  const source = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  sf.forEachChild((node) => {
    if (!ts.isClassDeclaration(node) || !node.name) {
      return;
    }
    const fields = [];
    for (const member of node.members) {
      if (!ts.isPropertyDeclaration(member) || !member.name) {
        continue;
      }
      const name = member.name.getText(sf);
      if (!name || name.startsWith('_')) {
        continue;
      }
      fields.push({
        name,
        type: member.type ? member.type.getText(sf) : 'unknown',
        optional: getDecorators(member).some((dec) => decoratorName(dec) === 'IsOptional'),
        comment: leadingJsDoc(source, member),
      });
    }
    if (fields.length) {
      into.set(node.name.text, fields);
    }
  });
}

/** 字段是否数组类型。 */
function isArrayType(type) {
  return /\[\]$/.test(type) || /^Array</.test(type);
}

/** 按字段名 / 类型生成示例值。 */
function sampleValue(field) {
  const byName = SAMPLE_VALUES[field.name];
  if (byName !== undefined) {
    return byName;
  }
  if (isArrayType(field.type)) {
    return [];
  }
  if (field.type === 'number' || field.type === 'bigint') {
    return 1;
  }
  if (field.type === 'boolean') {
    return true;
  }
  // 未登记的字段一律用中性占位值：截断的 JSDoc 片段（如「性别（字典 sys_us」）既不准确也不好读
  return '示例值';
}

/** DTO → 示例对象（列出全部字段，可选字段一并给出，便于看清可接受的形状）。 */
function sampleFromDto(fields) {
  const out = {};
  for (const field of fields) {
    out[field.name] = sampleValue(field);
  }
  return out;
}

/** 取出控制器方法上 `@Body()` / `@Query()` 使用的 DTO 类名。 */
function methodDtoParams(sf, member) {
  const out = { body: null, query: null };
  for (const param of member.parameters ?? []) {
    const names = getDecorators(param).map(decoratorName);
    if (!param.type || !ts.isTypeReferenceNode(param.type)) {
      continue;
    }
    const typeName = param.type.typeName.getText(sf);
    if (names.includes('Body')) {
      out.body = typeName;
    } else if (names.includes('Query')) {
      out.query = typeName;
    }
  }
  return out;
}

/** 路径参数名（`http/detail/:id` → `['id']`）。 */
function pathParamNames(path) {
  return [...path.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => m[1]);
}

/** 路径参数示例值。 */
function pathParamSample(name) {
  const value = SAMPLE_VALUES[name];
  return String(value ?? 1);
}

/** 拼 curl 示例。 */
function buildCurl({ method, url, isPublic, body }) {
  const parts = [`curl -X ${method} "${url}"`];
  if (!isPublic) {
    parts.push(`  -H "Authorization: Bearer <accessToken>"`);
  }
  if (body) {
    parts.push('  -H "Content-Type: application/json"');
  }
  const cmd = parts.join(' \\\n');
  if (!body) {
    return cmd;
  }
  return `${cmd} \\\n  -d '${JSON.stringify(body, null, 2).split('\n').join('\n    ')}'`;
}

/**
 * 组装单个接口的示例数据。
 * @returns 请求示例（curl / 路径参数 / 查询 / 请求体）；响应示例由运行时契约库补全
 */
function buildExamples({ method, fullPath, isPublic, bodyDto, queryDto, dtoMap, isRaw }) {
  const pathParams = pathParamNames(fullPath);
  const pathExample = {};
  for (const name of pathParams) {
    pathExample[name] = pathParamSample(name);
  }
  const concretePath = fullPath.replace(/:([A-Za-z0-9_]+)/g, (_, name) => pathParamSample(name));

  let body;
  if (bodyDto && dtoMap.has(bodyDto)) {
    body = sampleFromDto(dtoMap.get(bodyDto));
  }

  const query = {};
  if (queryDto && dtoMap.has(queryDto)) {
    Object.assign(query, sampleFromDto(dtoMap.get(queryDto)));
  } else if (method === 'GET' && pathParams.length === 0 && !isRaw) {
    // 无 DTO 的列表类 GET：给出最通用的分页参数作为示例
    Object.assign(query, { page: 1, pageSize: 10 });
  }

  const queryString = Object.entries(query)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');
  const url = `${DOC_BASE_URL}${concretePath}${queryString ? `?${queryString}` : ''}`;

  return {
    curl: buildCurl({ method, url, isPublic, body }),
    pathParams: Object.keys(pathExample).length ? pathExample : undefined,
    query: Object.keys(query).length ? query : undefined,
    requestBody: body,
    isRawResponse: isRaw || undefined,
  };
}

/** 解析单个控制器源码文件为若干分组片段。 */
function parseControllerFile(file, dtoMap) {
  const source = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const found = [];

  sf.forEachChild((node) => {
    if (!ts.isClassDeclaration(node)) {
      return;
    }
    const classDecorators = getDecorators(node);
    const controllerDec = classDecorators.find((dec) => decoratorName(dec) === 'Controller');
    if (!controllerDec) {
      return;
    }
    const controllerPath = stringArgs(controllerDec)[0] ?? '';
    const classJsDoc = leadingJsDoc(source, node);
    const className = node.name?.text ?? '';

    const endpoints = [];
    const moduleNames = [];

    for (const member of node.members) {
      if (!ts.isMethodDeclaration(member)) {
        continue;
      }
      const decorators = getDecorators(member);
      const httpDec = decorators.find((dec) => HTTP_DECORATORS.has(decoratorName(dec)));
      if (!httpDec) {
        continue;
      }
      const method = HTTP_DECORATORS.get(decoratorName(httpDec));
      const methodPath = stringArgs(httpDec)[0] ?? '';

      // 权限码 / 公开标记 / 操作日志语义
      const permDec = decorators.find((dec) => decoratorName(dec) === 'RequirePermissions');
      const permission = permDec ? stringArgs(permDec) : [];
      const isPublic = decorators.some((dec) => decoratorName(dec) === 'Public');
      const opDec = decorators.find((dec) => decoratorName(dec) === 'OperationLog');
      const opArgs = opDec ? stringArgs(opDec) : [];
      if (opArgs[0]) {
        moduleNames.push(opArgs[0]);
      }
      const action = opArgs.length ? `${opArgs[0]}${opArgs[1] ? ` · ${opArgs[1]}` : ''}` : '';

      const methodName = member.name?.text ?? '';

      // 示例：请求侧（curl / 路径参数 / 查询 / 请求体）由 DTO 自动合成；
      // 响应侧由运行时的契约示例库（src/modules/docs/api-examples.ts）补全。
      const isRaw = decorators.some((dec) => decoratorName(dec) === 'RawResponse');
      const fullPath = joinPath(controllerPath, methodPath);
      const { body: bodyDto, query: queryDto } = methodDtoParams(sf, member);
      const examples = buildExamples({ method, fullPath, isPublic, bodyDto, queryDto, dtoMap, isRaw });

      endpoints.push({
        method,
        path: fullPath,
        summary: stripTrailingPeriod(SUMMARY_OVERRIDES[`${className}.${methodName}`] ?? leadingJsDoc(source, member)),
        permission,
        isPublic,
        action,
        examples,
        // 以下为生成期内部字段，供 OpenAPI 导出重映射使用，不进入对外产物（buildSource 已剥离）
        bodyDto,
        queryDto,
        isRaw,
      });
    }

    if (!endpoints.length) {
      return;
    }

    // 模块名：显式覆盖 > 操作日志里出现最多的 module 名 > 类 JSDoc > 类名。
    const group = GROUP_OVERRIDES[className] ?? pickGroup(moduleNames, classJsDoc, className);
    found.push({ group, endpoints });
  });

  return found;
}

/** 推断模块展示名。 */
function pickGroup(moduleNames, classJsDoc, className) {
  if (moduleNames.length) {
    const tally = new Map();
    for (const name of moduleNames) {
      tally.set(name, (tally.get(name) ?? 0) + 1);
    }
    return [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }
  const fromJsDoc = classJsDoc
    .replace(/控制器$/, '')
    .replace(/。$/, '')
    .trim();
  if (fromJsDoc) {
    return fromJsDoc;
  }
  return className.replace(/Controller$/, '') || '其它';
}

/** 生成 TypeScript 源码。 */
function buildSource(groups) {
  // 仅保留对外字段，剥离生成期内部字段（bodyDto / queryDto / isRaw），避免泄漏到产物
  const publicGroups = groups.map((g) => ({
    group: g.group,
    endpoints: g.endpoints.map((e) => ({
      method: e.method,
      path: e.path,
      summary: e.summary,
      permission: e.permission,
      isPublic: e.isPublic,
      action: e.action,
      examples: e.examples,
    })),
  }));
  const body = JSON.stringify(publicGroups, null, 2);
  return `/**
 * 接口文档数据（自动生成，请勿手工编辑）。
 *
 * 由 \`scripts/gen-api-docs.mjs\` 在构建期扫描控制器产出；修改接口后请重新执行
 * \`npm run docs:gen\`（\`npm run build\` 的 prebuild 已自动接入）。
 */
import type { ApiDocGroup } from './docs.types.js';

export const API_DOCS: ApiDocGroup[] = ${body};
`;
}

/* ----------------------------- OpenAPI 3.0 导出 ----------------------------- */

/**
 * 由同一份扫描数据重映射为 OpenAPI 3.0.3 文档。
 *
 * 设计取舍：
 * - 请求侧（参数 / 请求体）直接来自已解析的 DTO，字段类型映射为 OpenAPI schema；
 * - 响应统一信封 `{ code, message, data }` 由 `envelopeSchema` 建模，`data` 的类型做**最佳推断**：
 *   写操作（POST/PUT/PATCH）带回参实体时引用请求 DTO schema；列表类 GET 给通用分页信封；其余为自由对象；
 * - 具体的响应**示例值**由运行时 `api-examples.ts` 注入（见 docs.controller 的 openapi.json 端点），
 *   因此此处只用 schema 描述形状、用 example 描述字段样例。
 */
function buildOpenApi(groups, dtoMap, version) {
  const paths = {};
  const schemas = {};

  const innerSchema = (raw, dm, sc) => {
    const t = raw.trim();
    if (t === 'number' || t === 'float' || t === 'double' || t === 'decimal') return { type: 'number' };
    if (t === 'bigint' || t === 'integer' || t === 'int') return { type: 'integer' };
    if (t === 'boolean') return { type: 'boolean' };
    if (t === 'Date') return { type: 'string', format: 'date-time' };
    if (t === 'string') return { type: 'string' };
    if (dm.has(t)) {
      ensureSchema(t, dm, sc);
      return { $ref: `#/components/schemas/${t}` };
    }
    return { type: 'string' };
  };

  const schemaForField = (f, dm, sc) => {
    const t = (f.type || 'unknown').trim();
    let base;
    if (t.endsWith('[]')) {
      base = { type: 'array', items: innerSchema(t.slice(0, -2), dm, sc) };
    } else {
      const arr = t.match(/^Array<(.+)>$/);
      if (arr) base = { type: 'array', items: innerSchema(arr[1], dm, sc) };
      else base = innerSchema(t, dm, sc);
    }
    if (!base.$ref) {
      if (f.comment) base.description = f.comment;
      const ex = sampleValue(f);
      if (ex !== undefined && ex !== '') base.example = ex;
    }
    return base;
  };

  const ensureSchema = (className, dm, sc) => {
    if (sc[className]) return;
    const fields = dm.get(className);
    if (!fields) return;
    sc[className] = { type: 'object', properties: {}, required: [] }; // 占位，避免自引用死循环
    for (const f of fields) {
      sc[className].properties[f.name] = schemaForField(f, dm, sc);
      if (!f.optional) sc[className].required.push(f.name);
    }
    if (!sc[className].required.length) delete sc[className].required;
  };

  const dataSchemaFor = (ep, dm, sc) => {
    if (ep.bodyDto && dm.has(ep.bodyDto) && ['POST', 'PUT', 'PATCH'].includes(ep.method)) {
      ensureSchema(ep.bodyDto, dm, sc);
      return { $ref: `#/components/schemas/${ep.bodyDto}` };
    }
    if (ep.method === 'GET' && !ep.bodyDto) {
      return {
        type: 'object',
        properties: {
          list: { type: 'array', items: {} },
          total: { type: 'integer', example: 0 },
          page: { type: 'integer', example: 1 },
          pageSize: { type: 'integer', example: 10 },
        },
      };
    }
    return {};
  };

  const envelopeSchema = (ep, dm, sc) => ({
    type: 'object',
    properties: {
      code: { type: 'integer', example: 0, description: '业务码，0 表示成功' },
      message: { type: 'string', example: 'success' },
      data: dataSchemaFor(ep, dm, sc),
    },
    required: ['code', 'message', 'data'],
  });

  for (const { group, endpoints } of groups) {
    for (const ep of endpoints) {
      const oasPath = ep.path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
      const op = {};
      op.tags = [group];
      if (ep.summary) op.summary = ep.summary;
      op.operationId = `${ep.method.toLowerCase()}_${ep.path.replace(/[^a-zA-Z0-9]/g, '_')}`;

      const params = [];
      for (const name of pathParamNames(ep.path)) {
        params.push({ name, in: 'path', required: true, schema: { type: 'string' }, description: `路径参数 ${name}` });
      }
      if (ep.queryDto && dtoMap.has(ep.queryDto)) {
        for (const f of dtoMap.get(ep.queryDto)) {
          const p = { name: f.name, in: 'query', required: !f.optional, schema: schemaForField(f, dtoMap, schemas) };
          if (f.comment) p.description = f.comment;
          params.push(p);
        }
      } else if (ep.method === 'GET' && pathParamNames(ep.path).length === 0 && !ep.isRaw) {
        params.push({
          name: 'page',
          in: 'query',
          required: false,
          schema: { type: 'integer', default: 1 },
          description: '页码',
        });
        params.push({
          name: 'pageSize',
          in: 'query',
          required: false,
          schema: { type: 'integer', default: 10 },
          description: '每页条数',
        });
      }
      if (params.length) op.parameters = params;

      if (ep.bodyDto && dtoMap.has(ep.bodyDto)) {
        ensureSchema(ep.bodyDto, dtoMap, schemas);
        op.requestBody = {
          required: true,
          content: { 'application/json': { schema: { $ref: `#/components/schemas/${ep.bodyDto}` } } },
        };
      }

      if (ep.isRaw) {
        op.responses = {
          200: {
            description: '文件流（CSV / ZIP / 附件），响应体为二进制，无 JSON 信封',
            content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
          },
        };
      } else {
        op.responses = {
          200: {
            description: '成功（统一信封 { code, message, data }）',
            content: { 'application/json': { schema: envelopeSchema(ep, dtoMap, schemas) } },
          },
        };
      }

      if (!ep.isPublic) op.security = [{ bearerAuth: [] }];
      paths[oasPath] = paths[oasPath] || {};
      paths[oasPath][ep.method.toLowerCase()] = op;
    }
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'LY Admin API',
      version,
      description: 'LY Admin 后台接口（OpenAPI 3.0 导出）。所有成功响应统一包装为 { code, message, data }。',
    },
    servers: [{ url: DOC_BASE_URL, description: '本地开发环境' }],
    tags: groups.map((g) => ({ name: g.group })),
    paths,
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas,
    },
  };
}

/** 生成 OpenAPI 文档的 TypeScript 源码。 */
function buildOpenApiSource(doc) {
  const body = JSON.stringify(doc, null, 2);
  return `/**
 * OpenAPI 3.0 文档（自动生成，请勿手工编辑）。
 *
 * 由 \`scripts/gen-api-docs.mjs\` 在构建期从同一份控制器/DTO 扫描数据重映射生成；
 * 运行时由 \`docs.controller\` 的 \`GET /api/docs/openapi.json\` 注入响应示例后返回。
 * 可用于 Swagger UI / Redoc / Postman 导入 / 客户端代码生成。
 */
export const OPENAPI_DOC: Record<string, unknown> = ${body};
`;
}

/** 主流程。 */
function main() {
  // DTO 索引：请求示例（请求体 / 查询参数）据此自动合成，避免手工抄字段
  const dtoMap = new Map();
  for (const file of collectDtoFiles(SRC_DIR)) {
    parseDtoFile(file, dtoMap);
  }

  const files = collectControllerFiles(SRC_DIR).concat(EXTRA_FILES.filter((f) => existsSync(f)));
  const collected = [];
  for (const file of files) {
    collected.push(...parseControllerFile(file, dtoMap));
  }

  // 合并同名模块
  const merged = new Map();
  for (const group of collected) {
    const existing = merged.get(group.group) ?? [];
    existing.push(...group.endpoints);
    merged.set(group.group, existing);
  }

  const rank = (name) => {
    const idx = GROUP_ORDER.indexOf(name);
    return idx === -1 ? GROUP_ORDER.length : idx;
  };
  const groups = [...merged.entries()]
    .map(([group, endpoints]) => ({
      group,
      endpoints: endpoints.sort(
        (a, b) => METHOD_ORDER[a.method] - METHOD_ORDER[b.method] || a.path.localeCompare(b.path),
      ),
    }))
    .sort((a, b) => rank(a.group) - rank(b.group) || a.group.localeCompare(b.group));

  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, buildSource(groups), 'utf8');

  // OpenAPI 3.0 导出：同一份扫描数据的规范重映射
  const pkg = JSON.parse(readFileSync(join(API_ROOT, 'package.json'), 'utf8'));
  const openapiDoc = buildOpenApi(groups, dtoMap, pkg.version || '1.0.0');
  mkdirSync(dirname(OUT_OPENAPI), { recursive: true });
  writeFileSync(OUT_OPENAPI, buildOpenApiSource(openapiDoc), 'utf8');

  const total = groups.reduce((sum, g) => sum + g.endpoints.length, 0);
  console.log(
    `[ApiDocs] 已生成 ${groups.length} 个模块 / ${total} 个接口（解析 ${dtoMap.size} 个 DTO）→ ${OUT_FILE} 与 ${OUT_OPENAPI}`,
  );
}

main();
