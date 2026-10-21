#!/usr/bin/env node
/**
 * 一键开发启动器（根目录 `npm run dev`）。
 *
 * 解决的核心问题：原实现用 concurrently 并行拉起前后端，前端往往先于后端就绪——
 * 首次打开页面时 Vite 代理打到尚未监听的 :3000，登录 / 初始化请求直接失败，
 * 表现为「页面白屏或一片红」，需要手动刷新才恢复。
 *
 * 本脚本的顺序编排：
 *   1. 启动前预检：后端健康检查端点已有响应 → 复用该实例（顺带避免端口占用报错）；
 *      前端 dev server 端口（strictPort，占用了必失败）被占 → 直接带 PID 报错，不白跑一趟；
 *   2. 否则拉起后端 dev server，轮询健康检查直到返回 200（Nest 已完成监听、路由已挂载）；
 *   3. 后端就绪后才启动前端 dev server；
 *   4. 任一子进程退出 → 全量回收整棵进程树；Ctrl+C 同样干净退出；
 *      被复用的后端不属于本次启动，退出时不会误杀。
 *
 * 零第三方依赖（仅 Node 内置模块），与仓库「零第三方运行时依赖」约束一致，
 * 因此该脚本取代了原先的 concurrently + 手写等待链。
 *
 * 用法：
 *   npm run dev              # 有序启动（后端就绪 → 前端）
 *   npm run dev -- --fresh   # 忽略已在运行的后端，强制新起一个（端口被占则直接报错退出）
 *   npm run dev -- --help    # 查看帮助
 *
 * 可用环境变量：
 *   API_PORT              后端端口（默认 3000，需与 ly-admin-api/.env 的 PORT 一致）
 *   WEB_PORT              前端端口（默认 5173，需与 ly-admin-web/.env 的 VITE_PORT 一致）
 *   DEV_WAIT_TIMEOUT_MS   等待后端就绪的超时（默认 180000）
 *   DEV_WAIT_INTERVAL_MS  健康检查轮询间隔（默认 500）
 *   NO_COLOR              置任意值即关闭彩色前缀
 */
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** 后端端口：与 ly-admin-api/.env 的 PORT 保持一致，可用 API_PORT 覆盖。 */
const API_PORT = Number(process.env.API_PORT ?? 3000);

/** 前端端口：与 ly-admin-web/.env 的 VITE_PORT 保持一致，可用 WEB_PORT 覆盖。 */
const WEB_PORT = Number(process.env.WEB_PORT ?? 5173);

/** 存活探针地址（只证明进程可响应；就绪探针另行软校验）。 */
const LIVE_URL = `http://127.0.0.1:${API_PORT}/api/health/live`;

/** 就绪探针地址（会真实探测 MySQL / Redis，任一不可用返回 503）。 */
const READY_URL = `http://127.0.0.1:${API_PORT}/api/health/ready`;

/** 等待后端就绪的最长时间（毫秒）。首次启动要跑 Prisma generate + 编译，留足余量。 */
const WAIT_TIMEOUT_MS = Number(process.env.DEV_WAIT_TIMEOUT_MS ?? 180_000);

/** 健康检查轮询间隔（毫秒）。 */
const WAIT_INTERVAL_MS = Number(process.env.DEV_WAIT_INTERVAL_MS ?? 500);

/** 就绪探针的最长等待（毫秒）：失败只告警，不阻断前端启动。 */
const READY_TIMEOUT_MS = 10_000;

/** 是否输出 ANSI 颜色（重定向到文件时不输出，避免污染日志）。 */
const USE_COLOR = !process.env.NO_COLOR && process.stdout.isTTY === true;

const RESET = USE_COLOR ? '\x1b[0m' : '';
const DIM = USE_COLOR ? '\x1b[2m' : '';
const BOLD = USE_COLOR ? '\x1b[1m' : '';
const WARN_COLOR = USE_COLOR ? '\x1b[33m' : '';
const ERROR_COLOR = USE_COLOR ? '\x1b[31m' : '';

/**
 * 子任务定义。命令为单条字符串而非参数数组：Node 对 `shell: true` + 参数数组会抛
 * DEP0190 弃用警告（参数不做转义），而这里参数全为内部常量、无用户输入，
 * 单字符串既安全又不污染启动日志。
 */
const TASKS = {
  api: {
    label: 'api',
    color: USE_COLOR ? '\x1b[34m' : '',
    command: 'npm --prefix ly-admin-api run start:dev',
  },
  web: {
    label: 'web',
    color: USE_COLOR ? '\x1b[32m' : '',
    command: 'npm --prefix ly-admin-web run dev',
  },
};

/** 已启动的子进程：name → ChildProcess。 */
const children = new Map();

/** 是否已进入退出流程，用于抑制重复回收。 */
let shuttingDown = false;

/** 主流程日志前缀。 */
const LOG_TAG = `${USE_COLOR ? '\x1b[36m' : ''}[dev]${RESET}`;

/**
 * 输出主流程日志。
 * @param {string} message 日志内容
 * @returns {void}
 */
function log(message) {
  process.stdout.write(`${LOG_TAG} ${message}\n`);
}

/** 输出警告日志。 */
function warn(message) {
  process.stdout.write(`${LOG_TAG} ${WARN_COLOR}⚠️  ${message}${RESET}\n`);
}

/** 输出失败日志。 */
function fail(message) {
  process.stdout.write(`${LOG_TAG} ${ERROR_COLOR}❌ ${message}${RESET}\n`);
}

/**
 * 按行给子进程输出加彩色前缀。
 * @param {NodeJS.WritableStream} stream 目标流（stdout / stderr）
 * @param {string} color ANSI 颜色码
 * @param {string} label 进程标签
 * @returns {(chunk: Buffer | string) => void} 写入处理器
 */
function createPrefixer(stream, color, label) {
  const tag = `${color}[${label}]${RESET}`;
  let buffer = '';
  return (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    // 最后一段可能是半行，留到下次再输出
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      stream.write(`${tag} ${line.replace(/\r$/, '')}\n`);
    }
  };
}

/**
 * 回收整棵进程树。
 * Windows 用 taskkill /T 连带子进程；POSIX 借助 detached 进程组整组发送信号。
 * @param {number} pid 进程号
 * @returns {void}
 */
function killTree(pid) {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // 进程已退出，忽略
    }
  }
}

/**
 * 关闭所有由本脚本拉起的子进程并以指定退出码结束。
 * @param {number} code 退出码
 * @returns {void}
 */
function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;

  if (children.size > 0) {
    log('正在关闭子进程…');
    for (const child of children.values()) {
      // 仅本脚本拉起的进程才参与回收（复用的后端不会被误杀）
      if (child.pid) killTree(child.pid);
    }
  }
  // 先落 exitCode：grace 定时器是 unref 的，若已无子进程挂住事件循环，定时器不会触发，
  // 此时应靠 exitCode 正常退出且保留非零状态
  process.exitCode = code;
  // 再留一点时间给 taskkill / 信号生效，然后显式退出
  setTimeout(() => process.exit(code), 300).unref();
}

/**
 * 启动一个子任务并接管其输出。
 * @param {'api' | 'web'} name 任务名
 * @param {{ stdin?: 'ignore' | 'inherit' }} [options] 额外选项
 * @returns {import('node:child_process').ChildProcess} 子进程
 */
function startTask(name, options = {}) {
  const def = TASKS[name];
  const child = spawn(def.command, {
    cwd: ROOT_DIR,
    shell: true,
    // POSIX 下自成进程组，便于整组回收
    detached: process.platform !== 'win32',
    stdio: [options.stdin ?? 'ignore', 'pipe', 'pipe'],
    env: process.env,
  });

  const onOut = createPrefixer(process.stdout, def.color, def.label);
  const onErr = createPrefixer(process.stderr, def.color, def.label);
  child.stdout?.on('data', onOut);
  child.stderr?.on('data', onErr);

  child.on('error', (error) => {
    fail(`无法启动 ${def.label} 进程：${error.message}`);
    shutdown(1);
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    const reason = signal ? `信号 ${signal}` : `退出码 ${code ?? 0}`;
    log(`${def.label} 进程已退出（${reason}），正在关闭其余进程…`);
    shutdown(code ?? 0);
  });

  children.set(name, child);
  return child;
}

/**
 * 回环地址候选。Vite / Nest 在 Windows 上可能只绑 IPv6 回环，只探 127.0.0.1 会误判为「端口空闲」。
 */
const LOOPBACK_HOSTS = ['127.0.0.1', '[::1]'];

/**
 * 探测存活 / 就绪端点。
 * @param {number} port 端口号
 * @param {string} path 请求路径
 * @param {number} [timeoutMs] 单次请求超时
 * @returns {Promise<boolean>} 是否返回 2xx
 */
async function probe(port, path, timeoutMs = 1500) {
  for (const host of LOOPBACK_HOSTS) {
    try {
      const response = await fetch(`http://${host}:${port}${path}`, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) return true;
    } catch {
      // 该地址不通，试下一个回环地址
    }
  }
  return false;
}

/**
 * 探测某 TCP 端口是否可连接（用于识别「端口被占但探针不响」的裸监听）。
 * @param {number} port 端口号
 * @returns {Promise<boolean>} 是否可连接
 */
function isPortOpen(port) {
  const attempts = LOOPBACK_HOSTS.map(
    (host) =>
      new Promise((resolve) => {
        const socket = new net.Socket();
        const done = (result) => {
          socket.destroy();
          resolve(result);
        };
        socket.setTimeout(1000);
        socket.once('connect', () => done(true));
        socket.once('timeout', () => done(false));
        socket.once('error', () => done(false));
        socket.connect(port, host);
      }),
  );
  return Promise.all(attempts).then((results) => results.some(Boolean));
}

/**
 * 反查某监听端口对应的 PID（用于报错时给出可直接操作的进程标识）。
 * @param {number} port 端口号
 * @returns {string | null} PID（取不到返回 null）
 */
function findListenerPid(port) {
  try {
    if (process.platform === 'win32') {
      const res = spawnSync('netstat', ['-ano'], { encoding: 'utf8' });
      const line = res.stdout
        .split('\n')
        .find((row) => row.includes('LISTENING') && new RegExp(`:${port}\\s`).test(row));
      return line?.trim().split(/\s+/).pop() ?? null;
    }
    const lsof = spawnSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' });
    if (lsof.status === 0 && lsof.stdout.trim()) return lsof.stdout.trim().split('\n')[0];
    const ss = spawnSync('ss', ['-lptn', `sport = :${port}`], { encoding: 'utf8' });
    const match = /pid=(\d+)/.exec(ss.stdout ?? '');
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * 延时。
 * @param {number} ms 毫秒
 * @returns {Promise<void>} 延时完成
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 轮询等待后端存活探针通过。
 * @returns {Promise<void>}
 * @throws 后端进程提前退出或超时时抛出
 */
async function waitForBackendLive() {
  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  const child = children.get('api');

  process.stdout.write(`${LOG_TAG} 等待后端就绪 ${DIM}${LIVE_URL}${RESET} `);
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) {
      process.stdout.write('\n');
      throw new Error(
        `后端进程在就绪前退出（退出码 ${child.exitCode}）。` +
          `若提示端口被占用，请先关闭占用 ${API_PORT} 端口的进程，或去掉 --fresh 复用已有实例。`,
      );
    }
    if (await probe(API_PORT, '/api/health/live')) {
      process.stdout.write(' ✓\n');
      return;
    }
    process.stdout.write('.');
    await delay(WAIT_INTERVAL_MS);
  }
  process.stdout.write('\n');
  throw new Error(`等待后端就绪超时（${WAIT_TIMEOUT_MS}ms），请检查上方 [api] 日志。`);
}

/**
 * 软校验就绪探针（真实探测 MySQL / Redis）：失败只告警，不阻断启动流程。
 * @returns {Promise<void>}
 */
async function checkBackendReady() {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await probe(API_PORT, '/api/health/ready')) {
      log('后端依赖就绪：MySQL / Redis 均可用。');
      return;
    }
    await delay(WAIT_INTERVAL_MS);
  }
  warn(`就绪探针未通过（${READY_URL}）：可能是 MySQL / Redis 未启动，登录等依赖数据库的功能会失败。`);
}

/**
 * 预检前端端口。vite 配了 strictPort，被占用必失败，故在动工前先查。
 * @returns {void}
 * @throws 端口被占用时抛出（报错带 PID）
 */
async function preflightWebPort() {
  const occupied = (await isPortOpen(WEB_PORT)) || (await probe(WEB_PORT, '/'));
  if (!occupied) return;
  const pid = findListenerPid(WEB_PORT);
  throw new Error(
    `前端端口 ${WEB_PORT} 已被占用${pid ? `（PID ${pid}）` : ''}，而 vite 配置了 strictPort，无法自动换端口。\n` +
      `      请先结束占用进程后重试；若确需并存，可用 WEB_PORT 指定其他端口。`,
  );
}

/** 打印帮助。 */
function printHelp() {
  process.stdout.write(
    [
      'LYAdmin 开发启动器',
      '',
      '用法：',
      '  npm run dev              有序启动：后端就绪后才启动前端',
      '  npm run dev -- --fresh   强制新起后端（忽略已在运行的实例）',
      '  npm run dev -- --help    显示本帮助',
      '',
      '环境变量：',
      `  API_PORT=${API_PORT}              后端端口`,
      `  WEB_PORT=${WEB_PORT}              前端端口`,
      `  DEV_WAIT_TIMEOUT_MS=${WAIT_TIMEOUT_MS}   等待后端就绪的超时（毫秒）`,
      '  NO_COLOR                关闭彩色输出前缀',
      '',
    ].join('\n'),
  );
}

/**
 * 入口：编排「预检 → 起后端 → 等就绪 → 起前端」。
 * @returns {Promise<void>}
 */
async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  const fresh = args.includes('--fresh');
  const backendAlreadyUp = await probe(API_PORT, '/api/health/live');

  process.stdout.write(`\n${BOLD}LYAdmin 开发环境${RESET} ${DIM}(后端 :${API_PORT} → 前端 :${WEB_PORT})${RESET}\n\n`);

  // 两个端口都先查清，避免后端编译半天最后前端端口又被占、白跑一趟
  if (backendAlreadyUp && fresh) {
    throw new Error(
      `端口 ${API_PORT} 已被占用（${LIVE_URL} 有响应）。` + `请先关闭该进程，或去掉 --fresh 以复用现有后端。`,
    );
  }
  await preflightWebPort();

  if (backendAlreadyUp) {
    warn(`检测到 ${LIVE_URL} 已在响应，复用该后端实例，仅启动前端。`);
    await checkBackendReady();
  } else {
    log('启动后端（nest start --watch）…');
    startTask('api');
    await waitForBackendLive();
    log(`后端已就绪：http://localhost:${API_PORT}`);
    await checkBackendReady();
  }

  log('启动前端（vite）…');
  // 前端独占 stdin，便于使用 Vite 的 r / q 等快捷键（后端不需要交互输入）
  startTask('web', { stdin: 'inherit' });
  log(`全部就绪 → 前端 http://localhost:${WEB_PORT} （Ctrl+C 退出）\n`);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!shuttingDown) log(`收到 ${signal}，正在退出…`);
    shutdown(0);
  });
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
  shutdown(1);
});
