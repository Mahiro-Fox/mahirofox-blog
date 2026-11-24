'use client';

import { siteConfig } from '@/config';
import { ArrowDown, ArrowRight } from 'lucide-react';
import {
  m,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type Variants,
} from 'motion/react';
import { useRef } from 'react';
import { AuroraText } from '@/components/magicui/aurora-text';
import { Button } from '@/components/shadcn-ui/button';
import { FadeCarousel } from '@/components/shared/fade-carousel';
import { imageSizes } from '@/components/shared/image-sizes';
import { Link } from '@/components/shared/link';
import { OptimizedImage } from '@/components/shared/optimized-image';
import { useT } from '@/i18n/dictionary-provider';
import { Trans } from '@/i18n/Trans';

interface HeroPhoto {
  id: string;
  image: string;
  alt: string;
}

interface HomeHeroProps {
  photos: HeroPhoto[];
  /** 首帧随机图由服务端决定，避免客户端水合前后不一致 */
  initialIndex?: number;
}

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.09,
      delayChildren: 0.05,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
};

/**
 * 首页首屏：
 * 上方是居中的编辑式文案，下方是整幅轮播图。
 * 轮播图随滚动从略小放大到父容器满宽（最大 scale 为 1，不会溢出父级），
 * reduced-motion 下保持静止。
 */
export function HomeHero({ photos, initialIndex = 0 }: HomeHeroProps) {
  const t = useT();
  const reducedMotion = useReducedMotion();
  const mediaRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: mediaRef,
    offset: ['start end', 'start 40%'],
  });
  const scaleRaw = useTransform(scrollYProgress, [0, 1], [0.75, 1]);
  const yRaw = useTransform(scrollYProgress, [0, 1], [36, 0]);
  const mediaScale = useSpring(scaleRaw, {
    stiffness: 80,
    damping: 22,
    mass: 0.4,
  });
  const mediaY = useSpring(yRaw, { stiffness: 80, damping: 22, mass: 0.4 });

  return (
    <section className="relative isolate -mt-14 overflow-hidden lg:-mt-16">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="pt-28 pb-16 lg:pt-36 lg:pb-24">
          <m.div
            className="mx-auto max-w-4xl text-center"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <m.p
              variants={itemVariants}
              className="text-muted-foreground text-[11px] font-medium tracking-[0.28em] uppercase"
            >
              {t('home.hero.eyebrow')}
            </m.p>

            <h1 className="mt-6 text-[clamp(2rem,4.8vw,4.2rem)] leading-[1.14] font-medium tracking-[-0.03em]">
              <Trans i18nKey="home.hero.title" components={{ AuroraText }} />
            </h1>

            <m.p
              variants={itemVariants}
              className="text-foreground/80 mt-6 text-lg font-light tracking-wide sm:text-xl"
            >
              {t('home.hero.subtitle')}
            </m.p>

            <m.p
              variants={itemVariants}
              className="text-muted-foreground mx-auto mt-5 max-w-xl text-sm leading-relaxed sm:text-base"
            >
              <Trans
                i18nKey="home.description_1"
                components={{
                  a: (props) => (
                    <a
                      href={siteConfig.links.vrchat}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium underline underline-offset-4 transition-colors hover:text-[var(--primary)]"
                    >
                      {props.children}
                    </a>
                  ),
                }}
              />
            </m.p>
            <m.p
              variants={itemVariants}
              className="text-muted-foreground mx-auto mt-5 max-w-xl text-sm leading-relaxed sm:text-base"
            >
              {t('home.description_2')}
            </m.p>
            <m.p
              variants={itemVariants}
              className="text-muted-foreground mx-auto mt-5 max-w-xl text-sm leading-relaxed sm:text-base"
            >
              <Trans
                i18nKey="home.description_3"
                components={{
                  a: (props) => (
                    <a
                      href={siteConfig.links.github}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium underline underline-offset-4 transition-colors hover:text-[var(--primary)]"
                    >
                      {props.children}
                    </a>
                  ),
                }}
              />
            </m.p>

            <m.div
              variants={itemVariants}
              className="mt-9 flex flex-wrap items-center justify-center gap-3"
            >
              <Button asChild size="lg" className="rounded-full px-6">
                <Link href="#featured-gallery">
                  {t('home.hero.explore')}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-border/70 bg-background/40 rounded-full px-6 backdrop-blur-sm"
              >
                <Link href="/about">{t('home.hero.about')}</Link>
              </Button>
            </m.div>

            <m.div
              variants={itemVariants}
              className="text-muted-foreground mt-12 hidden items-center justify-center gap-3 text-[10px] tracking-[0.3em] uppercase lg:flex"
            >
              <span className="bg-border h-px w-10" />
              {t('home.hero.scroll')}
              <ArrowDown className="size-3" />
            </m.div>
          </m.div>

          <m.div
            ref={mediaRef}
            className="relative mt-12 w-full lg:mt-16"
            style={{
              scale: reducedMotion ? 1 : mediaScale,
              y: reducedMotion ? 0 : mediaY,
            }}
          >
            <div className="border-border/60 bg-card relative aspect-[4/3] overflow-hidden rounded-[1.75rem] border shadow-[0_50px_120px_-60px_rgba(15,15,30,0.55)] sm:aspect-[16/10]">
              {photos.length > 0 ? (
                <FadeCarousel
                  className="h-full w-full max-w-none rounded-none shadow-none"
                  items={photos}
                  initialIndex={initialIndex}
                  random
                  autoPlayInterval={8000}
                  arrow={false}
                  indicator={false}
                  itemRender={(item, { index }) => (
                    <OptimizedImage
                      src={item.image}
                      alt={item.alt}
                      fill
                      priority={index === initialIndex}
                      sizes={imageSizes.hero}
                      className="object-cover"
                    />
                  )}
                />
              ) : (
                <div className="from-primary/20 via-background to-surface h-full w-full bg-gradient-to-br" />
              )}
            </div>
          </m.div>
        </div>
      </div>
    </section>
  );
}
