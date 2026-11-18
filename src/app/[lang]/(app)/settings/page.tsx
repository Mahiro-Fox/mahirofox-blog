import { redirect } from 'next/navigation';
import { getCurrentUser, getUserAccountViaGo } from '@/lib/auth/user-auth';
import { isGoogleOAuthEnabled } from '@/lib/integrations/google-oauth';
import { AccountSettings } from './account-settings';

export const dynamic = 'force-dynamic';

interface SettingsPageProps {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** 账户设置：需要登录；数据来自 Go 自服务接口（含 hasPassword / googleLinked） */
export default async function SettingsPage({
  params,
  searchParams,
}: SettingsPageProps) {
  const { lang } = await params;
  const query = await searchParams;
  const signinPath = `/${lang}/signin?redirect=${encodeURIComponent(`/${lang}/settings`)}`;

  const user = await getCurrentUser();
  if (!user) redirect(signinPath);

  const account = await getUserAccountViaGo();
  if (!account) redirect(signinPath);

  const googleStatus =
    typeof query.google === 'string' ? query.google : undefined;
  const googleError =
    typeof query.google_error === 'string' ? query.google_error : undefined;

  return (
    <div className="container-wrapper py-10">
      <div className="mx-auto max-w-2xl">
        <AccountSettings
          account={account}
          googleEnabled={isGoogleOAuthEnabled()}
          googleStatus={googleStatus}
          googleError={googleError}
        />
      </div>
    </div>
  );
}
