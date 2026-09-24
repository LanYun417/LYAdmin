/**
 * 接口文档页面渲染器。
 * 模块职责：把 catalog 数据渲染为「自包含」HTML 字符串——CSS 与 JS 全部内联，
 * 零第三方依赖、零外链资源（无 CDN / 外部字体 / 外部图标），离线可用。
 *
 * 页面能力：
 * - 顶部 sticky 头部（标题 + 接口总数 + 搜索 + 目录按钮 + 展开/收起）；
 * - 左侧 sticky 目录（按模块分组，方法徽标 + 路径，滚动高亮）；
 * - 右侧内容区（模块标题 + 接口卡片，默认折叠）；
 * - 响应式：<900px 目录变为滑出面板（遮罩 / ESC 关闭），任何宽度下无横向溢出；
 * - 滚动条优化（页面 / 目录 / 代码块三处）；
 * - 路径与示例代码块复制、返回顶部、搜索过滤、scroll-spy、键盘可操作与 aria 标注。
 */
import * as fs from 'fs';
import * as path from 'path';
import { DOC_TITLE, ENDPOINT_TOTAL, GENERAL, MODULES, type EndpointDoc, type ParamDoc } from '@/docs/catalog';

/**
 * 文档页 favicon：直接复用后台管理系统的 favicon.ico，以内联 data URI 形式嵌入页面，
 * 保证页面零外链、离线可用，且始终与后台图标保持一致。
 * 模块加载时读取一次；文件缺失（如独立部署 api 时）则降级为空字符串（无 favicon）。
 */
const FAVICON_DATA_URI = (() => {
  try {
    const faviconPath = path.resolve(__dirname, '../../../admin/public/favicon.ico');
    return `data:image/x-icon;base64,${fs.readFileSync(faviconPath).toString('base64')}`;
  } catch {
    return '';
  }
})();

/** HTML 转义，防止内容破坏结构。 */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 将多行文本渲染为逐行段落（保留换行语义）。 */
function renderLines(text: string): string {
  return text
    .split('\n')
    .map((line) => `<p class="plain-line">${escapeHtml(line) || '&nbsp;'}</p>`)
    .join('');
}

/** 方法徽标样式后缀。 */
function methodClass(method: string): string {
  return `method-${method.toLowerCase()}`;
}

/** 渲染单个参数表格。 */
function renderParamTable(title: string, params: ParamDoc[] | undefined): string {
  if (!params || params.length === 0) {
    return '';
  }
  const rows = params
    .map((param) => {
      const requiredMark = param.required ? '<span class="req">必填</span>' : '<span class="opt">可选</span>';
      const def = param.default !== undefined ? `<code>${escapeHtml(param.default)}</code>` : '—';
      return [
        '<tr>',
        `<td class="col-name"><code>${escapeHtml(param.name)}</code></td>`,
        `<td class="col-type">${escapeHtml(param.type)}</td>`,
        `<td class="col-required">${requiredMark}</td>`,
        `<td class="col-desc">${escapeHtml(param.description)}</td>`,
        `<td class="col-default">${def}</td>`,
        '</tr>',
      ].join('');
    })
    .join('');

  return [
    '<div class="param-block">',
    `<h5 class="param-title">${escapeHtml(title)}</h5>`,
    '<div class="table-scroll">',
    '<table class="params">',
    '<thead><tr><th>名称</th><th>类型</th><th>必填</th><th>说明</th><th>默认值</th></tr></thead>',
    `<tbody>${rows}</tbody>`,
    '</table>',
    '</div>',
    '</div>',
  ].join('');
}

/** 渲染带复制按钮的代码块。 */
function renderCodeBlock(label: string, id: string, content: string, lang: string): string {
  if (!content) {
    return '';
  }
  return [
    '<div class="code-wrap">',
    '<div class="code-head">',
    `<span class="code-label">${escapeHtml(label)}</span>`,
    `<button class="copy-btn" type="button" data-copy="${escapeHtml(id)}" aria-label="复制${escapeHtml(label)}">复制</button>`,
    '</div>',
    `<pre class="code-block" id="${escapeHtml(id)}" tabindex="0" data-lang="${escapeHtml(lang)}"><code>${escapeHtml(
      content,
    )}</code></pre>`,
    '</div>',
  ].join('');
}

/** 渲染单个接口卡片。 */
function renderEndpoint(ep: EndpointDoc, index: number): string {
  const id = `ep-${index}`;
  const bodyId = `${id}-body`;
  const pathId = `${id}-path`;
  const reqId = `${id}-req`;
  const resId = `${id}-res`;

  const badges: string[] = [];
  badges.push(
    ep.auth ? '<span class="badge badge-auth">需登录</span>' : '<span class="badge badge-public">公开</span>',
  );
  if (ep.permission) {
    badges.push(`<span class="badge badge-perm">${escapeHtml(ep.permission)}</span>`);
  }

  const searchText = `${ep.method} ${ep.path} ${ep.summary} ${ep.permission ?? ''}`.toLowerCase();

  const parts: string[] = [];
  parts.push(`<article class="card" id="${id}" data-search="${escapeHtml(searchText)}" data-method="${ep.method}">`);
  parts.push(
    [
      `<button class="card-head" type="button" aria-expanded="false" aria-controls="${bodyId}">`,
      `<span class="method ${methodClass(ep.method)}">${ep.method}</span>`,
      `<span class="card-path"><code>${escapeHtml(ep.path)}</code></span>`,
      `<span class="card-summary">${escapeHtml(ep.summary)}</span>`,
      `<span class="card-badges">${badges.join('')}</span>`,
      '<span class="chev" aria-hidden="true">',
      '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      '</span>',
      '</button>',
    ].join(''),
  );

  parts.push(`<div class="card-body" id="${bodyId}">`);

  if (ep.description) {
    parts.push(`<p class="card-desc">${escapeHtml(ep.description)}</p>`);
  }

  parts.push(
    [
      '<div class="path-row">',
      '<span class="path-label">请求地址</span>',
      `<code class="path-text" id="${pathId}">${escapeHtml(GENERAL.baseUrl + ep.path)}</code>`,
      `<button class="copy-btn" type="button" data-copy="${pathId}" aria-label="复制请求地址">复制</button>`,
      `<span class="ct-tag">${escapeHtml(ep.contentType)}</span>`,
      '</div>',
    ].join(''),
  );

  parts.push(renderParamTable('路径参数', ep.pathParams));
  parts.push(renderParamTable('查询参数', ep.queryParams));
  parts.push(renderParamTable('请求体参数', ep.bodyParams));

  parts.push(renderCodeBlock('请求示例', reqId, ep.requestExample ?? '', 'bash'));
  parts.push(renderCodeBlock('响应示例', resId, ep.responseExample ?? '', 'json'));

  if (ep.notes) {
    parts.push(`<div class="notes"><span class="notes-title">说明</span>${renderLines(ep.notes)}</div>`);
  }

  parts.push('</div>');
  parts.push('</article>');
  return parts.join('');
}

/** 渲染模块分组。 */
function renderModule(module: (typeof MODULES)[number], startIndex: number): { html: string; nextIndex: number } {
  let index = startIndex;
  const cards = module.endpoints
    .map((ep) => {
      const html = renderEndpoint(ep, index);
      index += 1;
      return html;
    })
    .join('');

  const html = [
    `<section class="module" id="module-${escapeHtml(module.key)}">`,
    '<div class="module-head">',
    `<h2 class="module-title">${escapeHtml(module.name)}</h2>`,
    `<span class="module-count">${module.endpoints.length} 个接口</span>`,
    '</div>',
    module.description ? `<p class="module-desc">${escapeHtml(module.description)}</p>` : '',
    `<div class="module-cards">${cards}</div>`,
    '</section>',
  ].join('');

  return { html, nextIndex: index };
}

/** 渲染左侧目录。 */
function renderToc(
  anchors: Array<{
    moduleKey: string;
    moduleName: string;
    items: Array<{ id: string; method: string; name: string; path: string }>;
  }>,
): string {
  const groups = anchors
    .map((group) => {
      const items = group.items
        .map(
          (item) =>
            `<a class="toc-item" href="#${item.id}" data-target="${item.id}" title="${escapeHtml(item.path)}"><span class="method method-sm ${methodClass(
              item.method,
            )}">${item.method}</span><span class="toc-name">${escapeHtml(item.name)}</span></a>`,
        )
        .join('');
      return [
        '<div class="toc-group">',
        `<div class="toc-group-title">${escapeHtml(group.moduleName)}</div>`,
        items,
        '</div>',
      ].join('');
    })
    .join('');
  return groups;
}

/** 渲染错误码表。 */
function renderErrorCodes(): string {
  const rows = GENERAL.errorCodes
    .map(
      (item) =>
        `<tr><td class="col-code"><span class="code-pill code-${item.code}">${item.code}</span></td><td>${escapeHtml(
          item.message,
        )}</td><td>${escapeHtml(item.description)}</td></tr>`,
    )
    .join('');
  return [
    '<div class="table-scroll">',
    '<table class="params error-table">',
    '<thead><tr><th>错误码</th><th>提示文案</th><th>触发场景</th></tr></thead>',
    `<tbody>${rows}</tbody>`,
    '</table>',
    '</div>',
  ].join('');
}

/** 渲染通用说明区块。 */
function renderGeneral(): string {
  const conventions = GENERAL.conventions.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  return [
    '<section class="general" id="general">',
    '<div class="module-head">',
    '<h2 class="module-title">通用说明</h2>',
    '<span class="module-count">约定</span>',
    '</div>',
    '<div class="general-grid">',
    '<div class="general-card">',
    '<h3>服务基地址</h3>',
    `<p><code>${escapeHtml(GENERAL.baseUrl)}</code></p>`,
    '<h3>认证方式</h3>',
    `<div class="general-text">${renderLines(GENERAL.auth)}</div>`,
    '<h3>统一响应体</h3>',
    `<div class="general-text">${renderLines(GENERAL.responseFormat)}</div>`,
    '<h3>分页约定</h3>',
    `<div class="general-text">${renderLines(GENERAL.pagination)}</div>`,
    '<h3>静态资源与图片压缩</h3>',
    `<div class="general-text">${renderLines(GENERAL.staticAssets)}</div>`,
    '<h3>其它约定</h3>',
    `<ul class="conventions">${conventions}</ul>`,
    '</div>',
    '<div class="general-card">',
    '<h3>错误码表</h3>',
    renderErrorCodes(),
    '</div>',
    '</div>',
    '</section>',
  ].join('');
}

/**
 * 渲染完整文档页面。
 * @returns 自包含的 HTML 字符串
 */
export function renderDocsHtml(): string {
  const anchors: Array<{
    moduleKey: string;
    moduleName: string;
    items: Array<{ id: string; method: string; name: string; path: string }>;
  }> = [];
  const moduleHtmlParts: string[] = [];
  let index = 0;

  MODULES.forEach((module) => {
    const { html, nextIndex } = renderModule(module, index);
    const items = module.endpoints.map((ep, offset) => ({
      id: `ep-${index + offset}`,
      method: ep.method,
      name: ep.summary,
      path: ep.path,
    }));
    anchors.push({ moduleKey: module.key, moduleName: module.name, items });
    moduleHtmlParts.push(html);
    index = nextIndex;
  });

  const toc = renderToc(anchors);
  const content = `${renderGeneral()}${moduleHtmlParts.join('')}`;
  const moduleCount = MODULES.length;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>${escapeHtml(DOC_TITLE)}</title>
<link rel="icon" href="${FAVICON_DATA_URI}" />
<style>
:root {
  --primary: #409eff;
  --primary-600: #337ecc;
  --primary-soft: #ecf5ff;
  --get: #409eff;
  --post: #67c23a;
  --put: #e6a23c;
  --delete: #f56c6c;
  --bg: #f5f7fa;
  --panel: #ffffff;
  --text: #303133;
  --text-2: #606266;
  --text-3: #909399;
  --border: #e4e7ed;
  --border-2: #ebeef5;
  --code-bg: #f6f8fa;
  --code-text: #24292f;
  --radius: 8px;
  --shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 6px 24px rgba(0, 0, 0, 0.10);
  --header-h: 64px;
  --sidebar-w: 280px;
  --font: system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
  --mono: ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
}
* { box-sizing: border-box; }
html {
  scroll-behavior: smooth;
}
/* Firefox 滚动条：对所有元素统一为细滚动条，与页面一致 */
* {
  scrollbar-width: thin;
  scrollbar-color: #c1c6cf transparent;
}
body {
  margin: 0;
  font-family: var(--font);
  color: var(--text);
  background: var(--bg);
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
/* WebKit 滚动条优化（页面级） */
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background-color: #c1c6cf;
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: content-box;
}
::-webkit-scrollbar-thumb:hover { background-color: #9aa3af; background-clip: content-box; }
::-webkit-scrollbar-corner { background: transparent; }

code, pre, .mono { font-family: var(--mono); }
a { color: var(--primary); text-decoration: none; }

.is-hidden { display: none !important; }

/* ===== 顶部栏 ===== */
.topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: saturate(180%) blur(8px);
  border-bottom: 1px solid var(--border-2);
}
.topbar-inner {
  height: var(--header-h);
  padding: 0 24px;
  display: flex;
  align-items: center;
  gap: 16px;
}
.menu-btn {
  display: none;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--panel);
  color: var(--text-2);
  cursor: pointer;
}
.brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
.brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--primary), var(--primary-600));
  color: #fff;
  font-weight: 700;
  font-size: 15px;
  flex: 0 0 auto;
  box-shadow: var(--shadow);
}
.brand h1 { font-size: 17px; margin: 0; font-weight: 700; white-space: nowrap; }
.brand-sub { margin: 0; font-size: 12px; color: var(--text-3); white-space: nowrap; }
.search-wrap {
  margin-left: auto;
  position: relative;
  display: flex;
  align-items: center;
  min-width: 200px;
  max-width: 360px;
  flex: 1 1 240px;
}
.search-wrap svg { position: absolute; left: 12px; color: var(--text-3); pointer-events: none; }
.search-input {
  width: 100%;
  height: 40px;
  padding: 0 36px 0 36px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--panel);
  font-size: 14px;
  color: var(--text);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.search-input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.15); }
.search-clear {
  position: absolute;
  right: 8px;
  border: 0;
  background: transparent;
  color: var(--text-3);
  font-size: 16px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 6px;
}
.search-clear:hover { background: var(--border-2); color: var(--text); }
.topbar-actions { display: flex; gap: 8px; flex: 0 0 auto; }
.btn {
  height: 40px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--panel);
  color: var(--text-2);
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.btn:hover { border-color: var(--primary); color: var(--primary); }
.btn:focus-visible, .menu-btn:focus-visible, .copy-btn:focus-visible,
.toc-item:focus-visible, .card-head:focus-visible, .search-clear:focus-visible, .back-top:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

/* ===== 布局 ===== */
.layout {
  display: flex;
  gap: 0;
  align-items: stretch;
  min-height: calc(100vh - var(--header-h));
}
.sidebar {
  position: sticky;
  top: var(--header-h);
  align-self: flex-start;
  width: var(--sidebar-w);
  flex: 0 0 var(--sidebar-w);
  height: calc(100vh - var(--header-h));
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--panel);
  border-right: 1px solid var(--border-2);
  border-radius: 0;
  padding: 16px 12px;
}
/* 目录滚动条：沿用全局 ::-webkit-scrollbar 样式，与页面滚动条一致 */
.toc-group { margin-bottom: 10px; }
.toc-group:last-child { margin-bottom: 0; }
.toc-group-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3);
  text-transform: none;
  letter-spacing: 0.02em;
  padding: 8px 8px 6px;
}
.toc-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  color: var(--text-2);
  font-size: 13px;
  line-height: 1.4;
}
.toc-item:hover { background: var(--primary-soft); color: var(--primary-600); }
.toc-item.active { background: var(--primary-soft); color: var(--primary-600); font-weight: 600; }
.toc-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.toc-item .method-sm { flex: 0 0 auto; }

.content { flex: 1 1 auto; min-width: 0; padding: 24px 32px 48px; }

/* ===== 方法徽标 ===== */
.method {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--mono);
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 0.03em;
  padding: 3px 8px;
  border-radius: 6px;
  color: #fff;
  min-width: 52px;
}
.method-sm { min-width: 54px; font-size: 11px; padding: 3px 8px; }
.method-get { background: var(--get); }
.method-post { background: var(--post); }
.method-put { background: var(--put); }
.method-delete { background: var(--delete); }

/* ===== 通用说明 ===== */
.general { margin-bottom: 28px; }
.general-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.general-card {
  background: var(--panel);
  border: 1px solid var(--border-2);
  border-radius: var(--radius);
  padding: 18px 20px;
  box-shadow: var(--shadow);
}
.general-card h3 {
  font-size: 14px;
  margin: 0 0 8px;
  color: var(--text);
  padding-left: 10px;
  border-left: 3px solid var(--primary);
}
.general-card h3:not(:first-child) { margin-top: 18px; }
.general-card p { margin: 4px 0; color: var(--text-2); }
.general-text .plain-line { margin: 2px 0; color: var(--text-2); font-size: 13px; }
.conventions { margin: 6px 0 0; padding-left: 18px; color: var(--text-2); font-size: 13px; }
.conventions li { margin: 4px 0; }
.general-card code, .path-text, .params code {
  background: var(--code-bg);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 12.5px;
  color: #c7254e;
  word-break: break-all;
}

/* ===== 模块与卡片 ===== */
.module { margin-bottom: 28px; }
.module-head { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
.module-title { font-size: 18px; margin: 0; font-weight: 700; }
.module-count {
  font-size: 12px;
  color: var(--text-3);
  background: var(--border-2);
  padding: 2px 10px;
  border-radius: 999px;
}
.module-desc { margin: 0 0 14px; color: var(--text-3); font-size: 13px; }
.module-cards { display: flex; flex-direction: column; gap: 12px; }

.card {
  background: var(--panel);
  border: 1px solid var(--border-2);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
  scroll-margin-top: calc(var(--header-h) + 16px);
  transition: box-shadow 0.18s, border-color 0.18s;
}
.card:hover { box-shadow: var(--shadow-lg); }
.card.open { border-color: #d3e3fb; }
.card-head {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  border: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font: inherit;
  color: inherit;
}
.card-head:hover { background: #fafbfc; }
.card-path { font-size: 13.5px; font-weight: 600; color: var(--text); word-break: break-all; }
.card-summary { color: var(--text-3); font-size: 13px; }
.card-badges { margin-left: auto; display: flex; gap: 6px; flex: 0 0 auto; }
.badge { font-size: 11px; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
.badge-auth { background: #fdf6ec; color: #b88230; }
.badge-public { background: #eef9ec; color: #529b2e; }
.badge-perm { background: #ecf5ff; color: var(--primary-600); font-family: var(--mono); }
.chev { color: var(--text-3); display: inline-flex; transition: transform 0.2s; flex: 0 0 auto; }
.card.open .chev { transform: rotate(180deg); }

.card-body {
  display: none;
  padding: 4px 16px 18px;
  border-top: 1px solid var(--border-2);
}
.card.open .card-body { display: block; }
.card-desc { color: var(--text-2); margin: 12px 0; }

.path-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 12px;
  background: var(--code-bg);
  border: 1px solid var(--border-2);
  border-radius: var(--radius);
  margin: 12px 0;
}
.path-label { font-size: 12px; color: var(--text-3); flex: 0 0 auto; }
.path-text { font-size: 12.5px; background: transparent !important; color: var(--text) !important; padding: 0 !important; }
.ct-tag {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-3);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 1px 10px;
}

/* 参数表 */
.param-block { margin: 14px 0; }
.param-title { font-size: 13px; margin: 0 0 8px; color: var(--text); }
.table-scroll { overflow-x: auto; border: 1px solid var(--border-2); border-radius: var(--radius); }
table.params { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 560px; }
table.params th, table.params td { padding: 9px 12px; text-align: left; border-bottom: 1px solid var(--border-2); vertical-align: top; }
table.params thead th { background: #fafbfc; color: var(--text-2); font-weight: 600; font-size: 12.5px; white-space: nowrap; }
table.params tbody tr:last-child td { border-bottom: 0; }
table.params tbody tr:hover { background: #fafbfc; }
.col-required { white-space: nowrap; }
.req { color: #f56c6c; font-weight: 600; font-size: 12px; }
.opt { color: var(--text-3); font-size: 12px; }
.col-default code { color: var(--text-2) !important; background: var(--code-bg) !important; }
.code-pill { display: inline-block; font-family: var(--mono); font-weight: 700; padding: 1px 8px; border-radius: 6px; color: #fff; font-size: 12px; }
.code-200 { background: var(--post); }
.code-400 { background: var(--put); }
.code-401, .code-403 { background: #c45656; }
.code-404 { background: #909399; }
.code-409 { background: #d98b1f; }
.code-500 { background: var(--delete); }

/* 代码块 */
.code-wrap { margin: 14px 0; border: 1px solid var(--border-2); border-radius: var(--radius); overflow: hidden; background: var(--code-bg); }
.code-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid var(--border-2); background: #fbfcfd; }
.code-label { font-size: 12px; color: var(--text-3); font-weight: 600; }
.copy-btn {
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--text-2);
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}
.copy-btn:hover { border-color: var(--primary); color: var(--primary); }
.copy-btn.copied { border-color: var(--post); color: var(--post); }
.code-block {
  margin: 0;
  padding: 12px 14px;
  overflow: auto;
  max-height: 420px;
  font-size: 12.5px;
  line-height: 1.65;
  color: var(--code-text);
  background: var(--code-bg);
  tab-size: 2;
}
/* 代码块滚动条：沿用全局 ::-webkit-scrollbar 样式，与页面滚动条一致 */

.notes { margin: 14px 0 0; padding: 10px 14px; background: #fdf6ec; border: 1px solid #f5e3c4; border-radius: var(--radius); }
.notes-title { display: inline-block; font-size: 12px; font-weight: 700; color: #b88230; margin-bottom: 2px; }
.notes .plain-line { margin: 2px 0; color: #8a6d3b; font-size: 12.5px; }

/* 空态 */
.no-result { text-align: center; padding: 60px 20px; color: var(--text-3); background: var(--panel); border: 1px dashed var(--border); border-radius: var(--radius); }
.no-result svg { margin-bottom: 10px; opacity: 0.6; }

/* 返回顶部 */
.back-top {
  position: fixed;
  right: 24px;
  bottom: 24px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 0;
  background: var(--primary);
  color: #fff;
  font-size: 20px;
  cursor: pointer;
  box-shadow: var(--shadow-lg);
  z-index: 50;
  transition: background 0.15s, transform 0.15s;
}
.back-top:hover { background: var(--primary-600); transform: translateY(-2px); }

/* 遮罩 */
.overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); z-index: 55; }

/* ===== 响应式 ===== */
@media (max-width: 1200px) {
  :root { --sidebar-w: 240px; }
  .general-grid { grid-template-columns: 1fr; }
}
@media (max-width: 900px) {
  .menu-btn { display: inline-flex; }
  .brand-sub { display: none; }
  .layout { padding: 0; gap: 0; }
.sidebar {
      position: fixed;
      top: var(--header-h);
      left: 0;
      bottom: 0;
      width: min(86vw, 340px);
      max-height: none;
      border-radius: 0;
      border-left: 0;
      border-top: 0;
      transform: translateX(-100%);
      transition: transform 0.22s ease;
      z-index: 60;
      box-shadow: 4px 0 24px rgba(0, 0, 0, 0.18);
    }
  .sidebar.open { transform: translateX(0); }
  .content { width: 100%; padding: 16px; }
  .topbar-actions { display: none; }
  .search-wrap { flex-basis: 160px; min-width: 120px; }
  .card-badges { display: none; }
}
@media (max-width: 560px) {
  .topbar-inner { padding: 0 12px; gap: 8px; }
  .brand h1 { font-size: 15px; }
  .layout { padding: 0; }
  .content { padding: 12px; }
  .card-head { flex-wrap: wrap; gap: 8px; }
  .card-summary { width: 100%; }
  .ct-tag { margin-left: 0; }
  .back-top { right: 14px; bottom: 14px; }
}
</style>
</head>
<body>
<header class="topbar">
  <div class="topbar-inner">
    <button class="menu-btn" id="menuBtn" type="button" aria-label="打开接口目录" aria-controls="sidebar" aria-expanded="false">
      <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
    </button>
    <div class="brand">
      <span class="brand-mark" aria-hidden="true">LY</span>
      <div>
        <h1>${escapeHtml(DOC_TITLE)}</h1>
        <p class="brand-sub">共 ${ENDPOINT_TOTAL} 个接口 · ${moduleCount} 个模块</p>
      </div>
    </div>
    <div class="search-wrap">
      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M13.5 13.5L17 17" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
      <input id="searchInput" class="search-input" type="search" placeholder="搜索路径 / 摘要 / 方法" aria-label="搜索接口" autocomplete="off" />
      <button id="searchClear" class="search-clear is-hidden" type="button" aria-label="清空搜索">×</button>
    </div>
    <div class="topbar-actions">
      <span id="hitCount" class="module-count" aria-live="polite"></span>
      <button id="expandAll" class="btn" type="button">全部展开</button>
      <button id="collapseAll" class="btn" type="button">全部收起</button>
    </div>
  </div>
</header>

<div class="layout">
  <aside class="sidebar" id="sidebar" aria-label="接口目录">
    <nav id="toc">${toc}</nav>
  </aside>
  <div class="overlay is-hidden" id="overlay"></div>

  <main class="content" id="content">
    <div class="no-result is-hidden" id="noResult">
      <svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
      <p>未找到匹配的接口</p>
    </div>
    ${content}
  </main>
</div>

<button class="back-top is-hidden" id="backTop" type="button" aria-label="返回顶部">↑</button>

<script>
(function () {
  'use strict';
  var doc = document;
  var cards = Array.prototype.slice.call(doc.querySelectorAll('.card'));
  var sections = Array.prototype.slice.call(doc.querySelectorAll('.module'));
  var tocItems = Array.prototype.slice.call(doc.querySelectorAll('.toc-item'));
  var searchInput = doc.getElementById('searchInput');
  var searchClear = doc.getElementById('searchClear');
  var noResult = doc.getElementById('noResult');
  var hitCount = doc.getElementById('hitCount');
  var menuBtn = doc.getElementById('menuBtn');
  var sidebar = doc.getElementById('sidebar');
  var overlay = doc.getElementById('overlay');
  var backTop = doc.getElementById('backTop');
  var expandAllBtn = doc.getElementById('expandAll');
  var collapseAllBtn = doc.getElementById('collapseAll');

  function setOpen(card, open) {
    if (open) { card.classList.add('open'); } else { card.classList.remove('open'); }
    var head = card.querySelector('.card-head');
    if (head) { head.setAttribute('aria-expanded', open ? 'true' : 'false'); }
  }
  function isOpen(card) { return card.classList.contains('open'); }

  // 卡片头点击展开/收起
  cards.forEach(function (card) {
    var head = card.querySelector('.card-head');
    if (!head) { return; }
    head.addEventListener('click', function () { setOpen(card, !isOpen(card)); });
  });

  // 全部展开 / 收起
  if (expandAllBtn) {
    expandAllBtn.addEventListener('click', function () {
      cards.forEach(function (card) { if (!card.classList.contains('is-hidden')) { setOpen(card, true); } });
    });
  }
  if (collapseAllBtn) {
    collapseAllBtn.addEventListener('click', function () {
      cards.forEach(function (card) { setOpen(card, false); });
    });
  }

  // 搜索过滤
  function applySearch() {
    var q = (searchInput && searchInput.value ? searchInput.value : '').trim().toLowerCase();
    var visible = 0;
    cards.forEach(function (card) {
      var hay = card.getAttribute('data-search') || '';
      var match = q === '' || hay.indexOf(q) >= 0;
      if (match) { card.classList.remove('is-hidden'); visible += 1; } else { card.classList.add('is-hidden'); }
      if (q !== '' && match) { setOpen(card, true); }
    });
    sections.forEach(function (sec) {
      var any = sec.querySelector('.card:not(.is-hidden)');
      if (any) { sec.classList.remove('is-hidden'); } else { sec.classList.add('is-hidden'); }
    });
    if (noResult) {
      if (visible === 0 && q !== '') { noResult.classList.remove('is-hidden'); } else { noResult.classList.add('is-hidden'); }
    }
    if (hitCount) { hitCount.textContent = q === '' ? '' : '命中 ' + visible + ' 个'; }
    if (searchClear) { if (q === '') { searchClear.classList.add('is-hidden'); } else { searchClear.classList.remove('is-hidden'); } }
  }
  if (searchInput) {
    searchInput.addEventListener('input', applySearch);
  }
  if (searchClear) {
    searchClear.addEventListener('click', function () {
      if (searchInput) { searchInput.value = ''; searchInput.focus(); }
      applySearch();
    });
  }

  // 目录点击：展开并滚动
  tocItems.forEach(function (item) {
    item.addEventListener('click', function (event) {
      event.preventDefault();
      var target = item.getAttribute('data-target');
      var card = target ? doc.getElementById(target) : null;
      if (card) {
        setOpen(card, true);
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      closeDrawer();
    });
  });

  // scroll-spy 高亮
  var spyLock = false;
  function spy() {
    var fromTop = window.scrollY + 120;
    var current = null;
    for (var i = 0; i < cards.length; i += 1) {
      var card = cards[i];
      if (card.classList.contains('is-hidden')) { continue; }
      var top = card.getBoundingClientRect().top + window.scrollY;
      if (top <= fromTop) { current = card; } else { break; }
    }
    if (!current) { current = cards.length ? cards[0] : null; }
    tocItems.forEach(function (item) {
      if (current && item.getAttribute('data-target') === current.id) { item.classList.add('active'); }
      else { item.classList.remove('active'); }
    });
  }

  // 返回顶部
  function onScroll() {
    if (backTop) {
      if (window.scrollY > 400) { backTop.classList.remove('is-hidden'); } else { backTop.classList.add('is-hidden'); }
    }
    if (!spyLock) {
      spyLock = true;
      window.requestAnimationFrame(function () { spy(); spyLock = false; });
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  if (backTop) {
    backTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }

  // 抽屉
  function openDrawer() {
    if (!sidebar) { return; }
    sidebar.classList.add('open');
    if (overlay) { overlay.classList.remove('is-hidden'); }
    if (menuBtn) { menuBtn.setAttribute('aria-expanded', 'true'); }
  }
  function closeDrawer() {
    if (!sidebar) { return; }
    sidebar.classList.remove('open');
    if (overlay) { overlay.classList.add('is-hidden'); }
    if (menuBtn) { menuBtn.setAttribute('aria-expanded', 'false'); }
  }
  if (menuBtn) {
    menuBtn.addEventListener('click', function () {
      if (sidebar.classList.contains('open')) { closeDrawer(); } else { openDrawer(); }
    });
  }
  if (overlay) { overlay.addEventListener('click', closeDrawer); }
  doc.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') { closeDrawer(); }
    if (event.key === '/' && doc.activeElement !== searchInput && searchInput) {
      event.preventDefault();
      searchInput.focus();
    }
  });
  window.addEventListener('resize', function () { if (window.innerWidth >= 900) { closeDrawer(); } });

  // 复制
  function fallbackCopy(text) {
    var ta = doc.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    doc.body.appendChild(ta);
    ta.select();
    try { doc.execCommand('copy'); } catch (err) { /* 忽略 */ }
    doc.body.removeChild(ta);
  }
  Array.prototype.slice.call(doc.querySelectorAll('.copy-btn')).forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-copy');
      var el = id ? doc.getElementById(id) : null;
      if (!el) { return; }
      var text = el.innerText;
      var original = btn.getAttribute('data-label');
      if (!original) { original = btn.textContent; btn.setAttribute('data-label', original); }
      var done = function () {
        btn.textContent = '已复制';
        btn.classList.add('copied');
        window.setTimeout(function () { btn.textContent = original; btn.classList.remove('copied'); }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
      } else {
        fallbackCopy(text);
        done();
      }
    });
  });

  // 初始化
  applySearch();
  spy();
})();
</script>
</body>
</html>`;
}
