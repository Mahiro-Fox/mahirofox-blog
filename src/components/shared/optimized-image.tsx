'use client';

import { useImagePreview } from '@/context/image-preview-provider';
import { RefreshCw } from 'lucide-react';
import { useInView } from 'motion/react';
import NextImage from 'next/image';
import { ComponentProps, useCallback, useRef, useState } from 'react';
import { cn } from '@/utils/utils';

type OptimizedImageProps = ComponentProps<typeof NextImage> & {
  className?: string;
  containerClassName?: string;
  sizes?: string;
  hoverScale?: boolean;
  aspectRatio?: number;
  blurDataURL?: string;
  /** 是否启用点击预览功能 */
  previewable?: boolean;
  onPreview?: () => void;
  /** 是否是竖屏图片 */
  isPortrait?: boolean;
};

/**
 * 优化的图片组件
 * - 支持懒加载（非首屏图片）
 * - 渐进加载动画
 * - 模糊占位符
 * - 错误回退
 */
export function OptimizedImage({
  src,
  alt,
  fill = false,
  width,
  height,
  priority = false,
  unoptimized = true,
  referrerPolicy = 'no-referrer',
  className,
  containerClassName,
  sizes = '100vw',
  hoverScale = false,
  aspectRatio,
  blurDataURL,
  previewable = false,
  onPreview,
  isPortrait = false,
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const { open } = useImagePreview();

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    setHasError(false);
  }, []);

  const handleError = useCallback(() => {
    setHasError(true);
    setIsRetrying(false);
  }, []);

  const handleRetry = useCallback(() => {
    setHasError(false);
    setIsRetrying(true);
    setIsLoaded(false);
    setRetryCount((c) => c + 1);
  }, []);

  const handleClick = useCallback(() => {
    if (!previewable) return;
    // 如果有传入自定义的函数，优先使用。
    if (onPreview) onPreview();
    // 否则使用自带函数。
    else open([{ src, alt }]);
  }, [previewable, onPreview, src, alt, open]);

  // 指定了 aspectRatio 时，容器已经有确定高度，图片必须按 fill 铺满容器，
  // 否则 <img> 会按 width/height 属性的原始像素渲染，撑破父容器
  const useFill = fill || Boolean(aspectRatio);
  const imageProps = useFill ? { fill: true, sizes } : { width, height, sizes };
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true });
  // 首屏关键图（priority）必须随 SSR 直接输出、由 HTML 发起请求并生成 preload；
  // 如果也等 useInView 的回调，LCP 图片要等到水合后才被发现。
  const shouldRenderImage = priority || isInView;
  // 错误回退
  if (hasError || !src) {
    return (
      <div
        className={cn(
          'bg-muted/50 flex items-center justify-center',
          fill && 'h-full w-full',
          containerClassName
        )}
        style={
          !fill && aspectRatio
            ? { aspectRatio }
            : !fill
              ? { width, height }
              : undefined
        }
      >
        <p className="text-muted-foreground/30 flex items-center">
          <span>failed to load image.</span>
          {src && (
            <button
              onClick={handleRetry}
              className={cn(
                'text-muted-foreground/50 hover:text-muted-foreground transition-colors',
                'hover:bg-muted/80 rounded-full p-2',
                'focus:ring-primary/20 focus:ring-2 focus:outline-none'
              )}
              title="重新加载图片"
            >
              <RefreshCw
                className={cn('h-4 w-4', isRetrying && 'animate-spin')}
              />
            </button>
          )}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden',
        fill && 'h-full w-full',
        previewable && 'cursor-zoom-in',
        containerClassName
      )}
      style={
        aspectRatio ? { aspectRatio } : !fill ? { width, height } : undefined
      }
      onClick={handleClick}
    >
      {/* Loading Spinner - 图片加载中显示 */}
      {!isLoaded && (
        <div className="bg-muted/30 absolute inset-0 flex items-center justify-center">
          <div className="border-primary/30 border-t-primary h-8 w-8 animate-spin rounded-full border-2" />
        </div>
      )}

      {/* 模糊占位符 */}
      {blurDataURL && !isLoaded && (
        <div
          className="absolute inset-0 scale-105 bg-cover bg-center blur-md transition-opacity duration-500"
          style={{ backgroundImage: `url(${blurDataURL})` }}
        />
      )}

      {shouldRenderImage && (
        <NextImage
          key={isRetrying ? `retry-${retryCount}` : alt}
          src={src}
          alt={alt}
          {...imageProps}
          priority={priority}
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          className={cn(
            'transition-all duration-300',
            isPortrait ? 'object-contain' : 'object-cover',
            hoverScale && 'hover:scale-105',
            // priority 图不做淡入，避免透明度过渡把 LCP 的绘制时间再往后推
            !isLoaded && !blurDataURL && !priority && 'opacity-0',
            isLoaded && 'opacity-100',
            className
          )}
          onLoad={handleLoad}
          onError={handleError}
          unoptimized={unoptimized}
          referrerPolicy={referrerPolicy}
        />
      )}
    </div>
  );
}
