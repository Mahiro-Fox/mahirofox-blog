'use client';

import { Images } from 'lucide-react';
import { Button } from '@/components/shadcn-ui/button';
import { useT } from '@/i18n/dictionary-provider';
import { trackEvent } from '@/utils/tracker';
import { formatSize } from '@/utils/utils';
import ControlPanel from './_components/control-panel';
import GalleryPickerDialog from './_components/gallery-picker-dialog';
import ImageList from './_components/image-list';
import { ObfuscatorHeader } from './_components/obfuscator-header';
import PreviewCard from './_components/preview-card';
import UploadDropzone from './_components/upload-dropzone';
import { useImageWorkspace } from './_hooks/use-image-workspace';

interface ImageObfuscatorClientProps {
  /** 通过 ?url= 传入的本站图片地址，载入后自动进入还原模式 */
  initialUrls?: string[];
}

export default function ImageObfuscatorClient({
  initialUrls = [],
}: ImageObfuscatorClientProps) {
  const t = useT();
  const {
    items,
    activeId,
    setActiveId,
    activeItem,
    mode,
    setMode,
    password,
    setPassword,
    strength,
    setStrength,
    greenBoost,
    setGreenBoost,
    format,
    setFormat,
    quality,
    setQuality,
    panelStatus,
    errorMessage,
    isBusy,
    isZipping,
    batchProgress,
    batchStage,
    counts,
    pickerOpen,
    setPickerOpen,
    resultRef,
    handleImport,
    handlePickFromGallery,
    handleRunAll,
    handleRetryFailed,
    handleCancel,
    handleRemoveItem,
    handleDownloadItem,
    handleDownloadAll,
    handleClearAll,
  } = useImageWorkspace({ initialUrls });

  const sourceMeta = activeItem
    ? `${activeItem.width}×${activeItem.height} · ${formatSize(activeItem.size)}`
    : undefined;

  const resultMeta = activeItem?.result
    ? `${activeItem.result.width}×${activeItem.result.height} · ${activeItem.result.format.toUpperCase()} · ${formatSize(activeItem.result.blob.size)}`
    : undefined;

  return (
    <div className="min-h-screen">
      <ObfuscatorHeader />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-3">
            <div className="flex justify-end">
              <Button
                disabled={isBusy}
                onClick={() => {
                  trackEvent('obfuscator-open-gallery-picker');
                  setPickerOpen(true);
                }}
                type="button"
              >
                <Images className="h-3.5 w-3.5" />
                {t('image-obfuscator.gallery_open')}
              </Button>
            </div>

            <UploadDropzone
              count={items.length}
              disabled={isBusy}
              onSelect={handleImport}
            />

            <ImageList
              items={items}
              activeId={activeId}
              disabled={isBusy}
              onSelect={setActiveId}
              onRemove={handleRemoveItem}
              onDownload={handleDownloadItem}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <PreviewCard
                title={t('image-obfuscator.original')}
                src={activeItem?.url ?? null}
                emptyText={t('image-obfuscator.original_empty')}
                meta={sourceMeta}
              />
              <PreviewCard
                ref={resultRef}
                title={t('image-obfuscator.result')}
                src={activeItem?.result?.url ?? null}
                emptyText={t('image-obfuscator.result_empty')}
                meta={resultMeta}
                busy={activeItem?.status === 'running'}
              />
            </div>
          </div>

          <div className="lg:col-span-2">
            <ControlPanel
              mode={mode}
              onModeChange={setMode}
              password={password}
              onPasswordChange={setPassword}
              strength={strength}
              onStrengthChange={setStrength}
              greenBoost={greenBoost}
              onGreenBoostChange={setGreenBoost}
              format={format}
              onFormatChange={setFormat}
              quality={quality}
              onQualityChange={setQuality}
              status={panelStatus}
              progress={batchProgress}
              stage={batchStage}
              errorMessage={errorMessage}
              metaNotice={activeItem?.meta ?? null}
              sizeNotice={activeItem?.sizeNotice ?? null}
              counts={counts}
              isDownloading={isZipping}
              canRun={items.length > 0}
              canDownloadAll={counts.done > 0}
              onRun={handleRunAll}
              onCancel={handleCancel}
              onRetryFailed={handleRetryFailed}
              onDownloadAll={handleDownloadAll}
              onReset={handleClearAll}
            />
          </div>
        </div>
      </div>

      <GalleryPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={handlePickFromGallery}
      />
    </div>
  );
}
