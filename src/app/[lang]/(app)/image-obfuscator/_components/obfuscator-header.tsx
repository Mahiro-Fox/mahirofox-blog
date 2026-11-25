import { Shuffle } from 'lucide-react';
import { useT } from '@/i18n/dictionary-provider';

/** 工具页顶部标题区 */
export function ObfuscatorHeader() {
  const t = useT();

  return (
    <div className="border-border border-b">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="bg-primary text-primary-foreground flex h-10 w-10 items-center justify-center rounded-xl">
            <Shuffle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t('image-obfuscator.title')}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {t('image-obfuscator.subtitle')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
