'use client';

import { siteConfig } from '@/config';
import React from 'react';
import { AuroraText } from '@/components/magicui/aurora-text';
import { FadeCarousel } from '@/components/shared/fade-carousel';
import { imageSizes } from '@/components/shared/image-sizes';
import { OptimizedImage } from '@/components/shared/optimized-image';
import { Trans } from '@/i18n/Trans';
import { PhotoItem } from '@/lib/content/photos';

interface HomeBannerImage {
  images: PhotoItem[];
  initialIndex?: number;
}

export const HomeBanner: React.FC<HomeBannerImage> = ({
  images,
  initialIndex = 0,
}) => {
  return (
    <div className="relative h-full w-full">
      <FadeCarousel
        className="h-full w-full max-w-none rounded-none"
        random
        initialIndex={initialIndex}
        arrow={false}
        indicator={false}
        autoPlayInterval={10000}
        items={images.map((image) => ({ id: image.id, image: image.src }))}
        itemRender={(item, { index }) => (
          <OptimizedImage
            key={item.id}
            src={item.image}
            alt={siteConfig.name}
            fill
            priority={initialIndex === index}
            sizes={imageSizes.hero}
          />
        )}
      />
      {/* <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent z-5" /> */}
      <div className="absolute inset-0 z-10 flex items-center justify-center px-6">
        <div className="cursor-default text-center transition-opacity duration-300 select-none hover:opacity-10">
          <h2 className="text-4xl font-bold text-white md:text-5xl">
            <Trans i18nKey="home.banner.title" components={{ AuroraText }} />
          </h2>
        </div>
      </div>
    </div>
  );
};
