'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { WebGLGuard } from '@/components/shared/webgl-guard';
import type { PassageTunnelProps } from './types';

// three 体积大，且 Canvas 参与 SSR 会有水合风险，因此只在客户端加载
const TunnelCanvas = dynamic(() => import('./tunnel'), { ssr: false });

interface PassageTunnelWrapperProps extends PassageTunnelProps {
  /** 不支持 WebGL 或初始化失败时展示的内容 */
  fallback?: ReactNode;
}

/**
 * 照片长廊。
 *
 * 隧道用一个全屏着色器解析求交出来，没有逐格几何体；
 * 外层套 WebGLGuard：探测不到 WebGL 时完全不加载 three.js。
 */
export function PassageTunnel({
  fallback = null,
  ...props
}: PassageTunnelWrapperProps) {
  return (
    <WebGLGuard fallback={fallback}>
      <TunnelCanvas {...props} />
    </WebGLGuard>
  );
}

export type {
  PassageItem,
  PassageTunnelHandle,
  PassageTunnelProps,
} from './types';
