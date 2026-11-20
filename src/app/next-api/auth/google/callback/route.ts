import { USER_SESSION_COOKIE } from '@/constant';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  linkUserGoogleViaGo,
  userLoginGoogleViaGo,
  userSessionCookieOptions,
} from '@/lib/auth/user-auth';
import { GoApiError } from '@/lib/integrations/go-api';
import {
  appendQuery,
  exchangeCodeForAccessToken,
  fetchGoogleIdentity,
  getGoogleOAuthConfig,
  GOOGLE_LINK_TOKEN_COOKIE,
  GOOGLE_MODE_COOKIE,
  GOOGLE_REDIRECT_COOKIE,
  GOOGLE_STATE_COOKIE,
  GOOGLE_VERIFIER_COOKIE,
  redirectToPath,
  sanitizeRedirectPath,
  settingsPathFor,
  signinPathFor,
} from '@/lib/integrations/google-oauth';
import { createLogger } from '@/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const logger = createLogger('GoogleOAuthCallback');

/** 清理一次性 OAuth Cookie */
function clearTemporaryCookies(res: NextResponse) {
  res.cookies.delete(GOOGLE_STATE_COOKIE);
  res.cookies.delete(GOOGLE_VERIFIER_COOKIE);
  res.cookies.delete(GOOGLE_REDIRECT_COOKIE);
  res.cookies.delete(GOOGLE_MODE_COOKIE);
  res.cookies.delete(GOOGLE_LINK_TOKEN_COOKIE);
}

/**
 * GET /next-api/auth/google/callback?code=&state=
 * 校验 state → 换取 Google 身份 → Go 后端登录/注册（或绑定当前账户）
 * → 写 user-session → 回跳原页面。
 * 失败统一回跳并带稳定错误码，由前端映射为多语言文案。
 */
export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get('state') ?? '';
  const code = req.nextUrl.searchParams.get('code') ?? '';
  const googleError = req.nextUrl.searchParams.get('error');
  const cookieState = req.cookies.get(GOOGLE_STATE_COOKIE)?.value ?? '';
  const verifier = req.cookies.get(GOOGLE_VERIFIER_COOKIE)?.value ?? '';
  const mode =
    req.cookies.get(GOOGLE_MODE_COOKIE)?.value === 'link' ? 'link' : 'login';
  const linkToken = req.cookies.get(GOOGLE_LINK_TOKEN_COOKIE)?.value ?? '';
  const redirectPath = sanitizeRedirectPath(
    req.cookies.get(GOOGLE_REDIRECT_COOKIE)?.value
  );

  const fail = (errorCode: string) => {
    logger.warn('Google OAuth 失败，回跳', {
      errorCode,
      mode,
      redirectPath,
      redirectUri: getGoogleOAuthConfig()?.redirectUri,
    });
    // 本地密码账户误用 Google 登录：回登录页，并让登录后直接前往设置页关联
    if (errorCode === 'GOOGLE_LINK_REQUIRED') {
      const res = redirectToPath(
        signinPathFor(settingsPathFor(redirectPath), errorCode)
      );
      clearTemporaryCookies(res);
      return res;
    }
    // 绑定流程中用户已登录：把错误码带回设置页，而不是跳登录页
    const res =
      mode === 'link' && errorCode !== 'LOGIN_REQUIRED'
        ? redirectToPath(appendQuery(redirectPath, { google_error: errorCode }))
        : redirectToPath(signinPathFor(redirectPath, errorCode));
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

    // —— 绑定模式：把 Google 绑定到当前登录账户 ——
    if (mode === 'link') {
      if (!linkToken) return fail('LOGIN_REQUIRED');
      await linkUserGoogleViaGo(linkToken, identity.sub);
      logger.info('Google 绑定成功');
      const res = redirectToPath(
        appendQuery(redirectPath, { google: 'linked' })
      );
      clearTemporaryCookies(res);
      return res;
    }

    // —— 登录模式：登录或注册 ——
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
      if (error.code === 'GOOGLE_LINK_REQUIRED') {
        return fail('GOOGLE_LINK_REQUIRED');
      }
      if (error.code === 'GOOGLE_ALREADY_LINKED') {
        return fail('GOOGLE_ALREADY_LINKED');
      }
      if (error.status === 409) return fail('GOOGLE_EMAIL_TAKEN');
      if (error.status === 403) return fail('GOOGLE_EMAIL_UNVERIFIED');
      if (error.status === 401) return fail('LOGIN_REQUIRED');
    }
    logger.error('Google OAuth 失败', error);
    return fail('GOOGLE_FAILED');
  }
}
