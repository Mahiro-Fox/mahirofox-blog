export interface TocItem {
  /** 与正文标题 id 一致，用作锚点 */
  id: string;
  text: string;
  /** 标题层级：2 = h2，3 = h3…… */
  level: number;
}

/**
 * 标题 → 锚点 id。
 * 沿用原先 h2 的规则（空白转 -、去掉引号与问号、转小写），
 * 中文保留原样，浏览器会自动对 URL 片段编码。
 */
export function slugifyHeading(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, '-')
    .replace(/['‘’]/g, '')
    .replace(/\?/g, '')
    .toLowerCase();
}

/**
 * 生成带去重的 slug 函数：同名标题依次得到 a、a-1、a-2……
 * 目录与正文标题必须共用同一套规则，锚点才能一一对应。
 */
export function createSlugger(): (text: string) => string {
  const used = new Set<string>();
  return (text: string) => {
    const base = slugifyHeading(text);
    let candidate = base;
    let index = 0;
    // 与 github-slugger 一致：a → a-1 → a-2，且不会与已有 id 撞车
    while (used.has(candidate)) {
      index += 1;
      candidate = `${base}-${index}`;
    }
    used.add(candidate);
    return candidate;
  };
}

/** 去掉标题里的行内 Markdown 标记，得到纯文本 */
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/<[^>]+>/g, '')
    .trim();
}

/**
 * 从 MDX 源码提取多层级目录。
 *
 * 只做行级扫描：跳过 frontmatter 与代码块，取 ### 开头的行，
 * 因此不需要额外依赖，也不会被代码块里的 # 注释干扰。
 *
 * @param source MDX 原始内容
 * @param maxLevel 收录的最大层级（默认到 h4，避免目录过长）
 */
export function extractToc(source: string, maxLevel = 4): TocItem[] {
  if (!source) return [];

  const items: TocItem[] = [];
  const slug = createSlugger();
  const lines = source.split(/\r?\n/);
  let inFrontmatter = false;
  let fenceMarker: string | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    // 文档开头的 frontmatter
    if (index === 0 && line.trim() === '---') {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (line.trim() === '---') inFrontmatter = false;
      continue;
    }

    // 代码围栏：内部内容一律跳过
    const fence = line.match(/^\s*(```|~~~)/);
    if (fence) {
      if (fenceMarker === null) {
        fenceMarker = fence[1];
      } else if (line.trim().startsWith(fenceMarker)) {
        fenceMarker = null;
      }
      continue;
    }
    if (fenceMarker !== null) continue;

    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!heading) continue;

    const level = heading[1].length;
    if (level < 2 || level > maxLevel) continue;

    const text = stripInlineMarkdown(heading[2]);
    if (!text) continue;

    items.push({ id: slug(text), text, level });
  }

  return items;
}
