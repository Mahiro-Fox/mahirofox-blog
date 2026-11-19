import { ChatSkeleton } from './chat-skeleton';

/** 聊天页骨架：与 `/chat/[id]` 共用同一套聊天界面占位。 */
export default function ChatLoading() {
  return <ChatSkeleton />;
}
