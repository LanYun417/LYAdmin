#!/usr/bin/env node
/**
 * 零依赖 HTTP 压测脚本（仅用 Node 内置模块，符合项目「零运行时依赖」约束）。
 *
 * 背景：性能基线测量需要可控的并发压测工具，但项目硬约束禁止引入 autocannon / k6 / wrk
 * 等外部依赖。本脚本用 `node:http` 自实现固定并发（信号量式 worker 池）+ 预热 + 分位统计，
 * 作为项目长期可复用的性能测量工具，与 `rewrite-alias.mjs` 并列于 `api/scripts/`。
 *
 * 特性：
 * - 参数化：URL / 方法 / 请求头（含 Bearer Token）/ 并发数 / 总请求数 / 请求体；
 * - 预热：正式统计前先打 `warmup` 次请求，排除首次连接建立、DNS、模块懒编译等一次性开销；
 * - 固定并发：以 `concurrency` 个 worker 循环取号（计数信号量），避免一次性创建海量连接；
 * - 统计：P50 / P90 / P95 / P99 / 平均 / 最小 / 最大（ms）、实际 RPS、成功/失败数、
 *   错误码分布、总耗时；
 * - 输出：可直接复制的 ASCII 表格，或 `--json` 输出机器可读结果。
 *
 * 用法：
 *   node scripts/bench-http.mjs --url http://localhost:3250/api --concurrency 10 --requests 1000
 *   node scripts/bench-http.mjs --url http://localhost:3250/api/users?page=1&pageSize=10 \
 *     --token <accessToken> --concurrency 50 --requests 3000 --label "users@50"
 *
 * 参数：
 *   --url        目标 URL（必填）
 *   --method     HTTP 方法，默认 GET
 *   --token      Bearer Token；传入后自动附加 `Authorization: Bearer <token>`
 *   --header     额外请求头，形如 `K: V`（可重复）
 *   --concurrency 并发数，默认 10
 *   --requests   总请求数（不含预热），默认 200
 *   --body       请求体字符串（POST/PUT 时使用；同时自动补 Content-Type: application/json）
 *   --warmup     预热请求数，默认 10
 *   --timeout    单请求超时（ms），默认 30000
 *   --label      本次压测标签，仅用于表格标题
 *   --json       以 JSON 输出结果（便于程序汇总）
 *
 * 退出码：0 = 全部成功；1 = 存在失败请求（错误率 > 0）。
 */
import http from 'node:http';
import https from 'node:https';
import process from 'node:process';

/**
 * 解析命令行参数。
 * @param {string[]} argv process.argv.slice(2)
 * @returns {Record<string, unknown>} 解析后的选项对象
 */
function parseArgs(argv) {
  const options = {
    url: '',
    method: 'GET',
    token: '',
    headers: [],
    concurrency: 10,
    requests: 200,
    body: '',
    warmup: 10,
    timeout: 30000,
    label: '',
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const next = argv[i + 1];
    switch (key) {
      case '--url':
        options.url = next;
        i += 1;
        break;
      case '--method':
        options.method = String(next).toUpperCase();
        i += 1;
        break;
      case '--token':
        options.token = next;
        i += 1;
        break;
      case '--header':
        options.headers.push(next);
        i += 1;
        break;
      case '--concurrency':
        options.concurrency = Number(next);
        i += 1;
        break;
      case '--requests':
        options.requests = Number(next);
        i += 1;
        break;
      case '--body':
        options.body = next;
        i += 1;
        break;
      case '--warmup':
        options.warmup = Number(next);
        i += 1;
        break;
      case '--timeout':
        options.timeout = Number(next);
        i += 1;
        break;
      case '--label':
        options.label = next;
        i += 1;
        break;
      case '--json':
        options.json = true;
        break;
      default:
        break;
    }
  }

  if (!options.url) {
    throw new Error('缺少必填参数 --url');
  }
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1) {
    throw new Error('--concurrency 必须为正整数');
  }
  if (!Number.isInteger(options.requests) || options.requests < 1) {
    throw new Error('--requests 必须为正整数');
  }
  return options;
}

/**
 * 构造请求选项（复用长连接 Agent，显著降低连接建立的开销噪声）。
 * @param {URL} target 目标 URL
 * @param {Record<string, unknown>} options 选项
 * @returns {{ requestOptions: import('node:http').RequestOptions, agent: import('node:http').Agent }}
 */
function buildRequestOptions(target, options) {
  const isHttps = target.protocol === 'https:';
  const agent = isHttps
    ? new https.Agent({ keepAlive: true, maxSockets: options.concurrency })
    : new http.Agent({ keepAlive: true, maxSockets: options.concurrency });

  /** @type {Record<string, string>} */
  const headers = {};
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  for (const raw of options.headers) {
    const idx = raw.indexOf(':');
    if (idx > 0) {
      headers[raw.slice(0, idx).trim()] = raw.slice(idx + 1).trim();
    }
  }
  let payload = null;
  if (options.body) {
    payload = Buffer.from(options.body, 'utf-8');
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
    headers['Content-Length'] = String(payload.length);
  }

  return {
    requestOptions: {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      path: `${target.pathname}${target.search}`,
      method: options.method,
      headers,
      agent,
    },
    agent,
    payload,
  };
}

/**
 * 发起单次请求，返回耗时（ms）与状态码。
 * @param {import('node:http').RequestOptions} requestOptions 请求选项
 * @param {Buffer | null} payload 请求体
 * @param {number} timeout 超时（ms）
 * @returns {Promise<{ durationMs: number, status: number, error?: string }>}
 */
function singleRequest(requestOptions, payload, timeout) {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    const finish = (status, error) => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      resolve({ durationMs, status, error });
    };

    const req = http.request(requestOptions, (res) => {
      res.resume(); // 消费并丢弃响应体，确保连接可复用
      res.on('end', () => finish(res.statusCode ?? 0));
      res.on('error', (err) => finish(0, err.message));
    });
    req.setTimeout(timeout, () => {
      req.destroy(new Error('timeout'));
    });
    req.on('error', (err) => finish(0, err.message));
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

/**
 * 计算分位数（最近秩法，不插值）。
 * @param {number[]} sortedMs 已升序排序的耗时数组
 * @param {number} p 分位（0-100）
 * @returns {number} 分位耗时（ms）
 */
function percentile(sortedMs, p) {
  if (sortedMs.length === 0) {
    return 0;
  }
  const rank = Math.ceil((p / 100) * sortedMs.length);
  const idx = Math.min(Math.max(rank - 1, 0), sortedMs.length - 1);
  return sortedMs[idx];
}

/**
 * 以固定并发 worker 池执行 total 次请求。
 * @param {object} ctx 上下文
 * @param {number} ctx.total 总请求数
 * @param {number} ctx.concurrency 并发数
 * @param {number} ctx.warmup 预热数（跳过统计，但同样发请求）
 * @param {import('node:http').RequestOptions} ctx.requestOptions
 * @param {Buffer | null} ctx.payload
 * @param {number} ctx.timeout
 * @returns {Promise<{ durations: number[], statusCodes: Record<string, number>, errors: Record<string, number>, elapsedMs: number }>}
 */
async function runLoad(ctx) {
  const durations = [];
  /** @type {Record<string, number>} */
  const statusCodes = {};
  /** @type {Record<string, number>} */
  const errors = {};

  let issued = 0;
  const grandTotal = ctx.warmup + ctx.total;
  const startAll = process.hrtime.bigint();

  /**
   * 单个 worker：循环领取序号并执行请求。
   * @param {number} offset worker 起始偏移
   */
  async function worker(offset) {
    let seq = offset;
    while (seq < grandTotal) {
      const result = await singleRequest(ctx.requestOptions, ctx.payload, ctx.timeout);
      if (seq >= ctx.warmup) {
        // 仅统计预热之后的请求
        durations.push(result.durationMs);
        if (result.status > 0) {
          statusCodes[String(result.status)] = (statusCodes[String(result.status)] ?? 0) + 1;
        }
        if (result.error) {
          errors[result.error] = (errors[result.error] ?? 0) + 1;
        }
      }
      seq += ctx.concurrency;
    }
  }

  const workers = [];
  const workerCount = Math.min(ctx.concurrency, grandTotal);
  for (let w = 0; w < workerCount; w += 1) {
    workers.push(worker(w));
  }
  await Promise.all(workers);

  const elapsedMs = Number(process.hrtime.bigint() - startAll) / 1e6;
  return { durations, statusCodes, errors, elapsedMs, issued };
}

/**
 * 汇总统计并打印。
 * @param {object} options 选项
 * @param {object} raw runLoad 的原始结果
 * @param {string} hostPort 目标 host:port
 */
function report(options, raw, hostPort) {
  const sorted = [...raw.durations].sort((a, b) => a - b);
  const total = sorted.length;
  const sum = sorted.reduce((acc, cur) => acc + cur, 0);
  const successStatuses = Object.entries(raw.statusCodes).filter(([code]) => Number(code) >= 200 && Number(code) < 400);
  const success = successStatuses.reduce((acc, [, n]) => acc + n, 0);
  const failed = total - success;
  const rps = raw.elapsedMs > 0 ? (total / raw.elapsedMs) * 1000 : 0;

  const result = {
    label: options.label || `${options.method} ${options.url}`,
    target: hostPort,
    method: options.method,
    concurrency: options.concurrency,
    requests: total,
    warmup: options.warmup,
    success,
    failed,
    errorRate: total > 0 ? failed / total : 0,
    rps: Number(rps.toFixed(2)),
    totalMs: Number(raw.elapsedMs.toFixed(2)),
    min: Number((sorted[0] ?? 0).toFixed(2)),
    max: Number((sorted[sorted.length - 1] ?? 0).toFixed(2)),
    avg: Number((total > 0 ? sum / total : 0).toFixed(2)),
    p50: Number(percentile(sorted, 50).toFixed(2)),
    p90: Number(percentile(sorted, 90).toFixed(2)),
    p95: Number(percentile(sorted, 95).toFixed(2)),
    p99: Number(percentile(sorted, 99).toFixed(2)),
    statusCodes: raw.statusCodes,
    errors: raw.errors,
  };

  if (options.json) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return result;
  }

  // 计算字符串的「显示宽度」：CJK 字符占 2 列，其余占 1 列，用于对齐含中文的表格。
  const displayWidth = (s) => [...String(s)].reduce((w, ch) => w + (/[\u1100-\uFFE6]/.test(ch) ? 2 : 1), 0);
  const pad = (v, n) => `${v}${' '.repeat(Math.max(0, n - displayWidth(v)))}`;
  const num = (v, n) => `${' '.repeat(Math.max(0, n - displayWidth(v)))}${v}`;
  const lines = [];
  lines.push('');
  lines.push(`=== HTTP 压测结果：${result.label} ===`);
  lines.push(`目标: ${result.method} ${options.url}`);
  lines.push(`并发: ${result.concurrency}  总请求(统计): ${result.requests}  预热: ${result.warmup}`);
  lines.push('');
  lines.push('+--------------+-------------+');
  lines.push(`| ${pad('指标', 12)} | ${pad('数值', 11)} |`);
  lines.push('+--------------+-------------+');
  const rows = [
    ['总耗时(ms)', result.totalMs],
    ['实际 RPS', result.rps],
    ['成功 / 失败', `${result.success} / ${result.failed}`],
    ['错误率', `${(result.errorRate * 100).toFixed(2)}%`],
    ['最小(ms)', result.min],
    ['P50(ms)', result.p50],
    ['平均(ms)', result.avg],
    ['P90(ms)', result.p90],
    ['P95(ms)', result.p95],
    ['P99(ms)', result.p99],
    ['最大(ms)', result.max],
  ];
  for (const [k, v] of rows) {
    lines.push(`| ${pad(k, 12)} | ${num(v, 11)} |`);
  }
  lines.push('+--------------+-------------+');
  const statusEntries = Object.entries(result.statusCodes);
  if (statusEntries.length > 0) {
    lines.push(`状态码分布: ${statusEntries.map(([c, n]) => `${c}=${n}`).join('  ')}`);
  }
  const errorEntries = Object.entries(result.errors);
  if (errorEntries.length > 0) {
    lines.push(`错误分布:   ${errorEntries.map(([e, n]) => `${e}=${n}`).join('  ')}`);
  }
  lines.push('');
  process.stdout.write(`${lines.join('\n')}\n`);
  return result;
}

/**
 * 主入口。
 */
async function main() {
  const options = parseArgs(process.argv.slice(2));
  const target = new URL(options.url);
  const { requestOptions, payload } = buildRequestOptions(target, options);

  const raw = await runLoad({
    total: options.requests,
    concurrency: options.concurrency,
    warmup: options.warmup,
    requestOptions,
    payload,
    timeout: options.timeout,
  });

  const result = report(options, raw, `${target.host}`);
  process.exit(result.failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('[bench-http] 执行失败:', error);
  process.exit(2);
});
