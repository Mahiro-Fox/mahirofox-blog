import { ReactNode } from 'react';
import { getDictionary } from '@/i18n/dictionary';
import { DictionaryProvider } from '@/i18n/dictionary-provider';

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ lang: string }>;
}) => {
  const { lang } = await params;
  const videosDictionary = await getDictionary(lang, 'videos');
  return {
    title: videosDictionary['videos.title'],
    description: videosDictionary['videos.description'],
    keywords: videosDictionary['videos.keywords'],
  };
};

interface VideosLayoutProps {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}

export default async function VideosLayout({
  children,
  params,
}: VideosLayoutProps) {
  const { lang } = await params;
  const videosDictionary = await getDictionary(lang, 'videos');
  return (
    <DictionaryProvider dictionary={videosDictionary}>
      <div className="bg-background min-h-screen">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </div>
    </DictionaryProvider>
  );
}
