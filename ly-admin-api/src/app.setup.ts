/**
 * 应用装配（`main.ts` 与 e2e 测试共用）。
 *
 * 为什么单独抽出来：这些配置若只写在 `main.ts` 里，e2e 测试用
 * `createNestApplication()` 起的实例**没有**全局校验管道、CORS 与 body 上限，
 * 于是「测的装配」和「跑的装配」不是同一套 —— 校验失败文案、POST 恒 200 这类
 * 契约断言在测试里根本无法验证。抽成共用函数后两边完全一致。
 *
 * 保留在调用方的只有三件事：适配器（测试要显式 new 同一个 `OkExpressAdapter`）、
 * 监听端口、以及静态资源托管（由 `serveStatic` 开关控制——单测不需要，也避免引入
 * 对 uploads / 前端产物目录的文件系统依赖）。
 */
import { existsSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { Logger, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import express, { type NextFunction, type Request, type Response } from 'express';
import { config } from './common/config/config.js';
import { HotlinkGuardMiddleware, ImageScaleMiddleware } from './common/file/file-guards.js';
import { StaticAuthMiddleware } from './common/http/static-auth.middleware.js';
import { securityHeaders } from './common/http/security-headers.js';

/** 构建期预压缩副本可覆盖的文本类型（扩展名 → Content-Type）。 */
const PRECOMPRESSED_TYPES: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

/** 带内容哈希的构建产物可长期缓存。 */
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

/**
 * 预压缩资源中间件：优先返回构建期生成的 `.br` / `.gz`。
 *
 * 构建已产出压缩副本（vite-plugin-compression2），但 `express.static` 不会做内容协商，
 * 默认仍发送原文件。这里按 `Accept-Encoding` 直接命中同目录压缩副本，既省带宽也避免
 * 每次请求做运行时压缩。
 * @param app Nest 应用
 * @param root 静态根目录
 */
function mountPrecompressed(app: NestExpressApplication, root: string): void {
  const rootDir = resolve(root);
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }
    const type = PRECOMPRESSED_TYPES[extname(req.path).toLowerCase()];
    if (!type) {
      next();
      return;
    }
    let relPath: string;
    try {
      relPath = decodeURIComponent(req.path).replace(/^\/+/, '');
    } catch {
      next();
      return;
    }
    // 防目录穿越：解析后的绝对路径必须仍在静态根目录内
    if (!resolve(rootDir, relPath).startsWith(`${rootDir}${sep}`)) {
      next();
      return;
    }
    const accept = String(req.headers['accept-encoding'] ?? '');
    const encoding = accept.includes('br') ? 'br' : accept.includes('gzip') ? 'gzip' : null;
    if (!encoding) {
      next();
      return;
    }
    const file = `${relPath}.${encoding}`;
    if (!existsSync(join(rootDir, file))) {
      next();
      return;
    }
    res.setHeader('Content-Type', type);
    res.setHeader('Content-Encoding', encoding);
    res.setHeader('Vary', 'Accept-Encoding');
    res.setHeader('Cache-Control', IMMUTABLE_CACHE);
    res.sendFile(file, { root: rootDir, dotfiles: 'deny' });
  });
}

/** 装配选项。 */
export interface AppSetupOptions {
  /** 是否挂载上传资源与前端构建产物（含 history 回退）。仅生产入口需要。 */
  serveStatic?: boolean;
  /** 前端产物目录（默认取 `config.web.distDir`，测试可用临时目录覆盖）。 */
  webDistDir?: string;
}

/**
 * 按生产口径装配应用。
 * @param app NestExpressApplication 实例（已注入自定义适配器）
 * @param options 装配选项
 */
export function configureApp(app: NestExpressApplication, options: AppSetupOptions = {}): void {
  const logger = new Logger('Bootstrap');

  // 反向代理信任跳数：仅在显式配置时信任 X-Forwarded-For（默认不信任，防伪造 IP 绕过限流）
  app.set('trust proxy', config.trustProxy);

  // 隐藏框架标识
  app.disable('x-powered-by');

  // 关闭 etag：避免动态响应产生 304（304 无响应体，axios 只把 2xx 视为成功）
  app.disable('etag');

  // 全局路由前缀：前端 baseURL 为 /api
  app.setGlobalPrefix('api');

  // 跨域：开发期前端走 Vite 代理，此处便于直连调试
  app.enableCors({
    origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((item) => item.trim()),
    credentials: true,
  });

  // 响应压缩：>1KB 的可压缩响应（JSON / JS / CSS / SVG）按 Accept-Encoding 协商 br / gzip
  app.use(compression({ threshold: 1024 }));

  // 安全响应头：nosniff / 点击劫持 / Referrer / 权限策略（+ 可选 HSTS、CSP）
  // 放在最前，保证错误响应（401/403/429/503）也带上这些头
  app.use(securityHeaders());

  // 请求体上限 2mb
  app.useBodyParser('json', { limit: '2mb' });
  app.useBodyParser('urlencoded', { limit: '2mb', extended: true });

  // 全局校验管道：class-validator 失败交由 AllExceptionsFilter 统一转 400
  app.useGlobalPipes(
    new ValidationPipe({
      // 剥离未知字段（防越权字段注入，如前端误传 roleCode / systemFlag）
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (!options.serveStatic) {
    return;
  }

  // 上传静态资源：鉴权 → 防盗链 → 图片缩放 → 静态出图。
  //
  // 为什么不用 `consumer.apply(...).forRoutes('static/...')` 挂 Nest 中间件：
  // 1) 中间件路由会被全局前缀改写成 `/api/static/...`，而静态资源实际挂在 `/static/...`，
  //    永远匹配不上（表现为「无令牌也能直接访问、`?scale=` 不生效」）；
  // 2) `useStaticAssets` 在本函数（app.init 之前）注册，会抢在中间件之前命中文件直接出图。
  // 因此在这里按顺序显式挂到 express 栈上；中间件实例延迟到首个请求时解析（init 之后才能 get）。
  if (existsSync(config.upload.dir)) {
    // 首次请求时才从容器取（app.get 需在 init 之后调用），随后复用同一实例
    const lazy = <T>(factory: () => T): (() => T) => {
      let value: T | undefined;
      return () => (value ??= factory()) as T;
    };
    const auth = lazy(() => app.get(StaticAuthMiddleware));
    const hotlink = lazy(() => app.get(HotlinkGuardMiddleware));
    const scale = lazy(() => app.get(ImageScaleMiddleware));

    app.use(
      `/${config.upload.route}`,
      (req: Request, res: Response, next: NextFunction) => {
        void auth().use(req, res, next);
      },
      (req: Request, res: Response, next: NextFunction) => {
        hotlink().use(req, res, next);
      },
      (req: Request, res: Response, next: NextFunction) => {
        void scale().use(req, res, next);
      },
      express.static(config.upload.dir, {
        // 文件名由服务端生成且唯一，内容不会原地变更，可长期缓存
        maxAge: '30d',
        immutable: true,
      }),
    );
    logger.log(`静态资源目录: ${config.upload.dir} → /${config.upload.route}/（鉴权 → 防盗链 → 缩放）`);
  } else {
    logger.warn(`上传目录不存在（${config.upload.dir}），/static 将 404；上传时会自动创建`);
  }

  // 前端构建产物（同源部署）：存在时由后端一并托管，含 history 回退
  const webDistDir = options.webDistDir ?? config.web.distDir;
  if (existsSync(webDistDir)) {
    // 优先命中预压缩副本（.br / .gz），未命中再回落到原文件
    mountPrecompressed(app, webDistDir);
    app.useStaticAssets(webDistDir, {
      // Vite 产物名带内容哈希，可长期缓存；index.html 必须每次校验
      maxAge: '1y',
      immutable: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache');
          return;
        }
        res.setHeader('Vary', 'Accept-Encoding');
      },
    });
    // history 回退：非 /api 的页面导航回退 index.html（刷新子路由不 404）。
    //
    // ⚠️ 该中间件注册在 Nest 控制器路由**之前**（listen/init 时才挂载路由），因此 /api 与静态前缀
    // 必须 `next()` 交还给后续路由，不能自行返回 404——否则同源部署下所有接口都会被这里吞掉。
    app.use((req: Request, res: Response, next: NextFunction) => {
      // 只接管浏览器页面导航：GET/HEAD 且显式接受 HTML；资源 / XHR 请求继续走后续路由
      if ((req.method !== 'GET' && req.method !== 'HEAD') || !req.headers.accept?.includes('text/html')) {
        next();
        return;
      }
      const path = req.path;
      if (path.startsWith('/api') || path.startsWith(`/${config.upload.route}`)) {
        next();
        return;
      }
      res.sendFile('index.html', { root: webDistDir });
    });
    logger.log(`前端产物已托管: ${webDistDir}`);
  }
}
