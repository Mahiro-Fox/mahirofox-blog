'use client';

import { SectionHeading } from '@/app/[lang]/(app)/_components/section-heading';
import { siteConfig } from '@/config';
import type { Tag } from '@/constant';
import { BlurFade } from '@/components/magicui/blur-fade';
import { Link } from '@/components/shared/link';
import { OptimizedImage } from '@/components/shared/optimized-image';
import { useT } from '@/i18n/dictionary-provider';
import { formatDate } from '@/utils/utils';

interface JournalSectionProps {
  posts: Blog[];
  blogTags: Record<string, Tag>;
}

function TagPill({ label }: { label: string }) {
  return (
    <span className="bg-primary/10 text-primary inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium">
      {label}
    </span>
  );
}

function resolveTagName(
  post: Blog,
  blogTags: Record<string, Tag>
): string | null {
  const tagId = post.tags?.[0];
  if (!tagId) {
    return null;
  }
  return blogTags[tagId]?.name || tagId;
}

/**
 * 首页 Journal 区块：以文字排版为主，与上方以图片为核心的 Gallery 形成对比。
 * 左侧一篇主文章，右侧为紧凑列表。
 */
export function JournalSection({ posts, blogTags }: JournalSectionProps) {
  const t = useT();

  if (!posts.length) {
    return null;
  }

  const [featured, ...rest] = posts;
  const featuredTag = resolveTagName(featured, blogTags);
  const listPosts = rest.slice(0, 4);

  return (
    <section id="journal" className="relative scroll-mt-24 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <BlurFade inView>
          <SectionHeading
            eyebrow={t('home.journal.eyebrow')}
            title={t('home.journal.title')}
            description={t('home.journal.description')}
            actionHref="/page/blog/1"
            actionLabel={t('home.journal.view_all')}
          />
        </BlurFade>

        <div className="mt-10 grid gap-10 lg:grid-cols-12 lg:gap-12">
          <BlurFade inView className="min-w-0 lg:col-span-7">
            <Link href={`/blog/${featured.slug}`} className="group block">
              <div className="border-border/60 bg-card relative aspect-[16/10] overflow-hidden rounded-2xl border">
                <OptimizedImage
                  src={featured.thumbnail || siteConfig.ogImage}
                  alt={featured.title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 58vw"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                />
              </div>
              <div className="text-muted-foreground mt-5 flex items-center gap-3 text-xs">
                <time dateTime={featured.lastUpdated}>
                  {formatDate(featured.lastUpdated)}
                </time>
                {featuredTag && (
                  <>
                    <span className="bg-border h-3 w-px" />
                    <TagPill label={featuredTag} />
                  </>
                )}
              </div>
              <h3 className="group-hover:text-primary mt-3 text-2xl font-medium tracking-tight transition-colors sm:text-3xl">
                {featured.title}
              </h3>
              <p className="text-muted-foreground mt-3 line-clamp-2 max-w-2xl text-sm leading-relaxed sm:text-base">
                {featured.description}
              </p>
            </Link>
          </BlurFade>

          <div className="min-w-0 lg:col-span-5">
            <div className="border-border/60 flex flex-col border-t">
              {listPosts.map((post, index) => {
                const tagName = resolveTagName(post, blogTags);
                return (
                  <BlurFade
                    key={post.slug}
                    inView
                    delay={0.05 * index}
                    className="border-border/60 border-b"
                  >
                    <Link
                      href={`/blog/${post.slug}`}
                      className="group flex flex-col gap-2 py-5"
                    >
                      <div className="text-muted-foreground flex items-center justify-between text-[11px] tracking-[0.16em] uppercase">
                        <span>{String(index + 1).padStart(2, '0')}</span>
                        <time dateTime={post.lastUpdated}>
                          {formatDate(post.lastUpdated)}
                        </time>
                      </div>
                      <h4 className="text-foreground group-hover:text-primary text-base leading-snug font-medium transition-colors sm:text-lg">
                        {post.title}
                      </h4>
                      <div className="flex items-center gap-3">
                        {tagName && <TagPill label={tagName} />}
                        <p className="text-muted-foreground line-clamp-1 text-xs">
                          {post.description}
                        </p>
                      </div>
                    </Link>
                  </BlurFade>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
