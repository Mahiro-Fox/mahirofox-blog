import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { USER_SESSION_COOKIE } from '@/constant/auth';
import {
  createPkceChallenge,
  getGoogleOAuthConfig,
  GOOGLE_AUTH_ENDPOINT,
  GOOGLE_LINK_TOKEN_COOKIE,
  GOOGLE_MODE_COOKIE,
  GOOGLE_REDIRECT_COOKIE,
  GOOGLE_STATE_COOKIE,
  GOOGLE_VERIFIER_COOKIE,
  randomToken,
  redirectToPath,
  sanitizeRedirectPath,
  signinPathFor,
  temporaryCookieOptions,
} from '@/lib/google-oauth';
import { createLogger } from '@/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const logger = createLogger('GoogleOAuthStart');

/**
 * GET /next-api/auth/google/start?redirect=/xxx[&mode=link]
 * 生成 state + PKCE，写入临时 Cookie 后跳转 Google 授权页。
 * mode=link：把 Google 绑定到当前登录账户，需要已有 user-session。
 */
export async function GET(req: NextRequest) {
  const mode =
    req.nextUrl.searchParams.get('mode') === 'link' ? 'link' : 'login';
  const redirectPath = sanitizeRedirectPath(
    req.nextUrl.searchParams.get('redirect')
  );
  const config = getGoogleOAuthConfig();
  if (!config) {
    logger.warn('Google OAuth 未配置，已拒绝发起登录');
    return redirectToPath(signinPathFor(redirectPath, 'GOOGLE_NOT_CONFIGURED'));
  }

  // 绑定流程必须已登录：把当前会话令牌复制到 Lax 临时 Cookie，供跨站回调读取
  let linkToken = '';
  if (mode === 'link') {
    linkToken = (await cookies()).get(USER_SESSION_COOKIE)?.value ?? '';
    if (!linkToken) {
      logger.warn('未登录时发起 Google 绑定，已拒绝');
      return redirectToPath(signinPathFor(redirectPath, 'LOGIN_REQUIRED'));
    }
  }

  logger.info('发起 Google OAuth', {
    redirectUri: config.redirectUri,
    mode,
  });

  const state = randomToken(32);
  const verifier = randomToken(48);
  const challenge = await createPkceChallenge(verifier);

  const authorizeUrl = new URL(GOOGLE_AUTH_ENDPOINT);
  authorizeUrl.searchParams.set('client_id', config.clientId);
  authorizeUrl.searchParams.set('redirect_uri', config.redirectUri);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', 'openid email profile');
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('code_challenge', challenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');
  authorizeUrl.searchParams.set('prompt', 'select_account');

  const res = NextResponse.redirect(authorizeUrl.toString());
  const options = temporaryCookieOptions();
  res.cookies.set(GOOGLE_STATE_COOKIE, state, options);
  res.cookies.set(GOOGLE_VERIFIER_COOKIE, verifier, options);
  res.cookies.set(GOOGLE_REDIRECT_COOKIE, redirectPath, options);
  res.cookies.set(GOOGLE_MODE_COOKIE, mode, options);
  if (mode === 'link') {
    res.cookies.set(GOOGLE_LINK_TOKEN_COOKIE, linkToken, options);
  }
  return res;
}
