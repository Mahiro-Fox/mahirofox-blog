'use client';

import { useEffect, useRef } from 'react';

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

// 全局只加载一次脚本；并发渲染共享同一个 Promise
let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`
    );
    const script = existing ?? document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener(
      'error',
      () => {
        scriptPromise = null;
        reject(new Error('turnstile script load failed'));
      },
      { once: true }
    );
    if (!existing) document.head.appendChild(script);
  });
  return scriptPromise;
}

interface TurnstileWidgetProps {
  /** Cloudflare Turnstile action，用于服务端校验 token 的来源场景 */
  action: string;
  /** token 回调；空字符串表示过期/失败，调用方应视为无效 */
  onToken: (token: string) => void;
  className?: string;
}

export const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

// 站点密钥在构建期内联，缺失时小部件会静默不渲染、服务端一律判失败；
// 这里显式报错一次，避免"前端没报错、只是提交后提示人机验证未通过"这种难查的情况
let warnedMissingSiteKey = false;
function warnMissingSiteKey(): void {
  if (warnedMissingSiteKey) return;
  warnedMissingSiteKey = true;
  console.error(
    '[turnstile] NEXT_PUBLIC_TURNSTILE_SITE_KEY 为空：验证小部件不会渲染，' +
      '服务端会判定人机验证失败。该变量在 next build 时内联，' +
      '请在构建期注入（docker 需 build args）后重新构建。'
  );
}

/** 显式渲染的 Turnstile 小部件；key 变化时会卸载旧实例并重新获取 token */
export function TurnstileWidget({
  action,
  onToken,
  className,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) {
      warnMissingSiteKey();
      return;
    }
    if (!containerRef.current) return;

    let widgetId: string | undefined;
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action,
          theme: 'auto',
          callback: (token: string) => onToken(token),
          'error-callback': () => onToken(''),
          'expired-callback': () => onToken(''),
        });
      })
      .catch(() => onToken(''));

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId);
      }
    };
  }, [action, onToken]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={containerRef} className={className} />;
}
