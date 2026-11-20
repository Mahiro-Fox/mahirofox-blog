import { ProjectName, siteConfig, UpperCamelCaseName } from '@/config';
import { MailIcon, RssIcon } from 'lucide-react';
import NextLink from 'next/link';
import { buttonVariants } from '@/components/shadcn-ui/button-variants';
import { BrandIcons } from '@/components/shared/brand-icons';
import { Link } from '@/components/shared/link';
import { MagneticButton } from '@/components/shared/magnetic-button';
import { cn } from '@/utils/utils';

export function SiteFooter({ className }: React.HTMLAttributes<HTMLElement>) {
  return (
    <footer className={cn('container-wrapper', className)}>
      <div className="container flex flex-col items-center justify-between gap-4 py-10 md:h-24 md:flex-row md:py-0">
        <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
          <p className="text-center font-mono text-xs leading-loose md:text-left">
            &copy; {`${new Date().getFullYear()} ${siteConfig.copyRight}`}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {siteConfig.links.vrchat && (
            <MagneticButton>
              <Link
                href={siteConfig.links.vrchat}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: 'outline', size: 'icon' })}
                aria-label="VRChat"
                title={`VRChat (${UpperCamelCaseName})`}
              >
                <BrandIcons.vrchat className="size-4" />
              </Link>
            </MagneticButton>
          )}
          {siteConfig.email && (
            <MagneticButton>
              <Link
                href={`mailto:${siteConfig.email}`}
                className={buttonVariants({ variant: 'outline', size: 'icon' })}
                target="_blank"
                rel="noreferrer"
                aria-label="Email"
                title={`Email (${UpperCamelCaseName})`}
              >
                <MailIcon className="size-4" />
              </Link>
            </MagneticButton>
          )}
          {siteConfig.links.github && (
            <MagneticButton>
              <Link
                href={siteConfig.links.github}
                className={buttonVariants({ variant: 'outline', size: 'icon' })}
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub"
                title={`GitHub (${ProjectName} github repository)`}
              >
                <BrandIcons.gitHub className="size-4" />
              </Link>
            </MagneticButton>
          )}
          {siteConfig.twitterId && (
            <MagneticButton>
              <Link
                href={`https://x.com/${siteConfig.twitterId}`}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: 'outline', size: 'icon' })}
                aria-label="Twitter"
                title={`Twitter (@${siteConfig.twitterId})`}
              >
                <BrandIcons.x className="size-4" />
              </Link>
            </MagneticButton>
          )}
          <MagneticButton>
            <NextLink
              href="/rss.xml"
              className={buttonVariants({ variant: 'outline', size: 'icon' })}
              aria-label="RSS"
              title={`RSS Feed (${ProjectName})`}
            >
              <RssIcon className="size-4" />
            </NextLink>
          </MagneticButton>
        </div>
      </div>
    </footer>
  );
}
