'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { AuthModal } from '@/components/auth/auth-modal';
import type { PhotoItem } from '@/lib/content/photos';
import { trackEvent } from '@/utils/tracker';

interface SignInModalProps {
  redirectTo: string;
  photos: PhotoItem[] | null;
  googleEnabled?: boolean;
  initialErrorCode?: string;
}

/**
 * 独立登录页：落地即打开登录/注册弹窗。
 * 关闭弹窗（未登录成功）→ 返回首页；登录成功 → 跳转 redirectTo。
 */
export function SignInModal({
  redirectTo,
  photos,
  googleEnabled,
  initialErrorCode,
}: SignInModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const succeeded = useRef(false);

  return (
    <AuthModal
      open={open}
      redirectTo={redirectTo}
      photos={photos}
      googleEnabled={googleEnabled}
      initialErrorCode={initialErrorCode}
      onSuccess={({ email }) => {
        succeeded.current = true;
        trackEvent('signin-success', { email });
      }}
      onOpenChange={(next) => {
        setOpen(next);
        trackEvent('close-auth-modal');
        // 用户主动关闭且未登录成功：回首页
        if (!next && !succeeded.current) {
          router.replace('/');
        }
      }}
    />
  );
}
