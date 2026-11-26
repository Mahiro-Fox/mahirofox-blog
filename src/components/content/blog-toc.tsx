'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/shadcn-ui/sheet';
import type { TocItem } from '@/utils/toc';
import { cn } from '@/utils/utils';

interface TocNode extends TocItem {
  children: TocNode[];
}

interface BlogTocProps {
  items: TocItem[];
}

/** 抽屉关闭动画时长，与 sheet 的 duration-300 对齐 */
const DRAWER_EXIT_MS = 320;

/** 扁平标题列表 → 按层级嵌套的树 */
function buildTocTree(items: TocItem[]): TocNode[] {
  const roots: TocNode[] = [];
  const stack: TocNode[] = [];

  for (const item of items) {
    const node: TocNode = { ...item, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }
    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }
    stack.push(node);
  }

  return roots;
}

/**
 * 文章目录：
 * - 大屏（xl+）：悬浮固定在正文左侧，随滚动保持可见，可折叠；
 * - 小屏：左侧边缘的箭头按钮打开 Sheet 抽屉，关闭后平滑滚动到目标章节。
 * 数据由服务端从 MDX 源码解析后传入，锚点 id 与正文标题一致。
 */
export function BlogToc({ items }: BlogTocProps) {
  const [open, setOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeId, setActiveId] = useState(items[0]?.id ?? '');
  const tree = useMemo(() => buildTocTree(items), [items]);

  useEffect(() => {
    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => element !== null);
    if (headings.length === 0) return;

    // 标题顶部越过该偏移量即认为进入该章节（与 sticky 头部高度对齐）
    const threshold = 140;
    let ticking = false;

    const update = () => {
      ticking = false;
      let current = headings[0].id;
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top - threshold <= 0) {
          current = heading.id;
        } else {
          break;
        }
      }
      setActiveId(current);
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [items]);

  if (items.length === 0) return null;

  const jumpTo = (id: string) => {
    setActiveId(id);
    const go = () => {
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    if (drawerOpen) {
      // 先关抽屉：Radix 在关闭动画期间仍锁定 body 滚动，动画结束后再滚动
      setDrawerOpen(false);
      window.setTimeout(go, DRAWER_EXIT_MS);
      return;
    }
    go();
  };

  const renderNodes = (nodes: TocNode[], depth: number) => (
    <ul className="space-y-0.5">
      {nodes.map((node) => (
        <li key={node.id}>
          <button
            type="button"
            onClick={() => jumpTo(node.id)}
            title={node.text}
            style={{ paddingLeft: `${12 + depth * 14}px` }}
            className={cn(
              'block w-full truncate py-1 pr-2 text-left text-sm transition-colors',
              node.id === activeId
                ? 'text-primary font-medium'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {node.text}
          </button>
          {node.children.length > 0 && renderNodes(node.children, depth + 1)}
        </li>
      ))}
    </ul>
  );

  return (
    <>
      {/* 大屏：左侧固定悬浮目录 */}
      <aside className="hidden xl:sticky xl:top-24 xl:block print:hidden">
        <div className="bg-card/60 rounded-xl border backdrop-blur">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-medium"
            aria-expanded={open}
          >
            <span>目录</span>
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 transition-transform',
                !open && '-rotate-90'
              )}
            />
          </button>
          {open && (
            <nav className="max-h-[calc(100vh-12rem)] overflow-y-auto px-2 pb-3">
              {renderNodes(tree, 0)}
            </nav>
          )}
        </div>
      </aside>

      {/* 小屏：紧贴左侧的箭头，点击打开目录抽屉 */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="打开目录"
            className="bg-card/80 hover:bg-accent fixed top-1/2 left-0 z-40 flex h-16 w-7 -translate-y-1/2 items-center justify-center rounded-r-lg border border-l-0 shadow-sm backdrop-blur transition-colors xl:hidden print:hidden"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </SheetTrigger>
        <SheetContent
          side="left"
          aria-describedby={undefined}
          className="w-72 max-w-[85vw] xl:hidden"
        >
          <SheetHeader className="py-3 pr-12">
            <SheetTitle className="text-sm font-medium">目录</SheetTitle>
          </SheetHeader>
          <nav className="flex-1 overflow-y-auto px-2 pb-6">
            {renderNodes(tree, 0)}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
