'use client';

import { Component, useEffect, useState, type ReactNode } from 'react';

/** 探测 WebGL 是否可用；无 GPU 的 headless 环境或驱动异常时返回 false */
export function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

interface WebGLGuardProps {
  children: ReactNode;
  /** 不支持或初始化失败时的替代内容，默认不渲染任何东西 */
  fallback?: ReactNode;
}

/**
 * WebGL 守卫。
 *
 * 1. 挂载前探测 WebGL，不可用时完全不加载 three.js；
 * 2. 探测通过但渲染期仍抛错（chunk 加载失败、上下文创建失败）时，
 *    由错误边界吞掉，避免异常冒到路由级错误页。
 *
 * 错误边界只能是类组件（React 限制），业务逻辑仍保持函数式。
 */
export function WebGLGuard({ children, fallback = null }: WebGLGuardProps) {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(supportsWebGL());
  }, []);

  if (!supported) {
    return <>{fallback}</>;
  }

  return (
    <WebGLErrorBoundary fallback={fallback}>{children}</WebGLErrorBoundary>
  );
}

class WebGLErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('[WebGLGuard] WebGL 已降级：', error);
  }

  render() {
    return this.state.failed ? <>{this.props.fallback}</> : this.props.children;
  }
}
