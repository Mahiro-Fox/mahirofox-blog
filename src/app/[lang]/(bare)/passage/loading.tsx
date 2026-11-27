/**
 * 段级 loading 边界。
 *
 * 根 `app/loading.tsx` 是空文件（没有 default export），新路由首次编译时
 * Next 会把它当成 `/[lang]/passage/loading` 而报「default export 不是 React 组件」。
 * 这里显式提供一个边界，既绕开该问题，也让沉浸页在首帧就铺满黑底、不闪白。
 */
export default function PassageLoading() {
  return <div className="h-svh w-full bg-[#0a0a0a]" aria-hidden />;
}
