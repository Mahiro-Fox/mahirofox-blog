import {
  DEFAULT_PROVIDER,
  PROVIDERS,
  requiredEnv,
  type ProviderValue,
} from '@/config';
import { deepseek } from '@ai-sdk/deepseek';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel } from 'ai';

// 从 src/app/next-api/chat/route.ts 抽出，供 API route 与标题 server action 复用。
export function getModel(
  provider: ProviderValue,
  model: string
): LanguageModel {
  // 白名单校验，防止乱传字符串导致运行时报错，也避免以后被恶意 body 打穿
  const selectedProvider = PROVIDERS.find((p) => p.value === provider)
    ? provider
    : DEFAULT_PROVIDER;

  switch (selectedProvider) {
    case 'openrouter': {
      const openrouter = createOpenRouter({
        apiKey: requiredEnv('OPENROUTER_API_KEY'),
      });
      return openrouter(model);
    }
    case 'deepseek':
      // 提前校验，避免请求打到上游才报一个含糊的鉴权错误
      requiredEnv('DEEPSEEK_API_KEY');
      return deepseek(model);
  }
}
