/**
 * JWT 服务：签发与校验 accessToken / refreshToken。
 * 模块职责：统一密钥与有效期来源。
 *
 * 为何用 jose 而非 jsonwebtoken：
 * - 纯 ESM，与本项目 `"type": "module"` 天然契合，无需 CJS interop；
 * - TS 原生编写，类型完备，无需社区维护的 @types；
 * - 错误分类清晰（`errors.JWTExpired` / `errors.JWTInvalid`），
 *   便于给出「登录已过期」与「访问令牌无效」的差异化文案。
 */
import { Injectable } from '@nestjs/common';
import { errors as joseErrors, jwtVerify, SignJWT } from 'jose';
import { config } from './config.js';
import type { JwtPayload, JwtUserPayload } from './types.js';

/** 把密钥字符串转为 jose 所需的 Uint8Array。 */
function toSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

@Injectable()
export class JwtService {
  /** accessToken 有效期（供响应体透出，如需展示过期时间）。 */
  readonly accessExpiresIn = config.jwt.accessExpiresIn;
  readonly refreshExpiresIn = config.jwt.refreshExpiresIn;

  private readonly accessKey = toSecretKey(config.jwt.accessSecret);
  private readonly refreshKey = toSecretKey(config.jwt.refreshSecret);

  /**
   * 签发 accessToken（默认 2h）。
   *
   * 载荷形状：顶层直接放 `userId` / `username`，
   * 外加 jose 自动写入的 `iat` / `exp`（鉴权判定依赖 `iat`）。
   */
  async signAccessToken(payload: JwtUserPayload): Promise<string> {
    return new SignJWT({ userId: payload.userId, username: payload.username })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(config.jwt.accessExpiresIn)
      .sign(this.accessKey);
  }

  /** 签发 refreshToken（默认 7d）。 */
  async signRefreshToken(payload: JwtUserPayload): Promise<string> {
    return new SignJWT({ userId: payload.userId, username: payload.username })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(config.jwt.refreshExpiresIn)
      .sign(this.refreshKey);
  }

  /**
   * 校验并解码 accessToken。
   * @throws jose.errors.JWTExpired 令牌已过期
   * @throws jose.errors.JWTInvalid 令牌无效（签名不符 / 结构错误）
   */
  async verifyAccessToken(token: string): Promise<JwtPayload> {
    const { payload } = await jwtVerify(token, this.accessKey);
    return {
      userId: Number(payload.userId),
      username: typeof payload.username === 'string' ? payload.username : '',
      iat: Number(payload.iat ?? 0),
      exp: Number(payload.exp ?? 0),
    };
  }

  /**
   * 校验并解码 refreshToken。
   * @throws jose.errors.JWTExpired / jose.errors.JWTInvalid
   */
  async verifyRefreshToken(token: string): Promise<JwtPayload> {
    const { payload } = await jwtVerify(token, this.refreshKey);
    return {
      userId: Number(payload.userId),
      username: typeof payload.username === 'string' ? payload.username : '',
      iat: Number(payload.iat ?? 0),
      exp: Number(payload.exp ?? 0),
    };
  }

  /** 判断是否为「令牌过期」错误（用于给出更精确的提示文案）。 */
  isExpiredError(error: unknown): boolean {
    return error instanceof joseErrors.JWTExpired;
  }

  /** 判断是否为「令牌无效」错误。 */
  isInvalidError(error: unknown): boolean {
    return error instanceof joseErrors.JWTInvalid;
  }
}
