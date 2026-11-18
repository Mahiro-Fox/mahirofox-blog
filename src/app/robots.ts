import type { MetadataRoute } from 'next';
import { APP_URL } from '@/config/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/next-api/',
        '/admin/',
        '/secret',
        '/login',
        '/cn/admin/',
        '/cn/secret',
        '/cn/login',
      ],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
