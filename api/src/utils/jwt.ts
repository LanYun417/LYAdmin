/**
 * JWT 工具。
 * 模块职责：签发与校验 accessToken / refreshToken，统一密钥与有效期来源。
 */
import jwt from 'jsonwebtoken';
import { config } from '@/config';
import type { JwtPayload, JwtUserPayload } from '@/types';

/** 计算 accessToken 有效期（秒），用于响应体透出。 */
export const ACCESS_EXPIRES_IN = config.jwt.accessExpiresIn;

/**
 * 签发 accessToken（默认 2h）。
 * @param payload 用户基础信息
 */
export function signAccessToken(payload: JwtUserPayload): string {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

/**
 * 签发 refreshToken（默认 7d）。
 * @param payload 用户基础信息
 */
export function signRefreshToken(payload: JwtUserPayload): string {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

/**
 * 校验并解码 accessToken。
 * @throws jwt.JsonWebTokenError | jwt.TokenExpiredError
 */
export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwt.accessSecret) as JwtPayload;
}

/**
 * 校验并解码 refreshToken。
 * @throws jwt.JsonWebTokenError | jwt.TokenExpiredError
 */
export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwt.refreshSecret) as JwtPayload;
}
