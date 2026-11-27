'use client';

import { Loader2, RotateCw, SlidersHorizontal } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import {
  PassageTunnel,
  type PassageItem,
} from '@/components/content/passage-tunnel';
import { OptimizedImage } from '@/components/shared/optimized-image';
import { usePhotos } from '@/hooks/use-photos';
import { cn } from '@/utils/utils';
import { PassageControls } from './passage-controls';
import {
  PASSAGE_DEFAULTS,
  PASSAGE_PRESETS,
  paramsForPreset,
  type PassageLabels,
  type PassageParams,
  type PassagePresetId,
} from './presets';

/** 隧道最多用 48 张，取一个既能填满墙面又不会让图集过大的数量 */
const PHOTO_LIMIT = 40;

/** 预设会整体替换的字段；手改这些字段就不再算「当前预设」 */
const PRESET_KEYS = new Set(Object.keys(PASSAGE_PRESETS.night));

interface PassageExperienceProps {
  title: string;
  subtitle: string;
  hint: string;
  loadingLabel: string;
  emptyLabel: string;
  errorLabel: string;
  labels: PassageLabels;
}

interface FocusedCaption {
  title: string;
  index: number;
}

export function PassageExperience({
  title,
  subtitle,
  hint,
  loadingLabel,
  emptyLabel,
  errorLabel,
  labels,
}: PassageExperienceProps) {
  const { images, isLoading, error } = usePhotos({ limit: PHOTO_LIMIT });
  const [focused, setFocused] = useState<FocusedCaption | null>(null);

  const [params, setParams] = useState<PassageParams>(PASSAGE_DEFAULTS);
  const [preset, setPreset] = useState<PassagePresetId | null>('night');
  const [panelOpen, setPanelOpen] = useState(false);

  const items = useMemo<PassageItem[]>(
    () =>
      images.map((image) => ({
        src: image.src,
        alt: image.alt,
        title: image.alt,
      })),
    [images]
  );

  const handleFocusChange = useCallback(
    (item: PassageItem | null, index: number) => {
      setFocused(
        item
          ? { title: item.title ?? item.alt, index: Math.max(index, 0) }
          : null
      );
    },
    []
  );

  const handleParamsChange = useCallback((patch: Partial<PassageParams>) => {
    setParams((current) => ({ ...current, ...patch }));
    if (Object.keys(patch).some((key) => PRESET_KEYS.has(key))) {
      setPreset(null);
    }
  }, []);

  const handlePreset = useCallback((id: PassagePresetId) => {
    setParams(paramsForPreset(id));
    setPreset(id);
  }, []);

  const handleReset = useCallback(() => {
    setParams(PASSAGE_DEFAULTS);
    setPreset('night');
  }, []);

  const ready = items.length > 0;

  return (
    <section className="relative h-svh w-full overflow-hidden bg-[#0a0a0a] text-white">
      {/* 顶部压暗 + 左上角柔和压暗：墙面照片可能很亮，保证标题可读 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-36 bg-gradient-to-b from-black/60 via-black/20 to-transparent" />
      <div className="pointer-events-none absolute top-0 left-0 z-10 h-[420px] w-[560px] max-w-full bg-[radial-gradient(120%_100%_at_0%_0%,rgba(10,10,10,0.92),rgba(10,10,10,0.5)_45%,transparent_78%)]" />

      {ready ? (
        <PassageTunnel
          items={items}
          colors={params.colors}
          backgroundColor={params.background}
          lanes={params.lanes}
          gap={params.gap}
          radius={params.radius}
          photoFill={params.photoFill}
          accentFill={params.accentFill}
          lineOpacity={params.lineOpacity}
          fog={params.fog}
          speed={params.speed}
          boost={params.boost}
          blur={params.blur}
          look={params.look}
          fov={params.fov}
          hover={params.hover}
          seed={params.seed}
          focusOnClick={params.focusOnClick}
          wheel={params.wheel}
          interactive={params.interactive}
          paused={params.paused}
          className="absolute inset-0"
          onFocusChange={handleFocusChange}
          fallback={<PhotoGrid items={items} />}
        />
      ) : null}

      {/* 读屏用：画布本身无法朗读，这里补一份照片清单 */}
      <ul className="sr-only">
        {items.map((item) => (
          <li key={item.src}>{item.alt}</li>
        ))}
      </ul>

      {/* 加载 / 错误 / 空态 */}
      {isLoading ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
          <Loader2 className="size-7 animate-spin text-white/60" />
          <p className="text-sm text-white/50">{loadingLabel}</p>
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-sm text-white/60">
            {errorLabel}: {error}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
          >
            <RotateCw className="size-3.5" />
            {loadingLabel}
          </button>
        </div>
      ) : null}

      {!isLoading && !error && !ready ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <p className="text-sm text-white/50">{emptyLabel}</p>
        </div>
      ) : null}

      {/* 标题 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-6 pt-24 sm:px-10 sm:pt-28">
        <div className="max-w-md">
          <p className="text-[11px] font-medium tracking-[0.34em] text-white/40 uppercase">
            Passage Gallery
          </p>
          <h1 className="mt-3 text-3xl font-medium tracking-tight text-white/95 [text-shadow:0_2px_24px_rgba(0,0,0,0.55)] sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/55">
            {subtitle}
          </p>
        </div>
      </div>

      {/* 操作提示：打开大图时让位给字幕 */}
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center px-6 transition-opacity duration-300',
          focused ? 'opacity-0' : 'opacity-100'
        )}
      >
        <p className="rounded-full border border-white/10 bg-black/30 px-4 py-1.5 text-[11px] tracking-wide text-white/50 backdrop-blur-sm">
          {hint}
        </p>
      </div>

      {/* 参数面板入口：左下角，避开右下角的站点悬浮按钮 */}
      {ready ? (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          aria-expanded={panelOpen}
          aria-haspopup="dialog"
          aria-label={labels.title}
          title={labels.title}
          className={cn(
            'group absolute bottom-6 left-6 z-30 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 py-2 pr-4 pl-3 text-[12px] text-white/70 backdrop-blur-md transition-colors hover:border-white/30 hover:text-white',
            'sm:bottom-8 sm:left-10'
          )}
        >
          <SlidersHorizontal className="size-3.5 transition-transform group-hover:rotate-90" />
          {labels.open}
        </button>
      ) : null}

      <PassageControls
        open={panelOpen}
        onOpenChange={setPanelOpen}
        params={params}
        preset={preset}
        onChange={handleParamsChange}
        onPreset={handlePreset}
        onReset={handleReset}
        labels={labels}
      />

      {/* 大图字幕 */}
      <div
        aria-live="polite"
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-[6%] z-10 flex flex-col items-center gap-1 transition-all duration-500',
          focused && params.captions
            ? 'translate-y-0 opacity-100'
            : 'translate-y-1.5 opacity-0 duration-200'
        )}
      >
        {focused && params.captions ? (
          <>
            <span className="text-sm font-medium text-white/90">
              {focused.title}
            </span>
            <span className="text-xs text-white/45 tabular-nums">
              {String(focused.index + 1).padStart(2, '0')} /{' '}
              {String(items.length).padStart(2, '0')}
            </span>
          </>
        ) : null}
      </div>
    </section>
  );
}

/** WebGL 不可用时的降级展示 */
function PhotoGrid({ items }: { items: PassageItem[] }) {
  return (
    <div className="absolute inset-0 grid grid-cols-2 gap-2 overflow-hidden p-2 sm:grid-cols-3 lg:grid-cols-4">
      {items.slice(0, 12).map((item) => (
        <div
          key={item.src}
          className="relative aspect-square overflow-hidden rounded-lg"
        >
          <OptimizedImage
            src={item.src}
            alt={item.alt}
            fill
            sizes="25vw"
            className="object-cover"
            containerClassName="absolute inset-0"
          />
        </div>
      ))}
    </div>
  );
}
