import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  createPkceChallenge,
  getGoogleOAuthConfig,
  GOOGLE_AUTH_ENDPOINT,
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
 * GET /next-api/auth/google/start?redirect=/xxx
 * 生成 state + PKCE，写入临时 Cookie 后跳转 Google 授权页。
 */
export async function GET(req: NextRequest) {
  const redirectPath = sanitizeRedirectPath(
    req.nextUrl.searchParams.get('redirect')
  );
  const config = getGoogleOAuthConfig();
  if (!config) {
    logger.warn('Google OAuth 未配置，已拒绝发起登录');
    return redirectToPath(signinPathFor(redirectPath, 'GOOGLE_NOT_CONFIGURED'));
  }

  logger.info('发起 Google OAuth', { redirectUri: config.redirectUri });

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
  return res;
}
