import { siteConfig } from '@/config';
import { OptimizedImage } from '@/components/shared/optimized-image';

export const SiteLogo = (props: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div {...props}>
      <OptimizedImage
        src={siteConfig.ogImage}
        alt="Logo"
        width={32}
        height={32}
      />
    </div>
  );
};
