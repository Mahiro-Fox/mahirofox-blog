import { Zap } from 'lucide-react';
import React from 'react';
import { Spinner } from '@/components/shared/spinner';
import { useT } from '@/i18n/dictionary-provider';
import {
  ProcessedImageResult,
  UploadedFile,
} from '../_hooks/useImageCompressor';

interface StartProcessButtonProps {
  uploadedFiles: UploadedFile[];
  isProcessing: boolean;
  progress: number;
  results: Array<ProcessedImageResult | null>;
  handleStartProcess: () => void;
}

const StartProcessButton: React.FC<StartProcessButtonProps> = (props) => {
  const { uploadedFiles, isProcessing, progress, results, handleStartProcess } =
    props;
  const t = useT();

  return (
    uploadedFiles.length > 0 && (
      <button
        onClick={handleStartProcess}
        disabled={isProcessing}
        className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-6 py-3 font-medium text-[var(--primary-foreground)] shadow-[var(--primary)]/25 shadow-lg transition-[background-color,box-shadow] duration-200 hover:bg-[var(--primary)]/90 hover:shadow-[var(--primary)]/40 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isProcessing ? <Spinner /> : <Zap className="h-5 w-5" />}
        {isProcessing ? (
          <span>
            {t('image-compressor.processing_images')} {progress}%
          </span>
        ) : results.length > 0 ? (
          t('image-compressor.reconvert', { count: uploadedFiles.length })
        ) : (
          t('image-compressor.start_converting', {
            count: uploadedFiles.length,
          })
        )}
      </button>
    )
  );
};

export default StartProcessButton;
