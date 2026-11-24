'use client';

import { SectionHeading } from '@/app/[lang]/(app)/_components/section-heading';
import { siteConfig } from '@/config';
import { ArrowUpRight } from 'lucide-react';
import { m, useReducedMotion, useSpring } from 'motion/react';
import { BlurFade } from '@/components/magicui/blur-fade';
import { Link } from '@/components/shared/link';
import { OptimizedImage } from '@/components/shared/optimized-image';
import { useT } from '@/i18n/dictionary-provider';
import { cn, formatDate } from '@/utils/utils';

interface FeaturedGalleryProps {
  galleries: Gallery[];
}

// 同一行共用固定高度：只靠列宽差异做非对称，行内不会出现高度差导致的留白
const TILE_LAYOUT = [
  { span: 'lg:col-span-7', height: 'lg:h-[30rem]' },
  { span: 'lg:col-span-5', height: 'lg:h-[30rem]' },
  { span: 'lg:col-span-4', height: 'lg:h-[24rem]' },
  { span: 'lg:col-span-8', height: 'lg:h-[24rem]' },
  { span: 'lg:col-span-5', height: 'lg:h-[27rem]' },
  { span: 'lg:col-span-7', height: 'lg:h-[27rem]' },
] as const;

interface GalleryTileProps {
  gallery: Gallery;
  span: string;
  height: string;
  sizes: string;
  wideOnTablet?: boolean;
}

function GalleryTile({
  gallery,
  span,
  height,
  sizes,
  wideOnTablet = false,
}: GalleryTileProps) {
  const reducedMotion = useReducedMotion();
  const rotateX = useSpring(0, { stiffness: 140, damping: 18 });
  const rotateY = useSpring(0, { stiffness: 140, damping: 18 });

  const handlePointerMove = (
    event: React.PointerEvent<HTMLDivElement>
  ): void => {
    if (reducedMotion || event.pointerType !== 'mouse') {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const ratioX = (event.clientX - rect.left) / rect.width - 0.5;
    const ratioY = (event.clientY - rect.top) / rect.height - 0.5;
    rotateY.set(ratioX * 5);
    rotateX.set(ratioY * -4);
  };

  const handlePointerLeave = (): void => {
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <BlurFade
      inView
      className={cn('min-w-0', wideOnTablet && 'sm:col-span-2', span)}
    >
      <m.div
        className="relative"
        style={{ rotateX, rotateY, transformPerspective: 900 }}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <Link
          href={`/gallery/${gallery.slug}`}
          className={cn(
            'group border-border/60 bg-card relative block aspect-[4/3] overflow-hidden rounded-2xl border sm:aspect-[16/10] lg:aspect-auto',
            height
          )}
        >
          <OptimizedImage
            src={gallery.thumbnail || siteConfig.ogImage}
            alt={gallery.title}
            fill
            sizes={sizes}
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.045]"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent opacity-85 transition-opacity duration-500 group-hover:opacity-100" />
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
            <div className="translate-y-1 transition-all duration-500 group-hover:translate-y-0">
              <p className="text-[10px] tracking-[0.22em] text-white/60 uppercase">
                {formatDate(gallery.lastUpdated)}
              </p>
              <h3 className="mt-1 text-base font-medium text-white sm:text-lg">
                {gallery.title}
              </h3>
              {gallery.description && (
                <p className="mt-1 line-clamp-1 text-xs text-white/70">
                  {gallery.description}
                </p>
              )}
            </div>
          </div>
          <span className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-full border border-white/25 bg-black/20 text-white opacity-0 backdrop-blur-md transition-all duration-300 group-hover:opacity-100">
            <ArrowUpRight className="size-4" />
          </span>
        </Link>
      </m.div>
    </BlurFade>
  );
}

export function FeaturedGallery({ galleries }: FeaturedGalleryProps) {
  const t = useT();

  if (!galleries.length) {
    return null;
  }

  const visible = galleries.slice(0, TILE_LAYOUT.length);

  return (
    <section
      id="featured-gallery"
      className="relative scroll-mt-24 py-20 sm:py-28"
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <BlurFade inView>
          <SectionHeading
            eyebrow={t('home.gallery.eyebrow')}
            title={t('home.gallery.title')}
            description={t('home.gallery.description')}
            actionHref="/page/gallery/1"
            actionLabel={t('home.gallery.view_all')}
          />
        </BlurFade>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:gap-6">
          {visible.map((gallery, index) => (
            <GalleryTile
              key={gallery.slug}
              gallery={gallery}
              span={TILE_LAYOUT[index].span}
              height={TILE_LAYOUT[index].height}
              wideOnTablet={index === 0}
              sizes={
                index === 0
                  ? '(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 58vw'
                  : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}
