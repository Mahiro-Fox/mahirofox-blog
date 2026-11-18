import {
  issueCaptchaTicket,
  verifyCaptchaTicket,
} from '@/lib/cloudflare/captcha-ticket';
import { createLogger } from '@/utils/logger';

const logger = createLogger('Turnstile');

const SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// 允许的前端主机名（siteverify 返回值必须命中其一）
function expectedHostnames(): Set<string> {
  const configured = (process.env.TURNSTILE_HOSTNAMES ?? '')
    .split(',')
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);
  // 开发环境未显式配置时回退到本机，方便本地联调；
  // 生产环境必须显式配置，缺失时 fail-closed（见下方日志）。
  if (configured.length === 0 && process.env.NODE_ENV !== 'production') {
    return new Set(['localhost', '127.0.0.1']);
  }
  return new Set(configured);
}

type SiteverifyResult = {
  success?: boolean;
  action?: string;
  hostname?: string;
  'error-codes'?: string[];
};

/**
 * 服务端校验 Turnstile token（浏览器 → 本站服务端 → Cloudflare siteverify）。
 * 必须同时满足：success === true、action 与预期一致、hostname 在允许列表内。
 * 任何异常（未配置密钥、网络失败、token 非法）都返回 false，绝不放行。
 */
export async function verifyTurnstile(
  token: string | undefined,
  expectedAction: string,
  remoteIp?: string
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET;
  const hostnames = expectedHostnames();
  if (!secret || hostnames.size === 0) {
    logger.error(
      'Turnstile 未配置：需要 TURNSTILE_SECRET 与 TURNSTILE_HOSTNAMES，已拒绝请求',
      { hasSecret: Boolean(secret), hostnameCount: hostnames.size }
    );
    return false;
  }
  if (!token || token.length === 0 || token.length > 2048) {
    return false;
  }

  try {
    const body = new URLSearchParams({
      secret,
      response: token,
    });
    if (remoteIp && remoteIp !== 'unknown') {
      body.set('remoteip', remoteIp);
    }

    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    if (!res.ok) {
      logger.error('Turnstile siteverify 返回非 2xx', { status: res.status });
      return false;
    }

    const result = (await res.json()) as SiteverifyResult;
    if (!result.success) {
      // 一次把判定所需的上下文全打出来，避免再靠"猜"定位线上问题
      logger.warn('Turnstile 校验失败', {
        expectedAction,
        errorCodes: result['error-codes'] ?? [],
        actualAction: result.action ?? null,
        hostname: result.hostname ?? null,
        allowedHostnames: Array.from(hostnames),
        tokenLength: token.length,
      });
      return false;
    }
    if (result.action !== expectedAction) {
      logger.warn('Turnstile action 不匹配', {
        expected: expectedAction,
        actual: result.action,
        hostname: result.hostname ?? null,
      });
      return false;
    }
    if (!result.hostname || !hostnames.has(result.hostname.toLowerCase())) {
      logger.warn('Turnstile hostname 不在允许列表', {
        hostname: result.hostname,
        allowedHostnames: Array.from(hostnames),
      });
      return false;
    }
    return true;
  } catch (error) {
    logger.error('Turnstile siteverify 请求异常', error);
    return false;
  }
}

/** 人机验证凭据：首次用 token，同流程后续步骤用票据 */
export interface HumanProof {
  turnstileToken?: string;
  captchaTicket?: string;
  /** 票据绑定的邮箱；不传则不走票据路径 */
  email?: string;
}

/**
 * 人机验证放行判定：票据优先，其次现场校验 token。
 * 任一通过都会返回一张（新的）票据，供同流程后续步骤复用，
 * 这样「邮箱 → 密码 / 验证码 → 设置密码」全程只需过一次验证。
 */
export async function passHumanCheck(
  proof: HumanProof,
  expectedAction: string,
  remoteIp?: string
): Promise<{ ok: boolean; ticket?: string }> {
  if (
    proof.captchaTicket &&
    proof.email &&
    verifyCaptchaTicket(proof.captchaTicket, proof.email)
  ) {
    return { ok: true, ticket: proof.captchaTicket };
  }

  if (!proof.turnstileToken) return { ok: false };
  if (
    !(await verifyTurnstile(proof.turnstileToken, expectedAction, remoteIp))
  ) {
    return { ok: false };
  }

  return {
    ok: true,
    ticket: proof.email
      ? (issueCaptchaTicket(proof.email) ?? undefined)
      : undefined,
  };
}
