/**
 * 人机验证票据（Captcha Ticket）
 *
 * 登录弹窗拆成了「邮箱 → 密码 / 验证码 → 设置密码」多步，每一步都是一个独立的
 * Server Action。Turnstile token 单次有效，若每步都现场验一次，用户会被反复弹验证。
 *
 * 做法：第一步验证通过后签发一张短时票据，后续步骤认票不认 token。
 * 票据由服务端 HMAC-SHA256 签名，客户端拿到的只是不透明串——改不动，也伪造不了。
 *
 * 安全边界：
 * - 绑定邮箱 + 场景：换邮箱立即失效，不能拿 A 邮箱的票去跑 B 邮箱的流程
 * - 5 分钟有效，与 Turnstile token 自身的 300s 对齐
 * - 窗口内可复用：要拿到这张票本身就得先过一关真人验证；
 *   窗口内后续步骤的暴力破解仍由 rate-limit 按用户名 / IP 兜底
 */

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const TICKET_TTL_MS = 5 * 60 * 1000;
/** 场景：前台账户流程（登录 / 注册 / 重置密码共用一张票） */
const SCOPE = 'account';

interface TicketPayload {
  /** 邮箱（小写归一化） */
  e: string;
  /** 场景 */
  s: string;
  /** 签发时间戳 */
  i: number;
  /** 随机串，避免相同入参生成相同票据 */
  n: string;
}

function signingKey(): string | null {
  const value = process.env.JWT_SECRET?.trim();
  return value || null;
}

function sign(data: string, key: string): string {
  return createHmac('sha256', key).update(data).digest('base64url');
}

/**
 * 签发票据。未配置 JWT_SECRET 时返回 null，
 * 调用方会退回「每步都现场验证 token」的老路径，不会因此放行。
 */
export function issueCaptchaTicket(email: string): string | null {
  const key = signingKey();
  if (!key) return null;

  const payload: TicketPayload = {
    e: email,
    s: SCOPE,
    i: Date.now(),
    n: randomUUID(),
  };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${body}.${sign(body, key)}`;
}

/** 校验票据：签名、场景、绑定邮箱、有效期四道关 */
export function verifyCaptchaTicket(ticket: string, email: string): boolean {
  const key = signingKey();
  if (!key || !ticket) return false;

  const [body, signature] = ticket.split('.');
  if (!body || !signature) return false;

  const expected = sign(body, key);
  // 长度不同时 timingSafeEqual 会抛错，先比长度
  if (expected.length !== signature.length) return false;
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8')
    ) as TicketPayload;
    if (payload.s !== SCOPE) return false;
    if (payload.e !== email) return false;
    return Date.now() - payload.i <= TICKET_TTL_MS;
  } catch {
    return false;
  }
}
