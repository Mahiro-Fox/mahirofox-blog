import { FeaturedGallery } from '@/app/[lang]/(app)/_components/featured-gallery';
import { HomeHero } from '@/app/[lang]/(app)/_components/home-hero';
import { JournalSection } from '@/app/[lang]/(app)/_components/journal-section';
import { ToolSection } from '@/app/[lang]/(app)/_components/tool-section';
import { navRoutesConfig, ProjectName, siteConfig } from '@/config';
import { tagStore } from '@/store/tag-store';
import { getPublicBlogs } from '@/actions/admin/blog-actions';
import { getPublicGalleries } from '@/actions/admin/gallery-actions';
import { getAllPhotos } from '@/actions/app/photos';

// 首页各区块的展示条数（服务端截断，避免整表序列化进 RSC payload）
const HOME_POST_COUNT = 5;
const HOME_GALLERY_COUNT = 6;
const HOME_TOOL_COUNT = 6;
// 只解析最新的一批横图，供首屏轮播使用，避免每次渲染扫描整个图库
const HERO_PHOTO_SCAN_LIMIT = 12;

export default async function IndexPage() {
  const [blogResult, galleryResult, bannerData, blogTags] = await Promise.all([
    getPublicBlogs({ all: true }),
    getPublicGalleries(),
    getAllPhotos({ ratio: 'landscape', limit: HERO_PHOTO_SCAN_LIMIT }),
    tagStore.getByType('blog'),
  ]);

  const posts = blogResult.success
    ? blogResult.data.items.slice(0, HOME_POST_COUNT)
    : [];
  const galleries = galleryResult.success
    ? galleryResult.data.items.slice(0, HOME_GALLERY_COUNT)
    : [];

  const heroPhotos = (bannerData ?? []).map((photo) => ({
    id: photo.id,
    image: photo.src,
    alt: photo.alt || 'VRChat photograph',
  }));
  // 首帧在服务端随机决定，客户端水合时可直接复用同一张，避免首屏闪烁
  const heroInitialIndex = heroPhotos.length
    ? Math.floor(Math.random() * heroPhotos.length)
    : 0;

  const tools = navRoutesConfig
    .filter((route) => route.category === 'tools')
    .slice(0, HOME_TOOL_COUNT)
    .map((route) => ({
      name: route.name,
      href: route.navHref as string,
      labelKey: route.navLabel || '',
      descriptionKey: route.navDescription || '',
    }));

  return (
    <div className="relative flex w-full flex-1 flex-col">
      <HomeHero photos={heroPhotos} initialIndex={heroInitialIndex} />
      <FeaturedGallery galleries={galleries} />
      <JournalSection posts={posts} blogTags={blogTags} />
      <ToolSection tools={tools} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Blog',
            '@id': siteConfig.url,
            name: ProjectName,
            url: siteConfig.url,
          }),
        }}
      />
    </div>
  );
}
