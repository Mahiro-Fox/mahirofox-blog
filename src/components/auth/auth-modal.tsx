'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useEffect, useCallback, useState } from 'react';
import {
  registerWithEmail,
  resetPasswordWithCode,
  startEmailAuth,
  startPasswordReset,
  userLogin,
  verifyEmailCode,
} from '@/actions/app/user-auth';
import { Button } from '@/components/shadcn-ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn-ui/dialog';
import { Input } from '@/components/shadcn-ui/input';
import { Label } from '@/components/shadcn-ui/label';
import { FadeCarousel } from '@/components/shared/fade-carousel';
import { imageSizes } from '@/components/shared/image-sizes';
import { OptimizedImage } from '@/components/shared/optimized-image';
import {
  TURNSTILE_SITE_KEY,
  TurnstileWidget,
} from '@/components/turnstile/turnstile-widget';
import { siteConfig } from '@/config/common';
import { useT } from '@/i18n/dictionary-provider';
import type { PhotoItem } from '@/lib/photos';

/** 弹窗步骤：邮箱 → （已注册）密码 | （未注册）验证码 → 设置密码 */
type AuthStep =
  | 'email'
  | 'password'
  | 'code'
  | 'setPassword'
  /** 该邮箱由 Google 登录创建，尚未设置密码 */
  | 'passwordNotSet'
  | 'resetCode'
  | 'resetPassword';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 登录/注册成功后的跳转地址；不传则仅刷新当前页数据 */
  redirectTo?: string;
  /** 成功回调（在关闭弹窗之前调用），供父级做额外处理 */
  onSuccess?: () => void;
  /** 左侧写真轮播的竖构图图片；为空时隐藏左侧面板、表单占满整宽 */
  photos?: PhotoItem[] | null;
  /** 是否展示「使用 Google 继续」（由服务端根据 Google OAuth 配置决定） */
  googleEnabled?: boolean;
  /** OAuth 回调失败时登录页透传的机器码 */
  initialErrorCode?: string;
}

// 后端返回的稳定机器码 → i18n key
const ERROR_KEYS: Record<string, string> = {
  INVALID_EMAIL: 'auth.err_invalid_email',
  RESEND_TOO_SOON: 'auth.err_resend_too_soon',
  RATE_LIMITED: 'auth.err_rate_limited',
  SEND_FAILED: 'auth.err_send_failed',
  CODE_MISMATCH: 'auth.err_code_mismatch',
  CODE_NOT_FOUND: 'auth.err_code_not_found',
  CODE_EXPIRED: 'auth.err_code_expired',
  TOO_MANY_ATTEMPTS: 'auth.err_too_many_attempts',
  INVALID_CODE_FORMAT: 'auth.err_invalid_code',
  USERNAME_TOO_SHORT: 'auth.err_username_short',
  USERNAME_TAKEN: 'auth.err_username_taken',
  PASSWORD_TOO_SHORT: 'auth.err_password_short',
  EMAIL_TAKEN: 'auth.err_email_taken',
  REGISTER_FAILED: 'auth.err_register_failed',
  VERIFY_FAILED: 'auth.err_verify_failed',
  GOOGLE_NOT_CONFIGURED: 'auth.err_google_not_configured',
  GOOGLE_STATE_INVALID: 'auth.err_google_state',
  GOOGLE_CANCELLED: 'auth.err_google_cancelled',
  GOOGLE_EMAIL_TAKEN: 'auth.err_google_email_taken',
  GOOGLE_EMAIL_UNVERIFIED: 'auth.err_google_email_unverified',
  GOOGLE_LINK_REQUIRED: 'auth.err_google_link_required',
  GOOGLE_ALREADY_LINKED: 'auth.err_google_already_linked',
  LOGIN_REQUIRED: 'auth.err_login_required',
  GOOGLE_FAILED: 'auth.err_google_failed',
  PASSWORD_NOT_SET: 'auth.err_password_not_set',
  EMAIL_NOT_FOUND: 'auth.err_email_not_found',
  ACCOUNT_NOT_FOUND: 'auth.err_email_not_found',
  RESET_FAILED: 'auth.err_reset_failed',
  INVALID_CREDENTIALS: 'auth.err_wrong_password',
  CAPTCHA_FAILED: 'auth.err_captcha',
};

// 各步骤对应的人机验证 action（服务端会逐个校验，防止 token 跨场景复用）
const CAPTCHA_ACTION_BY_STEP: Record<AuthStep, string> = {
  email: 'email_auth',
  password: 'login',
  code: 'email_auth',
  setPassword: 'signup',
  passwordNotSet: 'password_reset',
  resetCode: 'password_reset',
  resetPassword: 'reset_password',
};

const RESEND_SECONDS = 60; // 与后端重发节流保持一致

// 主按钮统一渐变样式（樱粉 → 藤紫 → 天青，取自二次元主题变量）
const GRADIENT_BUTTON =
  'w-full border-0 bg-gradient-to-r from-[var(--auth-grad-from)] via-[var(--auth-grad-via)] to-[var(--auth-grad-to)] text-white shadow-md hover:opacity-90';

export function AuthModal({
  open,
  onOpenChange,
  redirectTo,
  onSuccess,
  photos,
  googleEnabled,
  initialErrorCode,
}: AuthModalProps) {
  const t = useT();
  const router = useRouter();
  const hasPhotos = !!photos?.length;
  const carouselItems = (photos ?? []).map((photo) => ({
    id: photo.id,
    image: photo.src,
  }));

  // 当前可见路径（含查询串），用于 Google 登录后回到原页面
  const [currentPath, setCurrentPath] = useState('/');
  useEffect(() => {
    setCurrentPath(`${window.location.pathname}${window.location.search}`);
  }, []);
  const googleRedirect = redirectTo || currentPath;
  const googleHref = `/next-api/auth/google/start?redirect=${encodeURIComponent(
    googleRedirect
  )}`;

  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendIn, setResendIn] = useState(0); // 验证码重发倒计时（秒）
  const [rateLimitIn, setRateLimitIn] = useState(0); // 登录限流倒计时（秒）
  // 人机验证：token 单次有效，校验失败后通过 nonce 重建小部件取新 token
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaNonce, setCaptchaNonce] = useState(0);

  const handleCaptchaToken = useCallback((token: string) => {
    setCaptchaToken(token || null);
  }, []);

  const resetCaptcha = useCallback(() => {
    setCaptchaToken(null);
    setCaptchaNonce((prev) => prev + 1);
  }, []);

  // 切换步骤时旧 token 已不适用于新 action，清空等待新 token
  useEffect(() => {
    setCaptchaToken(null);
  }, [step]);

  // 关闭后重置，下次打开回到第一步
  useEffect(() => {
    if (open) return;
    setStep('email');
    setEmail('');
    setPassword('');
    setCode('');
    setUsername('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setResendIn(0);
    setRateLimitIn(0);
    setLoading(false);
    setCaptchaToken(null);
  }, [open]);

  // 重发倒计时
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setInterval(() => {
      setResendIn((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  // 登录限流倒计时
  useEffect(() => {
    if (rateLimitIn <= 0) return;
    const timer = setInterval(() => {
      setRateLimitIn((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimitIn]);

  const errorText = (code2: string) =>
    t(ERROR_KEYS[code2] ?? '') || t('auth.err_generic');

  const finish = () => {
    toast.success(t('auth.success'));
    // 先回调再关闭：让调用方能在关闭前标记"已成功"，避免关闭动作触发额外跳转
    onSuccess?.();
    onOpenChange(false);
    if (redirectTo) {
      router.replace(redirectTo);
    } else {
      // 刷新服务端组件，让 header 的登录态、chat 的模式随之更新
      router.refresh();
    }
  };

  // 第一步：提交邮箱
  const handleEmailSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await startEmailAuth(email, captchaToken ?? '');
      if (!res.success) {
        // token 已被本次 siteverify 消耗，失败后需要重新获取
        resetCaptcha();
        // 已有验证码在有效期内：直接进入验证码步骤，并展示重发倒计时
        if (res.error === 'RESEND_TOO_SOON') {
          setResendIn(res.retryAfter ?? RESEND_SECONDS);
          setStep('code');
          return;
        }
        setError(errorText(res.error));
        return;
      }
      if (res.exists) {
        // Google 账户未设置密码：直接引导改用 Google 或通过邮箱验证码设置密码
        setStep(res.hasPassword === false ? 'passwordNotSet' : 'password');
      } else {
        setResendIn(RESEND_SECONDS);
        setStep('code');
        toast.success(t('auth.code_sent'));
      }
    } finally {
      setLoading(false);
    }
  };

  // 第二步（已注册）：密码登录
  const handlePasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await userLogin(email, password, captchaToken ?? '');
      if (!res.success) {
        resetCaptcha();
        if (res.resetTime) {
          setRateLimitIn(Math.ceil((res.resetTime - Date.now()) / 1000));
          setError(t('auth.err_rate_limited'));
        } else if (res.error === 'PASSWORD_NOT_SET') {
          setStep('passwordNotSet');
        } else {
          setError(t('auth.err_wrong_password'));
        }
        return;
      }
      finish();
    } finally {
      setLoading(false);
    }
  };

  // 第二步（未注册）：校验验证码
  const handleCodeSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await verifyEmailCode(email, code);
      if (!res.success) {
        setError(
          res.remainingAttempts != null
            ? `${errorText(res.error)} · ${t('auth.attempts_left')} ${res.remainingAttempts}`
            : errorText(res.error)
        );
        return;
      }
      setStep('setPassword');
    } finally {
      setLoading(false);
    }
  };

  // 重新发送验证码（注册 / 重置密码共用）
  const handleResend = async () => {
    setError('');
    setLoading(true);
    try {
      if (step === 'resetCode') {
        const reset = await startPasswordReset(email, captchaToken ?? '');
        if (!reset.success) {
          if (reset.error === 'RESEND_TOO_SOON') {
            setResendIn(reset.retryAfter ?? RESEND_SECONDS);
            return;
          }
          setError(errorText(reset.error));
          return;
        }
        setResendIn(RESEND_SECONDS);
        toast.success(t('auth.code_sent'));
        return;
      }
      const res = await startEmailAuth(email, captchaToken ?? '');
      if (!res.success) {
        if (res.error === 'RESEND_TOO_SOON') {
          setResendIn(res.retryAfter ?? RESEND_SECONDS);
          return;
        }
        setError(errorText(res.error));
        return;
      }
      setResendIn(RESEND_SECONDS);
      toast.success(t('auth.code_sent'));
    } finally {
      setLoading(false);
      resetCaptcha();
    }
  };

  // Google 账户 / 忘记密码：发送验证码后进入重置步骤
  const handleStartReset = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await startPasswordReset(email, captchaToken ?? '');
      if (!res.success) {
        resetCaptcha();
        if (res.error === 'RESEND_TOO_SOON') {
          // 已存在有效验证码：直接进入输入验证码步骤
          setResendIn(res.retryAfter ?? RESEND_SECONDS);
          setStep('resetCode');
          return;
        }
        setError(errorText(res.error));
        return;
      }
      setResendIn(RESEND_SECONDS);
      setStep('resetCode');
      toast.success(t('auth.code_sent'));
    } finally {
      setLoading(false);
    }
  };

  // 重置密码第二步：校验验证码
  const handleResetCodeSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await verifyEmailCode(email, code);
      if (!res.success) {
        setError(
          res.remainingAttempts != null
            ? `${errorText(res.error)} · ${t('auth.attempts_left')} ${res.remainingAttempts}`
            : errorText(res.error)
        );
        return;
      }
      setStep('resetPassword');
    } finally {
      setLoading(false);
    }
  };

  // 重置密码第三步：设置新密码并自动登录
  const handleResetPasswordSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError(t('auth.err_password_mismatch'));
      return;
    }
    setLoading(true);
    try {
      const res = await resetPasswordWithCode({
        email,
        code,
        newPassword,
        turnstileToken: captchaToken ?? '',
      });
      if (!res.success) {
        resetCaptcha();
        setError(errorText(res.error));
        return;
      }
      finish();
    } finally {
      setLoading(false);
    }
  };

  // 第三步（未注册）：设置用户名 + 密码，完成注册
  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError(t('auth.err_password_mismatch'));
      return;
    }
    setLoading(true);
    try {
      const res = await registerWithEmail({
        email,
        code,
        username,
        password: newPassword,
        turnstileToken: captchaToken ?? '',
      });
      if (!res.success) {
        resetCaptcha();
        setError(errorText(res.error));
        return;
      }
      finish();
    } finally {
      setLoading(false);
    }
  };

  // 各步骤标题/描述
  const titleByStep: Record<AuthStep, string> = {
    email: t('auth.title'),
    password: t('auth.welcome_back'),
    code: t('auth.code_title'),
    setPassword: t('auth.signup_title'),
    passwordNotSet: t('auth.password_not_set_title'),
    resetCode: t('auth.reset_code_title'),
    resetPassword: t('auth.reset_password_title'),
  };
  const descByStep: Record<AuthStep, string> = {
    email: t('auth.subtitle'),
    password: t('auth.password_desc').replace('{{email}}', email),
    code: t('auth.code_desc').replace('{{email}}', email),
    setPassword: t('auth.signup_desc'),
    passwordNotSet: t('auth.password_not_set_desc').replace('{{email}}', email),
    resetCode: t('auth.reset_code_desc').replace('{{email}}', email),
    resetPassword: t('auth.reset_password_desc'),
  };

  // 人机验证挂载点：key 随步骤 / nonce 变化，确保拿到与新 action 匹配的 token
  const captchaWidget = TURNSTILE_SITE_KEY ? (
    <TurnstileWidget
      key={`${step}-${captchaNonce}`}
      action={CAPTCHA_ACTION_BY_STEP[step]}
      onToken={handleCaptchaToken}
      className="flex justify-center"
    />
  ) : null;
  const captchaBlocked = Boolean(TURNSTILE_SITE_KEY) && !captchaToken;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background/90 relative flex overflow-hidden rounded-2xl border-0 p-0 shadow-[0_24px_70px_-24px_var(--auth-glow)] sm:max-w-xl">
        <DialogClose onClick={() => onOpenChange(false)} />
        {/* 二次元霓虹辉光 */}
        <div
          className="pointer-events-none absolute -top-20 -right-12 h-44 w-44 rounded-full bg-(--auth-grad-from) opacity-30 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-12 h-44 w-44 rounded-full bg-(--auth-grad-to) opacity-30 blur-3xl"
          aria-hidden
        />

        {/* 左侧写真轮播（小屏隐藏，表单自动占满整宽） */}
        {hasPhotos && (
          <div className="inset-y-0 left-0 hidden aspect-9/16 w-[42%] overflow-hidden sm:block">
            <FadeCarousel
              className="h-full w-full max-w-none rounded-none"
              random
              arrow={false}
              indicator={false}
              autoPlayInterval={8000}
              items={carouselItems}
              itemRender={(item, { index }) => (
                <OptimizedImage
                  key={item.id}
                  src={item.image}
                  alt={siteConfig.name}
                  fill
                  priority={index === 0}
                  sizes={imageSizes.hero}
                />
              )}
            />
            {/* 右侧渐隐，与表单区自然融合 */}
            <div className="via-background/30 to-background/90 pointer-events-none absolute inset-0 bg-linear-to-r from-transparent" />
          </div>
        )}

        <div className="flex flex-1 flex-col justify-center p-6">
          <DialogHeader className="relative space-y-1">
            <DialogTitle className="text-center text-2xl font-bold">
              {titleByStep[step]}
            </DialogTitle>
            <DialogDescription className="text-center">
              {descByStep[step]}
            </DialogDescription>
            {/* 渐变装饰线 */}
            <div
              className="mx-auto mt-2 h-1 w-12 rounded-full bg-linear-to-r from-(--auth-grad-from) to-(--auth-grad-to)"
              aria-hidden
            />
          </DialogHeader>

          <div className="[&_input]:bg-foreground/5 relative mt-4 [&_input]:h-10 [&_input]:rounded-xl">
            {googleEnabled && step === 'email' && (
              <div className="mb-4 space-y-3">
                <a
                  href={googleHref}
                  aria-disabled={loading}
                  onClick={(e) => {
                    if (loading) e.preventDefault();
                  }}
                  className="border-foreground/15 bg-foreground/5 hover:bg-foreground/10 flex h-10 w-full items-center justify-center gap-2 rounded-xl border text-sm font-medium transition"
                >
                  <GoogleIcon />
                  {t('auth.continue_with_google')}
                </a>
                <div className="text-muted-foreground flex items-center gap-3 text-xs">
                  <span className="bg-foreground/10 h-px flex-1" />
                  {t('auth.or')}
                  <span className="bg-foreground/10 h-px flex-1" />
                </div>
              </div>
            )}

            {step === 'email' && (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="auth-email">{t('auth.email')}</Label>
                  <Input
                    id="auth-email"
                    type="email"
                    autoFocus
                    placeholder={t('auth.enter_email')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                {captchaWidget}
                <Button
                  type="submit"
                  className={GRADIENT_BUTTON}
                  disabled={loading || !email || captchaBlocked}
                >
                  {loading ? t('auth.checking') : t('auth.continue')}
                </Button>
              </form>
            )}

            {step === 'password' && (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="auth-password">{t('auth.password')}</Label>
                  <Input
                    id="auth-password"
                    type="password"
                    autoFocus
                    placeholder={t('auth.enter_password')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>
                {captchaWidget}
                <Button
                  type="submit"
                  className={GRADIENT_BUTTON}
                  disabled={
                    loading ||
                    !password ||
                    rateLimitIn > 0 ||
                    captchaBlocked
                  }
                >
                  {rateLimitIn > 0
                    ? `${t('auth.wait_in').replace('{{seconds}}', String(rateLimitIn))}`
                    : loading
                      ? t('auth.signing_in')
                      : t('auth.signin')}
                </Button>
                <BackButton
                  onClick={() => setStep('email')}
                  label={t('auth.back')}
                />
              </form>
            )}

            {step === 'code' && (
              <form onSubmit={handleCodeSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="auth-code">{t('auth.code')}</Label>
                  <Input
                    id="auth-code"
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    maxLength={6}
                    placeholder={t('auth.enter_code')}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    required
                    autoComplete="one-time-code"
                  />
                </div>
                {captchaWidget}
                <Button
                  type="submit"
                  className={GRADIENT_BUTTON}
                  disabled={loading || code.length !== 6}
                >
                  {loading ? t('auth.verifying') : t('auth.verify')}
                </Button>
                <div className="flex items-center justify-between text-sm">
                  <BackButton
                    onClick={() => {
                      setError('');
                      setStep('email');
                    }}
                    label={t('auth.back')}
                  />
                  <button
                    type="button"
                    className="text-primary disabled:text-muted-foreground hover:underline disabled:no-underline"
                    disabled={loading || resendIn > 0 || captchaBlocked}
                    onClick={handleResend}
                  >
                    {resendIn > 0
                      ? t('auth.resend_in').replace(
                          '{{seconds}}',
                          String(resendIn)
                        )
                      : t('auth.resend')}
                  </button>
                </div>
              </form>
            )}

            {step === 'setPassword' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="auth-username">{t('auth.username')}</Label>
                  <Input
                    id="auth-username"
                    type="text"
                    autoFocus
                    placeholder={t('auth.enter_username')}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="auth-new-password">
                    {t('auth.new_password')}
                  </Label>
                  <Input
                    id="auth-new-password"
                    type="password"
                    placeholder={t('auth.enter_new_password')}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="auth-confirm-password">
                    {t('auth.confirm_password')}
                  </Label>
                  <Input
                    id="auth-confirm-password"
                    type="password"
                    placeholder={t('auth.enter_confirm_password')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>
                {captchaWidget}
                <Button
                  type="submit"
                  className={GRADIENT_BUTTON}
                  disabled={loading || captchaBlocked}
                >
                  {loading ? t('auth.registering') : t('auth.register')}
                </Button>
              </form>
            )}

            {/* Google 创建的账户：未设置密码时的两条出路 */}
            {step === 'passwordNotSet' && (
              <div className="space-y-4">
                {googleEnabled && (
                  <a
                    href={googleHref}
                    className="border-foreground/15 bg-foreground/5 hover:bg-foreground/10 flex h-10 w-full items-center justify-center gap-2 rounded-xl border text-sm font-medium transition"
                  >
                    <GoogleIcon />
                    {t('auth.continue_with_google')}
                  </a>
                )}
                {captchaWidget}
                <Button
                  type="button"
                  onClick={handleStartReset}
                  className={GRADIENT_BUTTON}
                  disabled={loading || captchaBlocked}
                >
                  {loading ? t('auth.sending') : t('auth.set_password_via_email')}
                </Button>
                <BackButton
                  onClick={() => {
                    setError('');
                    setStep('email');
                  }}
                  label={t('auth.back')}
                />
              </div>
            )}

            {/* 重置密码第一步：校验邮箱验证码 */}
            {step === 'resetCode' && (
              <form onSubmit={handleResetCodeSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="auth-reset-code">{t('auth.code')}</Label>
                  <Input
                    id="auth-reset-code"
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    placeholder={t('auth.enter_code')}
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    maxLength={6}
                    required
                    autoComplete="one-time-code"
                  />
                </div>
                <div className="text-muted-foreground flex items-center justify-between text-xs">
                  <BackButton
                    onClick={() => {
                      setError('');
                      setStep('email');
                    }}
                    label={t('auth.back')}
                  />
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={loading || resendIn > 0 || captchaBlocked}
                    className="hover:text-foreground disabled:opacity-50"
                  >
                    {resendIn > 0
                      ? t('auth.resend_in').replace(
                          '{{seconds}}',
                          String(resendIn)
                        )
                      : t('auth.resend')}
                  </button>
                </div>
                {captchaWidget}
                <Button
                  type="submit"
                  className={GRADIENT_BUTTON}
                  disabled={loading}
                >
                  {loading ? t('auth.verifying') : t('auth.verify')}
                </Button>
              </form>
            )}

            {/* 重置密码第二步：设置新密码 */}
            {step === 'resetPassword' && (
              <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="auth-reset-password">
                    {t('auth.new_password')}
                  </Label>
                  <Input
                    id="auth-reset-password"
                    type="password"
                    autoFocus
                    placeholder={t('auth.enter_new_password')}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="auth-reset-confirm">
                    {t('auth.confirm_password')}
                  </Label>
                  <Input
                    id="auth-reset-confirm"
                    type="password"
                    placeholder={t('auth.enter_confirm_password')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>
                {captchaWidget}
                <Button
                  type="submit"
                  className={GRADIENT_BUTTON}
                  disabled={loading || captchaBlocked}
                >
                  {loading ? t('auth.saving') : t('auth.reset_submit')}
                </Button>
              </form>
            )}

            {(error ||
              (initialErrorCode ? errorText(initialErrorCode) : '')) && (
              <p className="text-destructive mt-3 text-center text-sm">
                {error || errorText(initialErrorCode ?? '')}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** 返回上一步的小按钮（图标 + 文案） */
function BackButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

/** Google 四色 G 图标 */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.86c2.26-2.09 3.56-5.17 3.56-8.87Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}
