/**
 * 公开环境变量（NEXT_PUBLIC_*）的统一出口。
 *
 * 这类变量会在 next build 时被字面量内联进客户端产物：**只有构建期注入才生效**，
 * 运行期通过 docker environment 再传同名变量对浏览器端毫无作用。
 * 也正因为如此，这里不提供任何兜底值——缺失时直接抛错，
 * 而不是把 undefined 拼进 URL、SEO 元数据、跳转地址里，
 * 最后变成线上 404 或搜索引擎收录错误域名。
 */

/** 去掉首尾空白与结尾斜杠，避免拼出双斜杠或带空格的 URL */
function normalize(raw: string | undefined): string {
  return (raw ?? '').trim().replace(/\/+$/, '');
}

function missingError(name: string): Error {
  return new Error(
    `[env] 缺少必填的公开环境变量 ${name}。` +
      '该变量在 next build 时内联，必须在构建期注入' +
      '（docker 走 build args，本地走 .env），运行期 environment 不生效。'
  );
}

/** 必填的绝对地址（如站点根地址） */
function requiredUrl(name: string, raw: string | undefined): string {
  const value = normalize(raw);
  if (!value) throw missingError(name);
  try {
    // 仅校验合法性，不保留实例
    void new URL(value);
  } catch {
    throw new Error(`[env] ${name} 不是合法的绝对 URL：${value}`);
  }
  return value;
}

/** 站点根地址，必填，不带结尾斜杠（如 https://mahirofox.com） */
export const APP_URL = requiredUrl(
  'NEXT_PUBLIC_APP_URL',
  process.env.NEXT_PUBLIC_APP_URL
);

/**
 * uploads 静态资源的外部域名（Cloudflare R2）。
 * 合法取值为空字符串：表示不做 /uploads/* 的 301，由 Next 本地目录兜底。
 */
export const UPLOADS_ORIGIN = normalize(
  process.env.NEXT_PUBLIC_UPLOADS_ORIGIN
);
