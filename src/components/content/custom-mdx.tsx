import { evaluate, type EvaluateOptions } from '@mdx-js/mdx';
import * as runtime from 'react/jsx-runtime';
import rehypePrettyCode from 'rehype-pretty-code';
import remarkGfm from 'remark-gfm';
import * as React from 'react';
import { mdxComponents } from '@/components/content/mdx-components-map';
import { createSlugger } from '@/utils/toc';
import { transformers } from './mdx-transformers';

export { transformers } from './mdx-transformers';

interface CustomMDXProps {
  source: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  additionalComponents?: Record<string, React.ComponentType<any>>;
}

const rehypePrettyCodeOptions = {
  theme: {
    dark: 'github-dark',
    light: 'github-light-default',
  },
  transformers,
  defaultLang: 'plaintext',
  bypassInlineCode: true,
};

/** 最小化的 hast 节点定义，避免为了一个插件引入额外依赖 */
interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

function collectText(node: HastNode): string {
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(collectText).join('');
}

/**
 * 给正文标题写入锚点 id。
 *
 * 与 extractToc 共用同一套 slug + 去重规则（同名标题依次为 a、a-1、a-2），
 * 且只处理 h2–h4，保证目录条目与页面标题 id 一一对应、不会出现重复高亮。
 */
function rehypeHeadingIds(maxLevel = 4) {
  return (tree: HastNode) => {
    const slug = createSlugger();
    const walk = (node: HastNode) => {
      const match = node.tagName ? /^h([1-6])$/.exec(node.tagName) : null;
      if (match) {
        const level = Number(match[1]);
        const text = collectText(node).trim();
        if (level >= 2 && level <= maxLevel && text) {
          node.properties = { ...node.properties, id: slug(text) };
        }
      }
      node.children?.forEach(walk);
    };
    walk(tree);
  };
}

/**
 * Renders MDX content with provided components
 *
 * This component evaluates MDX source content and renders it with the provided components.
 * It passes the React runtime directly to the MDX evaluator to avoid React version conflicts,
 * which is a common issue in Next.js 15.2.0+ with MDX libraries.
 */
export async function CustomMDX({
  source,
  additionalComponents,
}: CustomMDXProps) {
  try {
    const options: EvaluateOptions = {
      ...runtime,
      remarkPlugins: [remarkGfm],
      rehypePlugins: [
        [rehypePrettyCode, rehypePrettyCodeOptions],
        rehypeHeadingIds,
      ],
    };

    const { default: MDXContent } = await evaluate(source, options);

    const mergedComponents = {
      ...mdxComponents,
      ...(additionalComponents || {}),
    };

    return <MDXContent components={mergedComponents} />;
  } catch (error) {
    console.error('Error rendering MDX:', error);
    return (
      <div className="border-destructive/50 bg-destructive/10 text-destructive rounded-md border p-4">
        An error occurred while rendering the content.
      </div>
    );
  }
}
