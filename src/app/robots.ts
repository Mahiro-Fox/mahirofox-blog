import { APP_URL } from '@/config';
import type { MetadataRoute } from 'next';

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
        '/r18-photos',
        '/login',
        '/signin',
        '/cn/admin/',
        '/cn/secret',
        '/cn/r18-photos',
        '/cn/login',
        '/cn/signin',
      ],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
