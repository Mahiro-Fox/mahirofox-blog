import { AboutCta } from '@/app/[lang]/(app)/_components/about-cta';
import Galleries from '@/app/[lang]/(app)/_components/galleries';
import { HomeBanner } from '@/app/[lang]/(app)/_components/home-banner';
import Posts from '@/app/[lang]/(app)/_components/posts';
import Tags from '@/app/[lang]/(app)/_components/tags';
import { ProjectName, siteConfig } from '@/config';
import { tagStore } from '@/store/tag-store';
import { ChevronDown } from 'lucide-react';
import { getPublicBlogs } from '@/actions/admin/blog-actions';
import { getPublicGalleries } from '@/actions/admin/gallery-actions';
import { getAllPhotos } from '@/actions/app/photos';
import { BlurFade } from '@/components/magicui/blur-fade';
import { PartialViewCarousel } from '@/components/shared/partial-view-carousel';
import { VermilionThread } from '@/components/shared/vermilion-thread';

// 首页各区块的固定展示条数（与各子组件内部 slice 保持一致）
const HOME_POST_COUNT = 6;
const HOME_GALLERY_COUNT = 3;
const HOME_CAROUSEL_COUNT = 5;

export default async function IndexPage() {
  const [blogResult, galleryResult, bannerData, tags] = await Promise.all([
    getPublicBlogs({ all: true }),
    getPublicGalleries(),
    getAllPhotos({ ratio: 'landscape' }),
    tagStore.getAll(),
  ]);
  // action 返回的是全量列表；全量作为 props 传给 client component 会被完整序列化进
  // RSC payload。各区块实际只渲染前几条，因此先在服务端截断（server-serialization）。
  const posts = blogResult.success
    ? blogResult.data.items.slice(0, HOME_POST_COUNT)
    : [];
  const allGalleries = galleryResult.success ? galleryResult.data.items : [];
  const galleries = allGalleries.slice(0, HOME_GALLERY_COUNT);
  const carouselItems = allGalleries
    .slice(0, HOME_CAROUSEL_COUNT)
    .map((image) => ({
      title: image.title,
      description: image.description || '',
      href: `/gallery/${image.slug}`,
      imageUrl: image.thumbnail,
    }));

  const initialIndex = bannerData
    ? Math.floor(Math.random() * bannerData.length)
    : 0;

  return (
    <div className="relative flex w-full flex-1 flex-col">
      {/* ── Hero Banner ── */}
      <section className="relative h-[calc(100vh-48px)] w-full md:h-[calc(100vh-64px)]">
        {bannerData && (
          <HomeBanner images={bannerData} initialIndex={initialIndex} />
        )}
        {/* 底部渐变遮罩 — 从透明过渡到墨色背景 */}
        <div className="from-background pointer-events-none absolute inset-x-0 bottom-0 z-10 h-32 bg-linear-to-t to-transparent" />
        <ChevronDown
          strokeWidth={3}
          className="animate-up-down absolute right-[50%] bottom-10 z-10 text-(--primary)/70"
        />
      </section>

      {/* ── Gallery Carousel ── */}
      <section className="pt-12 pb-4">
        <PartialViewCarousel items={carouselItems} />
      </section>

      <VermilionThread className="py-4" />

      {/* ── About Section ── */}
      <BlurFade inView duration={0.6}>
        <section className="container-wrapper py-8">
          <div className="container">
            <AboutCta />
          </div>
        </section>
      </BlurFade>

      <VermilionThread className="py-4" />

      {/* ── Galleries & Tags ── */}
      <section className="container-wrapper py-8">
        <div className="container flex flex-col gap-10 lg:flex-row">
          <Galleries galleries={galleries} />
          <Tags tags={tags} />
        </div>
      </section>

      <VermilionThread className="py-4" />

      {/* ── Posts ── */}
      <Posts posts={posts} />

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
