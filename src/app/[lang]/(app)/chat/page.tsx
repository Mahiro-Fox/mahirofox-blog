import { getCurrentUser } from '@/lib/auth/user-auth';
import { ChatClient } from './[id]/chat-client';

export default async function ChatPage() {
  const user = await getCurrentUser();

  return <ChatClient isUserAuth={!!user} />;
}
