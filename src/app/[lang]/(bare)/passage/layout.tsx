import type { Metadata } from 'next';
import { getDictionary } from '@/i18n/dictionary';

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> => {
  const { lang } = await params;
  const dictionary = await getDictionary(lang, 'passage');
  return {
    title: String(dictionary['passage.title'] ?? ''),
    description: String(dictionary['passage.description'] ?? ''),
    keywords: String(dictionary['passage.keywords'] ?? ''),
  };
};

export default function PassageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
