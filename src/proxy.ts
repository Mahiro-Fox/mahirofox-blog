import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { pageRoutesConfig } from '@/config/common';
import { USER_SESSION_COOKIE } from '@/constant/auth';
import { i18nConfig } from '@/i18n/i18n.config';

/**
 * 存量静态资源已从服务器本地磁盘迁移到 Cloudflare R2（static.mahirofox.com，保留 uploads/ 前缀）。
 * 数据库与代码里继续使用 `/uploads/xxx` 逻辑路径，在入口统一 301 到 R2，
 * 避免逐页面、逐字段改路径，也保证富文本/动态数据不遗漏。
 *
 * 生产环境前置 Nginx 时，/uploads/ 请求通常不会到达 Next，需要在 Nginx 中配置同样的 301。
 */
const UPLOADS_ORIGIN =
  process.env.NEXT_PUBLIC_UPLOADS_ORIGIN ||
  (process.env.NODE_ENV === 'production' ? 'https://static.mahirofox.com' : '');

function redirectUploads(req: NextRequest): NextResponse | null {
  const { pathname } = req.nextUrl;
  if (!UPLOADS_ORIGIN || !pathname.startsWith('/uploads/')) return null;

  const response = NextResponse.redirect(
    `${UPLOADS_ORIGIN}${pathname}${req.nextUrl.search}`,
    301
  );
  // 让浏览器长期缓存这次跳转，后续直接命中 R2/CDN
  response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  return response;
}

// proxy 只做「有没有前台 user-session cookie」的粗校验。
// needAuth 路由是前台页面（如 /secret），登录页是 /signin。
// 真正的 JWT 校验在 Server Action / Server Component 里调 Go verify。
function isUserLoggedIn(req: NextRequest): boolean {
  return Boolean(req.cookies.get(USER_SESSION_COOKIE)?.value);
}

// 获取需要保护的路由（原实现不动）
function getProtectedRoutes() {
  const routes = new Set<string>();
  pageRoutesConfig.forEach((route) => {
    if (route.needAuth) {
      if (route.navHref) routes.add(route.navHref);
      if (route.adminHref) routes.add(route.adminHref);
    }
  });
  return Array.from(routes);
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // 全站只在这里下发 CSP。影视/音乐地址来自内容，connect/media 不能收成固定域名。
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data: https: http:",
      "media-src 'self' blob: data: https: http:",
      "font-src 'self' data:",
      "connect-src 'self' https://nominatim.openstreetmap.org https: http:",
      "frame-ancestors 'none'",
    ].join('; ')
  );
  return response;
}

const protectedRoutes = getProtectedRoutes();

export default async function middleware(req: NextRequest) {
  const uploadsRedirect = redirectUploads(req);
  if (uploadsRedirect) return uploadsRedirect;

  if (req.headers.get('x-i18n-rewritten')) {
    return addSecurityHeaders(NextResponse.next());
  }
  const { pathname } = req.nextUrl;
  const defaultLang = i18nConfig.defaultLang;
  const locales = i18nConfig.locales;
  const cookieLocale = req.cookies.get('NEXT_LOCALE')?.value || defaultLang;

  const pathSegments = pathname.split('/').filter(Boolean);
  const firstSegment = pathSegments[0];
  const hasLocaleInPath = locales.includes(firstSegment);

  if (hasLocaleInPath && firstSegment === defaultLang) {
    const newPath = `/${pathSegments.slice(1).join('/')}`;
    const url = req.nextUrl.clone();
    url.pathname = newPath || '/';
    return NextResponse.redirect(url);
  }

  let rewriteUrl: URL | null = null;
  let visibleLocalePrefix = '';

  if (hasLocaleInPath) {
    visibleLocalePrefix = `/${firstSegment}`;
  } else {
    if (
      cookieLocale &&
      locales.includes(cookieLocale) &&
      cookieLocale !== defaultLang
    ) {
      const url = req.nextUrl.clone();
      url.pathname = `/${cookieLocale}${pathname === '/' ? '' : pathname}`;
      return NextResponse.redirect(url);
    }
    const newPath = `/${defaultLang}${pathname === '/' ? '' : pathname}`;
    rewriteUrl = req.nextUrl.clone();
    rewriteUrl.pathname = newPath;
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', pathname);
  requestHeaders.set('x-i18n-rewritten', 'true'); // ★ 新增

  const pathnameWithoutLocale = hasLocaleInPath
    ? '/' + pathSegments.slice(1).join('/') || '/'
    : pathname;

  const isProtectedRoute = protectedRoutes.some((route) =>
    pathnameWithoutLocale.startsWith(route)
  );

  if (isProtectedRoute) {
    const loggedIn = isUserLoggedIn(req);
    const loginPath = `${visibleLocalePrefix}/signin`;
    if (!loggedIn) {
      const loginUrl = new URL(loginPath, req.url);
      loginUrl.searchParams.set('redirect', pathname);
      return addSecurityHeaders(NextResponse.redirect(loginUrl));
    }
    const response = rewriteUrl
      ? NextResponse.rewrite(rewriteUrl, {
          request: { headers: requestHeaders },
        })
      : NextResponse.next({ request: { headers: requestHeaders } });
    return addSecurityHeaders(response);
  }

  const response = rewriteUrl
    ? NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } })
    : NextResponse.next({ request: { headers: requestHeaders } });
  return addSecurityHeaders(response);
}

export const config = {
  matcher: [
    '/uploads/:path*',
    '/((?!api|next-api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)',
  ],
};
