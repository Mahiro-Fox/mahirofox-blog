// 构建期校验：NEXT_PUBLIC_* 会被字面量内联进客户端产物，缺失时构建照样能过，
// 只会在线上拼出 "undefined/xxx" 这种 URL。这里提前拦住，避免又一次"构建成功、线上报错"。
const REQUIRED_PUBLIC_ENV = ['NEXT_PUBLIC_APP_URL'];
const missingPublicEnv = REQUIRED_PUBLIC_ENV.filter(
  (key) => !process.env[key]?.trim()
);
if (missingPublicEnv.length > 0) {
  throw new Error(
    `[next.config] 缺少构建期公开环境变量：${missingPublicEnv.join(', ')}。` +
      '请在 next build 前注入（docker 走 build args，本地走 .env），' +
      '运行期 environment 对浏览器端无效。'
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  devIndicators: false,
  serverExternalPackages: ['@mastra/core', '@mastra/memory', '@mastra/pg'],
  typescript: {
    tsconfigPath: 'tsconfig.build.json',
  },
  images: {
    // 开发环境禁用长期缓存，生产环境使用 1 小时
    minimumCacheTTL: process.env.NODE_ENV === 'production' ? 3600 : 0,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.google.com',
      },
      {
        protocol: 'https',
        hostname: 'mahirofox.com',
      },
      {
        protocol: 'https',
        hostname: 'static.mahirofox.com',
      },
      {
        protocol: 'http',
        hostname: 'p2.music.126.net',
      },
    ],
  },
  pageExtensions: ['ts', 'tsx', 'mdx'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(self), interest-cohort=()',
          },
        ],
      },
      // 生产环境：HTML 页面 - 短期缓存，支持重新验证
      ...(process.env.NODE_ENV === 'production'
        ? [
            {
              source: '/:path((?!\\.\\w+$).)*',
              headers: [
                {
                  key: 'Cache-Control',
                  value: 'public, max-age=0, must-revalidate',
                },
              ],
            },
          ]
        : []),
      // 生产环境：CSS/JS 文件 - 中期缓存，支持重新验证
      ...(process.env.NODE_ENV === 'production'
        ? [
            {
              source: '/:path*\\.(css|js)$',
              headers: [
                {
                  key: 'Cache-Control',
                  value: 'public, max-age=31536000, immutable',
                },
              ],
            },
          ]
        : []),
      // 生产环境：字体文件 - 长期缓存，不可变
      ...(process.env.NODE_ENV === 'production'
        ? [
            {
              source: '/:path*\\.(woff2|woff|ttf|otf|eot)',
              headers: [
                {
                  key: 'Cache-Control',
                  value: 'public, max-age=31536000, immutable',
                },
              ],
            },
          ]
        : []),
      // 生产环境：图片文件 - 长期缓存，不可变
      ...(process.env.NODE_ENV === 'production'
        ? [
            {
              source: '/:path*\\.(avif|webp|png|jpg|jpeg|gif|svg|ico)',
              headers: [
                {
                  key: 'Cache-Control',
                  value: 'public, max-age=31536000, immutable',
                },
              ],
            },
          ]
        : []),
      // 生产环境：媒体文件 - 长期缓存，不可变
      ...(process.env.NODE_ENV === 'production'
        ? [
            {
              source: '/:path*\\.(mp4|webm|mp3|wav|ogg)',
              headers: [
                {
                  key: 'Cache-Control',
                  value: 'public, max-age=31536000, immutable',
                },
              ],
            },
          ]
        : []),
      {
        source: '/admin/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
      // 开发环境：静态资源禁用缓存
      ...(process.env.NODE_ENV !== 'production'
        ? [
            {
              source:
                '/:path*\\.(css|js|png|jpg|jpeg|gif|svg|ico|woff2|woff|ttf|otf)',
              headers: [
                {
                  key: 'Cache-Control',
                  value: 'no-store, no-cache, must-revalidate',
                },
              ],
            },
          ]
        : []),
    ];
  },
  experimental: {
    proxyClientMaxBodySize: '100mb', // 增加请求头大小限制
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
};

export default nextConfig;
