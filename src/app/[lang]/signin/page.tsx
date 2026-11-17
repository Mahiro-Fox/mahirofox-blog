import { getAllPhotos } from '@/actions/app/photos';
import { isGoogleOAuthEnabled } from '@/lib/google-oauth';
import { SignInModal } from './signin-modal';

interface SignInPageProps {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}

/**
 * 独立登录页（服务端）：取竖构图写真供弹窗左侧轮播使用，
 * 实际交互交给客户端组件。
 */
export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { redirect, error } = await searchParams;
  const photos = await getAllPhotos({ ratio: 'portrait' });
  return (
    <SignInModal
      redirectTo={redirect || '/'}
      photos={photos}
      googleEnabled={isGoogleOAuthEnabled()}
      initialErrorCode={error}
    />
  );
}
