/**
 * 全站 Content-Security-Policy 配置
 *
 * 单独成文件（不依赖 next/server）有两个好处：
 * 1. proxy.ts 只负责下发，策略本身可以单独评审、单独跑单测；
 * 2. Cloudflare 相关域名集中一处，新增能力不用再翻 CSP 字符串。
 */

/**
 * Cloudflare 常用能力域名（一键放通）
 *
 * 站点挂在 Cloudflare 后面时，浏览器侧会用到下面这些主机；改这里，
 * script / frame / connect 三个指令自动带上。
 *
 * - challenges.cloudflare.com      Turnstile 人机验证（脚本 + iframe + 校验请求）
 * - static.cloudflareinsights.com  Web Analytics / RUM 采集脚本
 * - cloudflareinsights.com         Web Analytics 上报接口
 * - ajax.cloudflare.com            Rocket Loader
 *
 * 注意：站点经 CF 代理时 /cdn-cgi/* 属于同源路径，已被 'self' 覆盖，无需单列。
 *
 * 也不要把 Turnstile 挑战页自己的白名单照搬过来。浏览器里那条
 *   "Connecting to 'data:,' violates ... https://hagen.challenges.cloudflare.com ...
 *    https://ca1.cloudflarecaptcha.com"
 * 报的是 challenges.cloudflare.com 这个 iframe **内部文档**的 CSP（区域节点 hagen/brunhild、
 * 内部测试域 dnstest、cloudflarecaptcha 都是它自己的加载源），
 * 由 Cloudflare 下发，我们这条头管不到、也不需要覆盖；`data:,` 那次连接是它的探测请求，
 * 被它自己拦掉属于预期行为，不影响出 token。
 *
 * 真要收紧：connect/frame 若去掉 https: 通配，把上面这几条改成
 * https://*.challenges.cloudflare.com 即可，仍然不必列 dnstest / cloudflarecaptcha。
 */
export const CLOUDFLARE_CSP = {
  /** 允许加载的脚本 */
  script: [
    'https://challenges.cloudflare.com',
    'https://static.cloudflareinsights.com',
    'https://ajax.cloudflare.com',
  ],
  /** 允许被嵌入的 iframe（Turnstile 挑战框） */
  frame: ['https://challenges.cloudflare.com'],
  /** 允许 fetch / XHR（人机验证回调、Analytics 上报） */
  connect: [
    'https://challenges.cloudflare.com',
    'https://cloudflareinsights.com',
  ],
} as const;

/**
 * 影视/音乐地址来自内容，img/media/connect 保留 https: 通配，
 * 不能收成固定域名，否则线上会静默丢资源。
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${CLOUDFLARE_CSP.script.join(' ')}`,
  `frame-src 'self' ${CLOUDFLARE_CSP.frame.join(' ')}`,
  `connect-src 'self' https://nominatim.openstreetmap.org https: http: ${CLOUDFLARE_CSP.connect.join(' ')}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https: http:",
  "media-src 'self' blob: data: https: http:",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
].join('; ');
