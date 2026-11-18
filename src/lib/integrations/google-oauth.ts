/**
 * Google OAuth 服务端工具（仅 Server 侧可用）。
 *
 * 流程：/next-api/auth/google/start 生成 state + PKCE → Google 授权页
 * → /next-api/auth/google/callback 校验 state → code 换 access_token
 * → userinfo 取已验证身份 → 交给 Go 后端签发 user-session。
 */

import { NextResponse } from 'next/server';
import { APP_URL } from '@/config/env';
import { i18nConfig } from '@/i18n/i18n.config';

export const GOOGLE_AUTH_ENDPOINT =
  'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_ENDPOINT =
  'https://openidconnect.googleapis.com/v1/userinfo';

/** 临时 Cookie：state / PKCE verifier / 登录成功后回跳路径，10 分钟内有效 */
export const GOOGLE_STATE_COOKIE = 'google-oauth-state';
export const GOOGLE_VERIFIER_COOKIE = 'google-oauth-verifier';
export const GOOGLE_REDIRECT_COOKIE = 'google-oauth-redirect';
/** 流程模式：login（默认）| link（把 Google 绑定到当前登录账户） */
export const GOOGLE_MODE_COOKIE = 'google-oauth-mode';
/**
 * 绑定流程专用的会话令牌副本。
 * user-session 默认 SameSite=Strict，跨站从 Google 回跳时不会携带；
 * 这里用 Lax 的临时 Cookie 承载，回调结束立即删除。
 */
export const GOOGLE_LINK_TOKEN_COOKIE = 'google-oauth-link-token';
const TEMP_COOKIE_MAX_AGE = 600;

export type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type GoogleIdentity = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
};

/** 读取 Google OAuth 配置；缺少任一必要变量时返回 null（前端据此隐藏按钮） */
export function getGoogleOAuthConfig(): GoogleOAuthConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() ||
    `${APP_URL}/next-api/auth/google/callback`;

  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri };
}

export function isGoogleOAuthEnabled(): boolean {
  return getGoogleOAuthConfig() !== null;
}

/** 生成 URL 安全的随机串（state / PKCE verifier） */
export function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

/** PKCE S256 challenge */
export async function createPkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier)
  );
  return toBase64Url(new Uint8Array(digest));
}

/**
 * 只允许站内相对路径回跳，避免 open redirect。
 * 拒绝 `//evil.com`、`/\evil.com` 等协议相对写法。
 */
export function sanitizeRedirectPath(raw: string | null | undefined): string {
  const value = (raw ?? '').trim();
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.startsWith('/\\')
  ) {
    return '/';
  }
  return value;
}

/** 根据回跳路径推断语言前缀，生成带错误码的登录页地址 */
export function signinPathFor(target: string, errorCode?: string): string {
  const first = target.split('?')[0].split('/').filter(Boolean)[0];
  const prefix = i18nConfig.locales.includes(first) ? `/${first}` : '';
  const base = `${prefix}/signin`;
  if (!errorCode) return base;
  return `${base}?${new URLSearchParams({ error: errorCode, redirect: target }).toString()}`;
}

/** 在站内相对路径后追加查询参数（已有查询串时用 &） */
export function appendQuery(path: string, params: Record<string, string>): string {
  const query = new URLSearchParams(params).toString();
  if (!query) return path;
  return `${path}${path.includes('?') ? '&' : '?'}${query}`;
}

/** 根据回跳路径推断语言前缀，得到该语言下的账户设置页地址 */
export function settingsPathFor(target: string): string {
  const first = target.split('?')[0].split('/').filter(Boolean)[0];
  return i18nConfig.locales.includes(first)
    ? `/${first}/settings`
    : '/settings';
}

/**
 * 302 跳转到站内相对路径。
 * 必须用相对 Location：反向代理（Docker/Tunnel）会把上游 Host 改写成容器主机名，
 * 若用 req.url 拼绝对地址，浏览器会被跳到内网域名，且 Cookie 因跨站全部丢失。
 */
export function redirectToPath(path: string): NextResponse {
  return new NextResponse(null, {
    status: 302,
    headers: { Location: path },
  });
}

/** OAuth 临时 Cookie（回调来自 Google 的顶层跳转，必须 SameSite=Lax 才会携带） */
export function temporaryCookieOptions() {
  const isSecure =
    process.env.COOKIE_SECURE === 'true' ||
    (process.env.COOKIE_SECURE !== 'false' &&
      process.env.NODE_ENV === 'production');
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: TEMP_COOKIE_MAX_AGE,
  };
}

/** 用授权码换取 access_token；失败返回 null（由调用方映射为用户可读错误） */
export async function exchangeCodeForAccessToken(
  config: GoogleOAuthConfig,
  code: string,
  codeVerifier: string
): Promise<string | null> {
  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: unknown };
  return typeof data.access_token === 'string' && data.access_token
    ? data.access_token
    : null;
}

/**
 * 用 access_token 读取 Google 身份。
 * token 由本服务端经 TLS 直接向 Google 换取，故 userinfo 结果可信。
 */
export async function fetchGoogleIdentity(
  accessToken: string
): Promise<GoogleIdentity | null> {
  const res = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    sub?: unknown;
    email?: unknown;
    email_verified?: unknown;
    name?: unknown;
  };
  if (typeof data.sub !== 'string' || typeof data.email !== 'string') {
    return null;
  }
  return {
    sub: data.sub,
    email: data.email,
    emailVerified: data.email_verified === true,
    name: typeof data.name === 'string' ? data.name : '',
  };
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
