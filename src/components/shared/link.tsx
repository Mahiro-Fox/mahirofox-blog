// src/components/shared/link.tsx
'use client';

import { useRouteLoading } from '@/context/route-loading-provider';
import NextLink, { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, type ComponentProps, type MouseEvent } from 'react';
import { i18nConfig } from '@/i18n/i18n.config';
import { useLocale } from '@/i18n/use-locale';

type LinkProps = ComponentProps<typeof NextLink>;

/**
 * 内嵌于 <Link> 内部的加载状态桥接组件。
 * useLinkStatus 必须作为 Link 的后代组件调用，这里将其 pending 状态
 * 上报到全局 RouteLoadingProvider，驱动顶部加载进度条。
 */
function LinkStatusBridge() {
  const { pending } = useLinkStatus();
  const { begin, end } = useRouteLoading();
  const id = useId();

  useEffect(() => {
    if (pending) {
      begin(id);
      return () => end(id);
    }
  }, [pending, begin, end, id]);

  return null;
}

function localizeHref(href: string, locale: string): string {
  // 只处理站内绝对路径，外链、锚点、mailto 等原样返回
  if (!href.startsWith('/') || href.startsWith('//')) return href;

  // 默认语言不加前缀（因为 middleware 是 rewrite，不需要显式前缀）
  if (locale === i18nConfig.defaultLang) return href;

  // 非默认语言，拼上前缀（避免 /zh/zh 这种重复拼接）
  return `/${locale}${href === '/' ? '' : href}`;
}

/** 去掉末尾斜杠，便于比较路径是否相同 */
function normalizePath(path: string): string {
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path;
}

/**
 * 自动根据当前语言添加前缀的链接组件
 */
export const Link = ({ href, children, onClick, ...props }: LinkProps) => {
  const locale = useLocale();
  const pathname = usePathname();
  const localizedHref =
    typeof href === 'string' ? localizeHref(href, locale) : href; // href 是 UrlObject 的情况暂不处理，按需扩展

  /**
   * 同页锚点手动滚动：
   * 当 URL 已经带有同一个 hash 时，Next 会把这次点击当成“导航到当前地址”而触发整页刷新，
   * 这里拦截后自行平滑滚动，保证重复点击也能回到目标位置。
   */
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      typeof localizedHref !== 'string'
    ) {
      return;
    }

    const hashIndex = localizedHref.indexOf('#');
    if (hashIndex === -1) return;

    const hash = localizedHref.slice(hashIndex + 1);
    if (!hash) return;

    const targetPath = localizedHref.slice(0, hashIndex) || pathname;
    if (normalizePath(targetPath) !== normalizePath(pathname)) return;

    const target = document.getElementById(decodeURIComponent(hash));
    if (!target) return;

    event.preventDefault();
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    target.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    });
    window.history.replaceState(null, '', `#${hash}`);
  };

  return (
    <NextLink href={localizedHref} onClick={handleClick} {...props}>
      {children}
      <LinkStatusBridge />
    </NextLink>
  );
};

Link.displayName = 'Link';
