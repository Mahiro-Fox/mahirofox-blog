const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export interface ResolvedImageUrl {
  url: string;
  name: string;
  mime: string;
}

export function createItemId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * 只接受本站图片链接（相对路径或同源绝对地址）。
 */
export function resolveSameSiteImageUrl(raw: string): ResolvedImageUrl | null {
  if (typeof window === 'undefined') return null;

  try {
    const parsed = new URL(raw, window.location.origin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    if (parsed.origin !== window.location.origin) return null;

    const segment = parsed.pathname.split('/').filter(Boolean).pop() ?? 'image';
    const name = decodeURIComponent(segment);
    const extension = name.split('.').pop()?.toLowerCase() ?? '';
    const mime =
      extension === 'png'
        ? 'image/png'
        : extension === 'jpg' || extension === 'jpeg'
          ? 'image/jpeg'
          : extension === 'webp'
            ? 'image/webp'
            : '';

    return {
      url: `${parsed.pathname}${parsed.search}`,
      name,
      mime,
    };
  } catch {
    return null;
  }
}

/**
 * 下载本站图片并包装成 File。外链或下载失败时返回 null。
 */
export async function loadImageFileFromUrl(raw: string): Promise<File | null> {
  const resolved = resolveSameSiteImageUrl(raw);
  if (!resolved) return null;

  try {
    const response = await fetch(resolved.url);
    if (!response.ok) return null;

    const blob = await response.blob();
    const type = ACCEPTED_TYPES.has(blob.type)
      ? blob.type
      : resolved.mime || blob.type;

    return new File([blob], resolved.name, {
      type: type || 'application/octet-stream',
    });
  } catch {
    return null;
  }
}
