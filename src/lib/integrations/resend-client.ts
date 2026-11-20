import { requiredEnv } from '@/config';
import { Resend } from 'resend';

// 单例模式，避免每次请求都 new 一个新的 client
let resendInstance: Resend | null = null;

export function getResendClient(): Resend {
  if (!resendInstance) {
    resendInstance = new Resend(requiredEnv('RESEND_API_KEY'));
  }
  return resendInstance;
}

// 统一管理发件地址，避免散落在各处硬编码
export function getEmailFrom(): string {
  return requiredEnv('EMAIL_FROM');
}
