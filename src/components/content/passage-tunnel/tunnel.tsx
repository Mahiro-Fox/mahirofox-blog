'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/utils/utils';
import { createTunnel, type TunnelHandle, type TunnelOptions } from './engine';
import type { PassageTunnelProps } from './types';

/** 未传参时的默认值，与文档保持一致 */
const DEFAULTS = {
  colors: ['#5227FF', '#FF9FFC'] as [string, string],
  backgroundColor: '#0a0a0a',
  lanes: 5,
  gap: 0.1,
  radius: 0.06,
  photoFill: 0.3,
  accentFill: 0.06,
  lineOpacity: 0.12,
  fog: 1,
  speed: 0.6,
  boost: 10,
  blur: 1,
  look: 1,
  fov: 72,
  hover: 1,
  focusOnClick: true,
  wheel: true,
  interactive: true,
  seed: 0,
  paused: false,
  dpr: 2,
};

function buildOptions(props: PassageTunnelProps): TunnelOptions {
  return {
    items: props.items,
    colors: props.colors ?? DEFAULTS.colors,
    backgroundColor: props.backgroundColor ?? DEFAULTS.backgroundColor,
    lanes: props.lanes ?? DEFAULTS.lanes,
    gap: props.gap ?? DEFAULTS.gap,
    radius: props.radius ?? DEFAULTS.radius,
    photoFill: props.photoFill ?? DEFAULTS.photoFill,
    accentFill: props.accentFill ?? DEFAULTS.accentFill,
    lineOpacity: props.lineOpacity ?? DEFAULTS.lineOpacity,
    fog: props.fog ?? DEFAULTS.fog,
    speed: props.speed ?? DEFAULTS.speed,
    boost: props.boost ?? DEFAULTS.boost,
    blur: props.blur ?? DEFAULTS.blur,
    look: props.look ?? DEFAULTS.look,
    fov: props.fov ?? DEFAULTS.fov,
    hover: props.hover ?? DEFAULTS.hover,
    focusOnClick: props.focusOnClick ?? DEFAULTS.focusOnClick,
    wheel: props.wheel ?? DEFAULTS.wheel,
    interactive: props.interactive ?? DEFAULTS.interactive,
    seed: props.seed ?? DEFAULTS.seed,
    paused: props.paused ?? DEFAULTS.paused,
    dpr: props.dpr ?? DEFAULTS.dpr,
    reduced: false,
    onFocusChange: (item, index) => props.onFocusChange?.(item, index),
  };
}

/**
 * 渲染器宿主（仅客户端）。
 *
 * 引擎只创建一次；props 变化时写进 ref 并调用 sync()，
 * 避免每次改参数都重建 WebGL 上下文。
 */
export default function TunnelCanvas({
  className,
  ariaLabel,
  ...props
}: PassageTunnelProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<TunnelHandle | null>(null);
  const optionsRef = useRef<TunnelOptions>(buildOptions({ ...props }));

  // 渲染循环每帧读 ref，因此这里直接刷新即可
  optionsRef.current = buildOptions({ ...props });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const handle = createTunnel(host, optionsRef);
    if (!handle) return;
    handleRef.current = handle;
    return () => {
      handle.destroy();
      handleRef.current = null;
    };
  }, []);

  // 影响 GPU 资源的参数打包成一个签名，只有它变了才重建纹理
  const syncKey = [
    props.items.map((item) => item.src).join('|'),
    props.seed,
    props.photoFill,
    props.accentFill,
    props.lanes,
    props.dpr,
  ].join('~');
  const lastSyncKey = useRef(syncKey);

  useEffect(() => {
    if (lastSyncKey.current === syncKey) return;
    lastSyncKey.current = syncKey;
    handleRef.current?.sync();
  }, [syncKey]);

  return (
    <div
      ref={hostRef}
      tabIndex={0}
      role="region"
      aria-roledescription="gallery"
      aria-label={ariaLabel ?? '照片长廊'}
      className={cn(
        'relative h-full w-full overflow-hidden outline-none',
        className
      )}
      style={{
        minHeight: 420,
        touchAction: 'pan-y',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    />
  );
}
