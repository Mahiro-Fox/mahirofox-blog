import { ShaderBackground } from '@/app/[lang]/(app)/_components/shader-background';
import { APP_URL, siteConfig } from '@/config';
import { Suspense } from 'react';
import { getAllPhotos } from '@/actions/app/photos';
import { AuthModalProvider } from '@/components/auth/auth-modal-provider';
import { FloatActions } from '@/components/layout/float-actions';
import { MusicShell } from '@/components/layout/music-shell';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
// import { ScrollProgress } from '@/components/shared/scroll-progress';
import { PageTracker } from '@/components/shared/tracker';
import { getDictionary } from '@/i18n/dictionary';
import { DictionaryProvider } from '@/i18n/dictionary-provider';
import { getCurrentUser } from '@/lib/auth/user-auth';
import { isGoogleOAuthEnabled } from '@/lib/integrations/google-oauth';

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ lang: string }>;
}) => {
  const { lang } = await params;
  const homeDictionary = await getDictionary(lang, 'home');
  const title = homeDictionary['home.title'];
  const description =
    `${homeDictionary['home.description_1']}${homeDictionary['home.description_2']}${homeDictionary['home.description_3']}`
      .replace(/<a>/g, '')
      .replace(/<\/a>/g, '');
  // base URL 由 @/config 保证非空且合法，缺失会在构建期抛错
  const metadataBase = new URL(APP_URL);
  const metaData = {
    title: {
      default: title,
      template: `%s | ${siteConfig.name}`,
    },
    metadataBase,
    description,
    alternates: {
      types: {
        'application/rss+xml': [
          {
            url: '/rss.xml',
            title: `${siteConfig.name} RSS Feed`,
          },
        ],
      },
    },
    keywords: homeDictionary['home.keywords'],
    openGraph: {
      type: 'website',
      locale: 'zh_CN',
      url: APP_URL,
      title: siteConfig.name,
      description,
      siteName: siteConfig.name,
      images: [siteConfig.ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: siteConfig.name,
      description,
      images: [siteConfig.ogImage],
      creator: `@${siteConfig.twitterId}`,
    },
    icons: {
      icon: '/favicon.ico',
      shortcut: '/favicon-16x16.webp',
      apple: '/apple-touch-icon.webp',
    },
    manifest: `${APP_URL}/site.webmanifest`,
  };
  return metaData;
};

interface AppLayoutProps {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}

export default async function AppLayout({ children, params }: AppLayoutProps) {
  const { lang } = await params;
  const [
    navDictionary,
    footerDictionary,
    homeDictionary,
    loginDictionary,
    authPhotos,
    frontendUser,
  ] = await Promise.all([
    getDictionary(lang, 'header'),
    getDictionary(lang, 'footer'),
    getDictionary(lang, 'home'),
    getDictionary(lang, 'login'),
    // 登录弹窗左侧写真轮播（竖构图）
    getAllPhotos({ ratio: 'portrait' }),
    getCurrentUser(),
  ]);
  return (
    <div className="bg-background relative z-10 flex min-h-svh flex-col">
      {/* 全屏着色器背景 — 作为首个子元素，负 z-index 落在根 div 背景之上、内容之下 */}
      <ShaderBackground />
      <DictionaryProvider
        dictionary={{
          ...navDictionary,
          ...footerDictionary,
          ...homeDictionary,
          ...loginDictionary,
        }}
      >
        {/* 全局登录/注册弹窗：header、chat 等就地打开 */}
        <AuthModalProvider
          photos={authPhotos}
          googleEnabled={isGoogleOAuthEnabled()}
        >
          {/* ── 顶部滚动进度条 ── */}
          {/* <ScrollProgress /> */}
          <SiteHeader initialUserAuth={frontendUser} />
          <main className="flex min-h-[calc(100vh-56px)] flex-1 flex-col pt-14 lg:pt-16">
            {children}
          </main>
          <SiteFooter />
          {/* 自动埋点组件 */}
          <PageTracker />
          {/* 浮动操作组件 */}
          <FloatActions />
          {/* 全局音乐播放器：数据依赖 Go 后端，单独流式补齐，不阻塞页面主体 */}
          <Suspense fallback={null}>
            <MusicShell />
          </Suspense>
        </AuthModalProvider>
      </DictionaryProvider>
    </div>
  );
}
