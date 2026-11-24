import { ArrowUpRight } from 'lucide-react';
import { Link } from '@/components/shared/link';
import { cn } from '@/utils/utils';

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  className?: string;
}

/**
 * 首页各区块统一的编辑式标题：
 * 小号大写眉题 + 大标题 + 说明 + 右侧出口链接。
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  actionHref,
  actionLabel,
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-6 md:flex-row md:items-end md:justify-between',
        className
      )}
    >
      <div className="max-w-2xl">
        <p className="text-primary/80 text-[11px] font-medium tracking-[0.28em] uppercase">
          {eyebrow}
        </p>
        <h2 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">
          {title}
        </h2>
        {description && (
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed sm:text-base">
            {description}
          </p>
        )}
      </div>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="text-muted-foreground hover:text-foreground group inline-flex shrink-0 items-center gap-2 text-sm transition-colors"
        >
          <span>{actionLabel}</span>
          <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      )}
    </div>
  );
}
