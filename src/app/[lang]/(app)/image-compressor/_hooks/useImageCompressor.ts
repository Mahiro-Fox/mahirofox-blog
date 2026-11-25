import JSZip from 'jszip';
import { toast } from 'sonner';
import { useRef, useState } from 'react';
import { useT } from '@/i18n/dictionary-provider';
import { trackEvent } from '@/utils/tracker';
import { ImageProcessConfig } from '../_components/config-panel';

/**
 * 上传的文件信息
 */
export interface UploadedFile {
  id: string;
  file: File;
  preview: string;
  name: string;
  size: number;
}

/**
 * ProcessedImageResult 类型（从 ProcessStatus 导入）
 */
export interface ProcessedImageResult {
  id: string;
  originalName: string;
  originalSize: number;
  originalPreview: string;
  success: boolean;
  error?: string;
  errorCode?: string;
  metadata?: {
    width: number;
    height: number;
    format: string;
    size: number;
    isAnimated: boolean;
  };
  base64?: string;
}

/**
 * 图片压缩工具全局状态与处理逻辑
 */
export function useImageCompressor() {
  const t = useT();
  const resultsSectionRef = useRef<HTMLDivElement>(null);
  // 上传的文件列表
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  // 处理配置
  const [config, setConfig] = useState<ImageProcessConfig>({
    targetFormat: 'webp',
    quality: 80,
    keepMetadata: false,
    convertAnimation: false,
  });

  // 处理结果列表
  const [results, setResults] = useState<Array<ProcessedImageResult | null>>(
    []
  );

  // 是否正在处理
  const [isProcessing, setIsProcessing] = useState(false);

  // 处理进度
  const [progress, setProgress] = useState(0);

  // 对比视图状态
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [comparisonResult, setComparisonResult] =
    useState<ProcessedImageResult | null>(null);
  const [comparisonIndex, setComparisonIndex] = useState(0);

  /**
   * 重置配置
   */
  const resetConfig = () => {
    setConfig({
      targetFormat: 'webp',
      quality: 80,
      keepMetadata: false,
      convertAnimation: false,
    });
    trackEvent('reset-image-config');
  };

  /**
   * 添加文件
   */
  const handleFilesAdd = async (newFiles: UploadedFile[]) => {
    const { MAX_TOTAL_SIZE } = await import('@/constant');
    const currentTotalSize = uploadedFiles.reduce((sum, f) => sum + f.size, 0);
    trackEvent('add-files', {
      numFiles: newFiles.length,
      currentTotalSize,
      maxTotalSize: MAX_TOTAL_SIZE,
    });

    let totalSize = currentTotalSize;
    const addedFiles: UploadedFile[] = [];
    let isOverLimit = false;

    for (const file of newFiles) {
      if (totalSize + file.size <= MAX_TOTAL_SIZE) {
        addedFiles.push(file);
        totalSize += file.size;
      } else {
        isOverLimit = true;
      }
    }

    if (isOverLimit) {
      setTimeout(() => {
        toast.error(t('image-compressor.total_size_exceeded'));
      }, 2000);
    }

    if (addedFiles.length > 0) {
      setUploadedFiles([...uploadedFiles, ...addedFiles]);
      // 清空之前的处理结果
      setResults([]);
    }
  };

  /**
   * 移除文件
   */
  const handleFileRemove = (id: string) => {
    trackEvent('remove-file', {
      id,
    });
    setUploadedFiles(uploadedFiles.filter((f) => f.id !== id));
    setResults([]);
  };

  /**
   * 清空全部文件
   */
  const handleClearAll = () => {
    trackEvent('clear-all-files');
    setUploadedFiles([]);
    setResults([]);
  };

  /**
   * 滚动到结果区域
   */
  const scrollToResults = () => {
    resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  /**
   * 开始处理
   */
  const handleStartProcess = async () => {
    trackEvent('start-process', {
      numFiles: uploadedFiles.length,
      config,
    });
    if (uploadedFiles.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setProgress(0);
    setResults([]);

    try {
      // 创建 FormData
      const formData = new FormData();

      // 添加文件
      uploadedFiles.forEach((file) => {
        formData.append('files', file.file);
      });

      // 添加配置
      formData.append('options', JSON.stringify(config));

      // 发送请求
      const response = await fetch('/next-api/image/process', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('image-compressor.process_failed'));
      }

      // 读取流式响应
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Unable to read response stream');

      const decoder = new TextDecoder();
      let buffer = '';
      const processedResults: ProcessedImageResult[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const data = JSON.parse(line);

          if (data.type === 'start') {
            // 开始处理，初始化结果列表
            setResults(new Array(data.total).fill(null));
          } else if (data.type === 'result') {
            const { index, result } = data;
            const item: ProcessedImageResult = {
              id: uploadedFiles[index].id,
              originalName: uploadedFiles[index].name,
              originalSize: uploadedFiles[index].size,
              originalPreview: uploadedFiles[index].preview,
              success: result.success,
              error: result.error,
              errorCode: result.errorCode,
              metadata: result.metadata,
              base64: result.base64,
            };

            processedResults[index] = item;
            // 实时更新结果列表
            setResults((prev) => {
              const newResults = [...prev];
              newResults[index] = item;
              return newResults;
            });

            // 实时更新进度（基于已完成数量）
            const completedCount = processedResults.filter(Boolean).length;
            const newProgress = Math.round(
              (completedCount / uploadedFiles.length) * 100
            );
            setProgress(newProgress);
          } else if (data.type === 'done') {
            // 全部完成
            setProgress(100);
          } else if (data.type === 'error') {
            throw new Error(data.error);
          }
        }
      }
      scrollToResults();
    } catch (error) {
      console.error('Processing failed:', error);
      alert(
        error instanceof Error
          ? error.message
          : t('image-compressor.process_failed')
      );
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  /**
   * 下载全部文件
   */
  const handleDownloadAll = async () => {
    const successResults = results.filter(
      (r): r is ProcessedImageResult => r !== null && r.success && !!r.base64
    );

    if (successResults.length === 0) return;

    trackEvent('download-all-images', {
      numFiles: successResults.length,
    });

    try {
      // 创建 ZIP 实例
      const zip = new JSZip();

      // 将所有成功的图片添加到 ZIP 中
      for (const result of successResults) {
        // 生成文件名
        const originalName = result.originalName;
        const nameWithoutExt = originalName.substring(
          0,
          originalName.lastIndexOf('.')
        );
        const ext = result.metadata?.format || 'webp';
        const fileName = `${nameWithoutExt}.${ext}`;

        // 将 base64 转换为二进制数据
        const base64Data = result.base64!.split(',')[1];
        const binaryData = atob(base64Data);
        const bytes = new Uint8Array(binaryData.length);
        for (let i = 0; i < binaryData.length; i++) {
          bytes[i] = binaryData.charCodeAt(i);
        }

        // 添加到 ZIP
        zip.file(fileName, bytes);
      }

      // 生成 ZIP 文件
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      trackEvent('download_all_images', {
        numFiles: successResults.length,
      });
      // 创建下载链接
      const zipUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = zipUrl;
      link.download = `compressed_images_${Date.now()}.zip`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // 释放 URL 对象
      URL.revokeObjectURL(zipUrl);
    } catch (error) {
      console.error('Bundle download failed:', error);
      alert(t('image-compressor.bundle_download_failed'));
    }
  };

  /**
   * 查看对比
   */
  const handleViewComparison = (result: ProcessedImageResult) => {
    const index = results.findIndex((r) => r && r.id === result.id);
    setComparisonIndex(index);
    setComparisonResult(result);
    setComparisonOpen(true);
  };

  /**
   * 切换到上一张
   */
  const handlePreviousComparison = () => {
    if (comparisonIndex > 0) {
      const newIndex = comparisonIndex - 1;
      setComparisonIndex(newIndex);
      setComparisonResult(results[newIndex]);
    }
  };

  /**
   * 切换到下一张
   */
  const handleNextComparison = () => {
    if (comparisonIndex < results.length - 1) {
      const newIndex = comparisonIndex + 1;
      setComparisonIndex(newIndex);
      setComparisonResult(results[newIndex]);
    }
  };

  return {
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
  };
}
