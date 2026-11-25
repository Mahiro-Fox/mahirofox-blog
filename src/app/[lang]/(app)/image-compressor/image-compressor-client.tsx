'use client';

import { Zap } from 'lucide-react';
import { useT } from '@/i18n/dictionary-provider';
import { trackEvent } from '@/utils/tracker';
import ConfigPanel from './_components/config-panel';
import ImageSliderView from './_components/image-slider-view';
import ImageUploader from './_components/image-uploader';
import ProcessStatus, {
  ProcessedImageResult,
} from './_components/process-status';
import StartProcessButton from './_components/start-process-button';
import { UploadedFile, useImageCompressor } from './_hooks/useImageCompressor';

/**
 * 下载单个文件
 */
const handleDownload = (result: ProcessedImageResult) => {
  trackEvent('download_image_file', {
    fileName: result.originalName,
  });
  if (!result.base64) return;

  const link = document.createElement('a');
  link.href = result.base64;

  // 生成文件名
  const originalName = result.originalName;
  const nameWithoutExt = originalName.substring(
    0,
    originalName.lastIndexOf('.')
  );
  const ext = result.metadata?.format || 'webp';
  link.download = `${nameWithoutExt}.${ext}`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

interface ImageCompressorHeaderProps {
  uploadedFiles: UploadedFile[];
  isProcessing: boolean;
  progress: number;
  results: Array<ProcessedImageResult | null>;
  onStart: () => void;
}

/**
 * 页面头部：标题 + 开始处理按钮
 */
function ImageCompressorHeader({
  uploadedFiles,
  isProcessing,
  progress,
  results,
  onStart,
}: ImageCompressorHeaderProps) {
  const t = useT();
  return (
    <div className="border-border border-b">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[var(--primary)] p-2">
              <Zap className="h-6 w-6 text-[var(--primary-foreground)]" />
            </div>
            <div>
              <h1 className="text-xl font-bold">
                {t('image-compressor.page_title')}
              </h1>
              <p className="text-muted-foreground text-sm">
                {t('image-compressor.subtitle')}
              </p>
            </div>
          </div>

          <StartProcessButton
            uploadedFiles={uploadedFiles}
            isProcessing={isProcessing}
            progress={progress}
            results={results}
            handleStartProcess={onStart}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * 页面底部
 */
function ImageCompressorFooter() {
  const t = useT();
  return (
    <div className="border-border mt-16 border-t">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="text-muted-foreground flex items-center justify-between text-sm">
          <p>{t('image-compressor.privacy_notice')}</p>
          <p>{t('image-compressor.built_with')}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * 图片压缩工具客户端组件
 * 管理全局状态和组件集成
 */
export default function ImageCompressorClient() {
  const {
    uploadedFiles,
    config,
    setConfig,
    results,
    isProcessing,
    progress,
    comparisonOpen,
    setComparisonOpen,
    comparisonResult,
    comparisonIndex,
    resultsSectionRef,
    resetConfig,
    handleFilesAdd,
    handleFileRemove,
    handleClearAll,
    handleStartProcess,
    handleDownloadAll,
    handleViewComparison,
    handlePreviousComparison,
    handleNextComparison,
  } = useImageCompressor();

  return (
    <div className="min-h-screen">
      {/* 头部 */}
      <ImageCompressorHeader
        uploadedFiles={uploadedFiles}
        isProcessing={isProcessing}
        progress={progress}
        results={results}
        onStart={handleStartProcess}
      />

      {/* Main content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Left: Upload area */}
          <div className="lg:col-span-2">
            <ImageUploader
              files={uploadedFiles}
              onFilesAdd={handleFilesAdd}
              onFileRemove={handleFileRemove}
              onClearAll={handleClearAll}
              disabled={isProcessing}
            />
          </div>

          {/* Right: Config panel */}
          <div className="lg:col-span-1">
            <ConfigPanel
              config={config}
              onConfigChange={setConfig}
              resetConfig={resetConfig}
              disabled={isProcessing}
            />
          </div>
        </div>

        {/* Processing status */}
        {results.length > 0 && (
          <div
            className="mt-8 scroll-mt-12 sm:scroll-mt-16"
            ref={resultsSectionRef}
          >
            <ProcessStatus
              results={results}
              isProcessing={isProcessing}
              progress={progress}
              onDownload={handleDownload}
              onDownloadAll={handleDownloadAll}
              onViewComparison={handleViewComparison}
            />
          </div>
        )}
      </div>

      {/* Comparison view */}
      <ImageSliderView
        isOpen={comparisonOpen}
        result={comparisonResult}
        onClose={() => setComparisonOpen(false)}
        onPrevious={handlePreviousComparison}
        onNext={handleNextComparison}
        hasPrevious={comparisonIndex > 0}
        hasNext={comparisonIndex < results.length - 1}
      />

      {/* Footer */}
      <ImageCompressorFooter />
    </div>
  );
}
