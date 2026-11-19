/**
 * 服务端运行时环境变量的统一读取出口（仅 Server 侧使用）。
 *
 * 约定：
 * - 必填变量缺失 → 直接抛错，让配置问题在请求/启动时立刻暴露，而不是带着空值继续跑；
 * - 可选变量缺失 → 告警一次并返回 undefined，调用方据此关闭对应功能。
 *
 * 所有读取都放在函数里惰性执行：next build 会加载 server 模块，
 * 但构建期没有运行时变量，顶层读取会误伤构建。
 */

const warned = new Set<string>();

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}

/** 必填：缺失时抛错，提示需要配置的环境变量名 */
export function requiredEnv(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(
      `[env] 缺少必填环境变量 ${name}，请在 .env 或 docker compose 中配置`
    );
  }
  return value;
}

/** 可选：缺失时告警一次并返回 undefined，调用方应关闭对应功能 */
export function optionalEnv(name: string): string | undefined {
  const value = readEnv(name);
  if (!value) {
    warnOnce(
      name,
      `[env] 未配置可选环境变量 ${name}，相关功能将不可用`
    );
  }
  return value;
}

/** 可选整数：缺失或非法时告警并返回 undefined（由调用方决定自然兜底行为） */
export function optionalIntEnv(name: string): number | undefined {
  const raw = optionalEnv(name);
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    warnOnce(
      `${name}:invalid`,
      `[env] ${name} 不是合法数字：${raw}，已忽略该配置`
    );
    return undefined;
  }
  return value;
}
