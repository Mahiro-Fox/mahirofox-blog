'use client';

import { siteConfig, UpperCamelCaseName } from '@/config';
import { Mail, Rss } from 'lucide-react';
import NextLink from 'next/link';
import { buttonVariants } from '@/components/shadcn-ui/button-variants';
import { BrandIcons } from '@/components/shared/brand-icons';
import { Link } from '@/components/shared/link';
import { SiteLogo } from '@/components/shared/site-logo';
import { useT } from '@/i18n/dictionary-provider';
import { cn } from '@/utils/utils';

const EXPLORE_LINKS = [
  { href: '/page/gallery/1', labelKey: 'footer.gallery' },
  { href: '/page/blog/1', labelKey: 'footer.journal' },
  { href: '/about', labelKey: 'footer.about' },
  { href: '/guestbook', labelKey: 'footer.guestbook' },
] as const;

export function SiteFooter({ className }: React.HTMLAttributes<HTMLElement>) {
  const t = useT();
  const year = new Date().getFullYear();

  return (
    <footer
      className={cn(
        'border-border/60 relative mt-24 overflow-hidden border-t',
        className
      )}
    >
      <div className="relative mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <SiteLogo className="size-9 overflow-hidden rounded-full" />
              <span className="text-sm font-semibold tracking-[0.18em] lowercase">
                {siteConfig.copyRight}
              </span>
            </Link>
            <p className="text-muted-foreground mt-4 max-w-sm text-sm leading-relaxed">
              {t('footer.signature')}
            </p>

            <div className="mt-6 flex items-center gap-2">
              {siteConfig.links.vrchat && (
                <Link
                  href={siteConfig.links.vrchat}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="VRChat"
                  title={`VRChat (${UpperCamelCaseName})`}
                  className={cn(
                    buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
                    'border-border/60 rounded-full border'
                  )}
                >
                  <BrandIcons.vrchat className="size-4" />
                </Link>
              )}
              {siteConfig.email && (
                <Link
                  href={`mailto:${siteConfig.email}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Email"
                  title={`Email (${UpperCamelCaseName})`}
                  className={cn(
                    buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
                    'border-border/60 rounded-full border'
                  )}
                >
                  <Mail className="size-4" />
                </Link>
              )}
              {siteConfig.links.github && (
                <Link
                  href={siteConfig.links.github}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="GitHub"
                  title="GitHub"
                  className={cn(
                    buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
                    'border-border/60 rounded-full border'
                  )}
                >
                  <BrandIcons.gitHub className="size-4" />
                </Link>
              )}
              {siteConfig.twitterId && (
                <Link
                  href={`https://x.com/${siteConfig.twitterId}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Twitter"
                  title={`Twitter (@${siteConfig.twitterId})`}
                  className={cn(
                    buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
                    'border-border/60 rounded-full border'
                  )}
                >
                  <BrandIcons.x className="size-4" />
                </Link>
              )}
              <NextLink
                href="/rss.xml"
                aria-label="RSS"
                title="RSS Feed"
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
                  'border-border/60 rounded-full border'
                )}
              >
                <Rss className="size-4" />
              </NextLink>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 md:col-span-7 md:justify-items-end">
            <div>
              <p className="text-muted-foreground text-[10px] font-medium tracking-[0.22em] uppercase">
                {t('footer.explore')}
              </p>
              <ul className="mt-4 space-y-2.5">
                {EXPLORE_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-foreground/80 hover:text-primary text-sm transition-colors"
                    >
                      {t(link.labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-muted-foreground text-[10px] font-medium tracking-[0.22em] uppercase">
                {t('footer.connect')}
              </p>
              <ul className="mt-4 space-y-2.5">
                {siteConfig.links.github && (
                  <li>
                    <Link
                      href={siteConfig.links.github}
                      target="_blank"
                      rel="noreferrer"
                      className="text-foreground/80 hover:text-primary text-sm transition-colors"
                    >
                      GitHub
                    </Link>
                  </li>
                )}
                {siteConfig.twitterId && (
                  <li>
                    <Link
                      href={`https://x.com/${siteConfig.twitterId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-foreground/80 hover:text-primary text-sm transition-colors"
                    >
                      Twitter
                    </Link>
                  </li>
                )}
                {siteConfig.email && (
                  <li>
                    <Link
                      href={`mailto:${siteConfig.email}`}
                      className="text-foreground/80 hover:text-primary text-sm transition-colors"
                    >
                      Email
                    </Link>
                  </li>
                )}
                <li>
                  <NextLink
                    href="/rss.xml"
                    className="text-foreground/80 hover:text-primary text-sm transition-colors"
                  >
                    {t('footer.rss')}
                  </NextLink>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="border-border/60 text-muted-foreground mt-12 flex flex-col gap-3 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono">
            &copy; {year} {siteConfig.copyRight}
          </p>
          <p className="text-muted-foreground/70">{t('home.hero.subtitle')}</p>
        </div>
      </div>
    </footer>
  );
}
