'use client';

import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useState } from 'react';
import {
  setAccountPassword,
  unlinkGoogleAccount,
} from '@/actions/app/user-auth';
import { Button } from '@/components/shadcn-ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/shadcn-ui/card';
import { Input } from '@/components/shadcn-ui/input';
import { Label } from '@/components/shadcn-ui/label';
import { useT } from '@/i18n/dictionary-provider';
import type { UserAccountInfo } from '@/lib/auth/user-auth';

interface AccountSettingsProps {
  account: UserAccountInfo;
  googleEnabled: boolean;
  googleStatus?: string;
  googleError?: string;
}

const GRADIENT_BUTTON =
  'border-0 bg-gradient-to-r from-[var(--auth-grad-from)] via-[var(--auth-grad-via)] to-[var(--auth-grad-to)] text-white shadow-md hover:opacity-90';

/** 账户设置页：登录方式状态 + 设置/修改密码 + 关联/解绑 Google */
export function AccountSettings({
  account,
  googleEnabled,
  googleStatus,
  googleError,
}: AccountSettingsProps) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [saving, setSaving] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const linkGoogleHref = `/next-api/auth/google/start?mode=link&redirect=${encodeURIComponent(
    pathname
  )}`;

  const handleSavePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPasswordError('');
    if (newPassword.length < 6) {
      setPasswordError(t('settings.err_password_short'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('settings.err_password_mismatch'));
      return;
    }
    setSaving(true);
    try {
      const res = await setAccountPassword(currentPassword, newPassword);
      if (!res.success) {
        if (res.error === 'CURRENT_PASSWORD_INVALID') {
          setPasswordError(t('settings.err_current_password'));
        } else if (res.error === 'PASSWORD_TOO_SHORT') {
          setPasswordError(t('settings.err_password_short'));
        } else if (res.error === 'LOGIN_REQUIRED') {
          setPasswordError(t('settings.err_login_required'));
        } else {
          setPasswordError(t('settings.err_update_failed'));
        }
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success(
        account.hasPassword
          ? t('settings.password_updated')
          : t('settings.password_set_success')
      );
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleUnlinkGoogle = async () => {
    if (!window.confirm(t('settings.unlink_confirm'))) return;
    setUnlinking(true);
    try {
      const res = await unlinkGoogleAccount();
      if (!res.success) {
        if (res.error === 'PASSWORD_REQUIRED') {
          toast.error(t('settings.err_password_required'));
        } else if (res.error === 'LOGIN_REQUIRED') {
          toast.error(t('settings.err_login_required'));
        } else {
          toast.error(t('settings.err_update_failed'));
        }
        return;
      }
      toast.success(t('settings.google_unlinked_success'));
      router.refresh();
    } finally {
      setUnlinking(false);
    }
  };

  const googleErrorText = (() => {
    if (googleError === 'GOOGLE_ALREADY_LINKED') {
      return t('settings.err_google_already_linked');
    }
    if (googleError === 'LOGIN_REQUIRED') {
      return t('settings.err_login_required');
    }
    if (googleError) {
      return t('settings.err_google_failed');
    }
    return '';
  })();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('settings.title')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t('settings.subtitle')}
        </p>
      </div>

      {googleStatus === 'linked' && (
        <p className="rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">
          {t('settings.google_linked_success')}
        </p>
      )}
      {googleErrorText && (
        <p className="text-destructive rounded-lg bg-red-500/10 px-4 py-3 text-sm">
          {googleErrorText}
        </p>
      )}

      {/* 账户信息 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.account_info')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">
              {t('settings.username')}
            </span>
            <span className="font-medium">{account.username}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{t('settings.email')}</span>
            <span className="font-medium">{account.email}</span>
          </div>
        </CardContent>
      </Card>

      {/* 登录方式 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.login_methods')}</CardTitle>
          <CardDescription>{t('settings.login_methods_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span>{t('settings.password')}</span>
            <span
              className={
                account.hasPassword
                  ? 'text-emerald-600'
                  : 'text-muted-foreground'
              }
            >
              {account.hasPassword
                ? t('settings.password_set')
                : t('settings.password_unset')}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>{t('settings.google')}</span>
            {account.googleLinked ? (
              <div className="flex items-center gap-3">
                <span className="text-emerald-600">
                  {t('settings.google_linked')}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleUnlinkGoogle}
                  disabled={unlinking || !account.hasPassword}
                  title={
                    account.hasPassword
                      ? undefined
                      : t('settings.unlink_needs_password')
                  }
                >
                  {t('settings.unlink_google')}
                </Button>
              </div>
            ) : googleEnabled ? (
              <Button asChild variant="outline" size="sm">
                <a href={linkGoogleHref}>{t('settings.link_google')}</a>
              </Button>
            ) : (
              <span className="text-muted-foreground">
                {t('settings.google_not_enabled')}
              </span>
            )}
          </div>
          {!account.hasPassword && (
            <p className="text-muted-foreground text-xs">
              {t('settings.hint_password_unset')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 设置/修改密码 */}
      <Card>
        <CardHeader>
          <CardTitle>
            {account.hasPassword
              ? t('settings.change_password')
              : t('settings.set_password')}
          </CardTitle>
          <CardDescription>{t('settings.password_desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSavePassword} className="space-y-4">
            {account.hasPassword && (
              <div className="space-y-2">
                <Label htmlFor="settings-current-password">
                  {t('settings.current_password')}
                </Label>
                <Input
                  id="settings-current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder={t('settings.enter_current_password')}
                  autoComplete="current-password"
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="settings-new-password">
                {t('settings.new_password')}
              </Label>
              <Input
                id="settings-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('settings.enter_new_password')}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-confirm-password">
                {t('settings.confirm_password')}
              </Label>
              <Input
                id="settings-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('settings.enter_confirm_password')}
                autoComplete="new-password"
                required
              />
            </div>
            {passwordError && (
              <p className="text-destructive text-sm">{passwordError}</p>
            )}
            <Button type="submit" className={GRADIENT_BUTTON} disabled={saving}>
              {saving ? t('settings.saving') : t('settings.save_password')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
