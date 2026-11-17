import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { USER_SESSION_COOKIE } from '@/constant/auth';
import {
  exchangeCodeForAccessToken,
  fetchGoogleIdentity,
  getGoogleOAuthConfig,
  GOOGLE_REDIRECT_COOKIE,
  GOOGLE_STATE_COOKIE,
  GOOGLE_VERIFIER_COOKIE,
  redirectToPath,
  sanitizeRedirectPath,
  signinPathFor,
} from '@/lib/google-oauth';
import { GoApiError } from '@/lib/server/api-client';
import {
  userLoginGoogleViaGo,
  userSessionCookieOptions,
} from '@/lib/user-auth';
import { createLogger } from '@/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const logger = createLogger('GoogleOAuthCallback');

/** 清理一次性 OAuth Cookie */
function clearTemporaryCookies(res: NextResponse) {
  res.cookies.delete(GOOGLE_STATE_COOKIE);
  res.cookies.delete(GOOGLE_VERIFIER_COOKIE);
  res.cookies.delete(GOOGLE_REDIRECT_COOKIE);
}

/**
 * GET /next-api/auth/google/callback?code=&state=
 * 校验 state → 换取 Google 身份 → Go 后端登录/注册 → 写 user-session → 回跳原页面。
 * 失败统一回跳登录页并带稳定错误码，由弹窗映射为多语言文案。
 */
export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get('state') ?? '';
  const code = req.nextUrl.searchParams.get('code') ?? '';
  const googleError = req.nextUrl.searchParams.get('error');
  const cookieState = req.cookies.get(GOOGLE_STATE_COOKIE)?.value ?? '';
  const verifier = req.cookies.get(GOOGLE_VERIFIER_COOKIE)?.value ?? '';
  const redirectPath = sanitizeRedirectPath(
    req.cookies.get(GOOGLE_REDIRECT_COOKIE)?.value
  );

  const fail = (errorCode: string) => {
    logger.warn('Google 登录失败，回跳登录页', {
      errorCode,
      redirectPath,
      redirectUri: getGoogleOAuthConfig()?.redirectUri,
    });
    const res = redirectToPath(signinPathFor(redirectPath, errorCode));
    clearTemporaryCookies(res);
    return res;
  };

  if (googleError) {
    return fail(
      googleError === 'access_denied' ? 'GOOGLE_CANCELLED' : 'GOOGLE_FAILED'
    );
  }

  const config = getGoogleOAuthConfig();
  if (!config) return fail('GOOGLE_NOT_CONFIGURED');
  if (!state || !cookieState || state !== cookieState) {
    logger.warn('Google OAuth state 校验失败');
    return fail('GOOGLE_STATE_INVALID');
  }
  if (!code || !verifier) return fail('GOOGLE_FAILED');

  try {
    const accessToken = await exchangeCodeForAccessToken(
      config,
      code,
      verifier
    );
    if (!accessToken) return fail('GOOGLE_FAILED');

    const identity = await fetchGoogleIdentity(accessToken);
    if (!identity) return fail('GOOGLE_FAILED');

    const login = await userLoginGoogleViaGo(identity);

    logger.info('Google 登录成功', {
      accountId: login.account.id,
      provider: login.account.provider,
    });
    const res = redirectToPath(redirectPath);
    res.cookies.set(
      USER_SESSION_COOKIE,
      login.token,
      userSessionCookieOptions(login.expiresIn, 'lax')
    );
    clearTemporaryCookies(res);
    return res;
  } catch (error) {
    if (error instanceof GoApiError) {
      if (error.status === 409) return fail('GOOGLE_EMAIL_TAKEN');
      if (error.status === 403) return fail('GOOGLE_EMAIL_UNVERIFIED');
    }
    logger.error('Google 登录失败', error);
    return fail('GOOGLE_FAILED');
  }
}
