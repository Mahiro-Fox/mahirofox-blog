'use client';

import { SectionHeading } from '@/app/[lang]/(app)/_components/section-heading';
import {
  ArrowUpRight,
  AudioWaveform,
  Bot,
  Image,
  Music,
  Shuffle,
  Sparkles,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { BlurFade } from '@/components/magicui/blur-fade';
import { Link } from '@/components/shared/link';
import { useT } from '@/i18n/dictionary-provider';
import { cn } from '@/utils/utils';

interface Tool {
  name: string;
  href: string;
  labelKey: string;
  descriptionKey: string;
}

interface ToolSectionProps {
  tools: Tool[];
}

const TOOL_ICONS: Record<string, LucideIcon> = {
  midi: Music,
  sonic: AudioWaveform,
  bilibili_parse: Video,
  image_compressor: Image,
  image_obfuscator: Shuffle,
  ai_chat: Bot,
};

const TOOL_SPANS = [
  'lg:col-span-5',
  'lg:col-span-4',
  'lg:col-span-3',
  'lg:col-span-3',
  'lg:col-span-4',
  'lg:col-span-5',
] as const;

/**
 * 首页 Tool：工具数据来自 pageRoutesConfig 的 tools 分类，
 * 只展示真实存在的页面，避免虚构入口。
 */
export function ToolSection({ tools }: ToolSectionProps) {
  const t = useT();

  if (!tools.length) {
    return null;
  }

  return (
    <section id="tool" className="relative scroll-mt-24 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <BlurFade inView>
          <SectionHeading
            eyebrow={t('home.tool.eyebrow')}
            title={t('home.tool.title')}
            description={t('home.tool.description')}
          />
        </BlurFade>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
          {tools.map((tool, index) => {
            const Icon = TOOL_ICONS[tool.name] ?? Sparkles;
            return (
              <BlurFade
                key={tool.name}
                inView
                delay={0.04 * index}
                className={cn('min-w-0', TOOL_SPANS[index % TOOL_SPANS.length])}
              >
                <Link
                  href={tool.href}
                  className="group border-border/60 bg-card/80 hover:border-primary/40 hover:bg-card relative flex h-full flex-col justify-between gap-8 overflow-hidden rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_-38px_var(--primary)]"
                >
                  <div
                    aria-hidden
                    className="from-primary/10 pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-gradient-to-br to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  />
                  <div className="flex items-start justify-between">
                    <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6">
                      <Icon className="size-5" />
                    </span>
                    <span className="text-muted-foreground/40 font-mono text-[10px]">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-medium">
                      {t(tool.labelKey)}
                    </h3>
                    <p className="text-muted-foreground mt-1.5 line-clamp-2 text-sm leading-relaxed">
                      {t(tool.descriptionKey)}
                    </p>
                  </div>

                  <ArrowUpRight className="text-muted-foreground group-hover:text-primary size-4 self-end transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              </BlurFade>
            );
          })}
        </div>
      </div>
    </section>
  );
}
