import { cookies } from 'next/headers';
import { cache } from 'react';
import { USER_SESSION_COOKIE } from '@/constant/auth';
import type { GoogleIdentity } from '@/lib/google-oauth';
import { goFetch } from '@/lib/server/api-client';

type UserVerifyResponse = {
  success: boolean;
  error?: string;
  accountId?: string;
  username?: string;
  email?: string;
  hasPassword?: boolean;
  googleLinked?: boolean;
  loggedInAt?: string;
  expiresAt?: number;
  sessionId?: string;
  recoveredSession?: boolean;
};

type UserLoginResponse = {
  token: string;
  account: {
    id: string;
    username: string;
    email?: string | null;
    provider?: string;
    hasPassword?: boolean;
    googleLinked?: boolean;
    createdAt?: string;
  };
  expiresIn: number;
  sessionId: string;
  loggedInAt: string;
};

/** 账户设置页所需的账户安全信息 */
export type UserAccountInfo = {
  id: string;
  username: string;
  email: string;
  provider: string;
  hasPassword: boolean;
  googleLinked: boolean;
  createdAt?: string;
};

export type CurrentUser = {
  id: string;
  username: string;
  email?: string | null;
};

type CookieStoreLike = {
  set: (name: string, value: string, options?: Record<string, unknown>) => void;
  delete: (name: string) => void;
};

/**
 * 前台会话 Cookie 选项（Server Action 与 Route Handler 共用）。
 * Google OAuth 回调来自跨站跳转，传入 'lax' 确保紧接着的回跳请求能带上 Cookie。
 */
export function userSessionCookieOptions(
  maxAgeSec: number,
  sameSite: 'strict' | 'lax' = 'strict'
) {
  const isSecure =
    process.env.COOKIE_SECURE === 'true' ||
    (process.env.COOKIE_SECURE !== 'false' &&
      process.env.NODE_ENV === 'production');
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite,
    maxAge: maxAgeSec,
    path: '/',
  };
}

function setCookie(
  cookieStore: CookieStoreLike,
  name: string,
  value: string,
  maxAgeSec: number
): void {
  cookieStore.set(name, value, userSessionCookieOptions(maxAgeSec));
}

const verifyUserToken = cache(async (token: string) => {
  return goFetch<UserVerifyResponse>('/api/user/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
});

/**
 * Server Components/Actions 中获取当前前台登录用户。
 * 同一请求内与 verifyUserAuth 共用一次 Go 校验。
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(USER_SESSION_COOKIE);
    if (!token?.value) return null;
    const res = await verifyUserToken(token.value);
    if (!res?.success || !res.accountId || !res.username) return null;
    return {
      id: res.accountId,
      username: res.username,
      email: res.email ?? null,
    };
  } catch {
    return null;
  }
});

/**
 * 用于 Server Action：{ success, userId, username, error }
 */
export const verifyUserAuth = cache(async () => {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(USER_SESSION_COOKIE);
    if (!token?.value) {
      return { success: false as const, error: 'Not logged in' };
    }
    const res = await verifyUserToken(token.value);
    if (!res?.success || !res.accountId) {
      return {
        success: false as const,
        error: res?.error ?? 'Session expired',
      };
    }
    return {
      success: true as const,
      userId: res.accountId,
      username: res.username,
    };
  } catch {
    return { success: false as const, error: 'Session expired' };
  }
});

// —— 给 actions/user-auth.ts 调用的内部辅助 ——

export async function userLoginViaGo(username: string, password: string) {
  const res = await goFetch<UserLoginResponse>('/api/user/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  const cookieStore = await cookies();
  setCookie(cookieStore, USER_SESSION_COOKIE, res.token, res.expiresIn);
  return res;
}

export async function userLogoutViaGo(): Promise<{ success: boolean }> {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE)?.value ?? '';
  try {
    if (token) {
      await goFetch<{ success: boolean }>('/api/user/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
    }
  } catch {
    // 尽力而为
  }
  cookieStore.delete(USER_SESSION_COOKIE);
  return { success: true };
}

/**
 * Google 登录：把 Google 已验证身份交给 Go 后端换取 user-session 令牌。
 * 不在此处写 Cookie，由调用方（Route Handler）按需写入响应。
 */
export async function userLoginGoogleViaGo(
  identity: GoogleIdentity
): Promise<UserLoginResponse> {
  return goFetch<UserLoginResponse>('/api/user/auth/google', {
    method: 'POST',
    body: JSON.stringify({
      sub: identity.sub,
      email: identity.email,
      emailVerified: identity.emailVerified,
      name: identity.name,
    }),
  });
}

/** 读取当前 user-session token（仅服务端）；未登录返回空串 */
export async function getUserSessionToken(): Promise<string> {
  const cookieStore = await cookies();
  return cookieStore.get(USER_SESSION_COOKIE)?.value ?? '';
}

function bearer(token: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** 账户设置页：读取当前账户的登录方式状态 */
export async function getUserAccountViaGo(): Promise<UserAccountInfo | null> {
  try {
    const token = await getUserSessionToken();
    if (!token) return null;
    return await goFetch<UserAccountInfo>('/api/user/account', {
      headers: bearer(token),
    });
  } catch {
    return null;
  }
}

/** 设置/修改密码：已有密码时需提供 currentPassword */
export async function setUserPasswordViaGo(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const token = await getUserSessionToken();
  await goFetch('/api/user/account/password', {
    method: 'PUT',
    headers: bearer(token),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

/** 解绑 Google（Go 侧要求已设置密码） */
export async function unlinkUserGoogleViaGo(): Promise<void> {
  const token = await getUserSessionToken();
  await goFetch('/api/user/account/google', {
    method: 'DELETE',
    headers: bearer(token),
  });
}

/** 把已校验的 Google 身份绑定到指定会话账户（OAuth 回调中使用） */
export async function linkUserGoogleViaGo(
  token: string,
  sub: string
): Promise<void> {
  await goFetch('/api/user/account/google/link', {
    method: 'POST',
    headers: bearer(token),
    body: JSON.stringify({ sub }),
  });
}

/** 忘记密码：Next 校验邮箱验证码后调用（内部接口，无需用户会话） */
export async function resetUserPasswordViaGo(
  email: string,
  password: string
): Promise<void> {
  await goFetch('/api/user/account/password/reset', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}
