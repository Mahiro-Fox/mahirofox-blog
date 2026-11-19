import { Skeleton } from '@/components/shared/skeleton';

/**
 * 聊天界面骨架，`/chat` 与 `/chat/[id]` 共用。
 *
 * 复刻 `chat-client` 的外框：头部工具行 → 消息区 → 底部输入框，
 * 高度约束与真实组件一致，避免加载完成时整体高度突变。
 */
export function ChatSkeleton() {
  return (
    <div className="container flex max-h-[calc(100vh-50px)] flex-1 animate-pulse gap-4 p-4 md:max-h-[calc(100vh-160px)] md:p-0">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {/* 头部：会话标题 + 操作按钮 */}
        <div className="flex items-center justify-between gap-2 py-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </div>

        {/* 消息区 */}
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-4 px-2">
          <div className="mx-auto w-full max-w-2xl space-y-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div className="mx-auto flex w-full max-w-2xl justify-end">
            <Skeleton className="h-16 w-3/5 rounded-2xl" />
          </div>
        </div>

        {/* 输入框 */}
        <div className="border-border rounded-2xl border p-3">
          <Skeleton className="mb-3 h-10 w-full" />
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24 rounded-full" />
              <Skeleton className="h-8 w-28 rounded-full" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
