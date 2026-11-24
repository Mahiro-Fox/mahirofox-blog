'use client';

import dynamic from 'next/dynamic';
import { Component, useEffect, useState, type ReactNode } from 'react';

// three 体积较大，且 <Canvas> 若参与 SSR 会进入 HTML（存在水合风险），
// 因此只在客户端懒加载，避免拖慢 (app) 各路由的首屏。
const GroundCanvas = dynamic(() => import('./ground-canvas'), { ssr: false });

/** 探测 WebGL 是否可用；无 GPU 的 headless 环境会在这里直接返回 false */
function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * 着色器背景的错误边界。
 *
 * React 只提供类组件形式的错误边界，这里保持最小实现：
 * 懒加载失败或 WebGL 初始化抛错时直接卸载 Canvas，仅保留主题遮罩层。
 */
class ShaderErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('[ShaderBackground] WebGL 背景已降级：', error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * (app) 路由组的全屏着色器背景。
 *
 * 层叠说明：作为 (app)/layout.tsx 根 div（relative z-10，自身构成层叠上下文）的子元素，
 * 负 z-index 会绘制在该 div 自身背景之上、main 内容之下，因此无需改动 body / globals.css。
 * 注意必须保持为该根 div 的后代，不能用 portal 挂到 body。
 */
export function ShaderBackground() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(supportsWebGL());
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[-10]">
      {enabled && (
        <ShaderErrorBoundary>
          <GroundCanvas />
        </ShaderErrorBoundary>
      )}
      {/* 主题遮罩：用主题背景色压住过饱和的 shader，切主题时由 CSS 变量即时变色 */}
      <div className="absolute inset-0 bg-[color-mix(in_oklab,var(--background)_var(--ground-veil-alpha),transparent)]" />
    </div>
  );
}
