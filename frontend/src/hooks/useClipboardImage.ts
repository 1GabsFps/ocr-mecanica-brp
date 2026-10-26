import { useCallback, useEffect, useState, useRef, ChangeEvent, DragEvent } from 'react';

export interface UseClipboardImageReturn {
  imageSrc: string | null;
  imageFile: File | null;
  isDragging: boolean;
  error: string | null;
  setImageSrc: (src: string | null) => void;
  handleFileSelect: (file: File) => void;
  handleFileInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
  handleDragOver: (e: DragEvent) => void;
  handleDragLeave: (e: DragEvent) => void;
  handleDrop: (e: DragEvent) => void;
  resetImage: () => void;
}

export function useClipboardImage(
  autoPasteEnabled = false,
  onImageLoaded?: (src: string) => void
): UseClipboardImageReturn {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const lastClipboardSignatureRef = useRef<string | null>(null);
  const onImageLoadedRef = useRef(onImageLoaded);
  useEffect(() => {
    onImageLoadedRef.current = onImageLoaded;
  }, [onImageLoaded]);

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecione ou cole um arquivo de imagem válido (PNG, JPG, WebP).');
      return;
    }

    setError(null);
    setImageFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        // Forçar atualização substituindo a imagem imediatamente
        setImageSrc(result);
        onImageLoadedRef.current?.(result);
      }
    };
    reader.onerror = () => {
      setError('Falha ao ler o arquivo de imagem.');
    };
    reader.readAsDataURL(file);
  }, []);

  // Global Paste Listener (Ctrl+V em qualquer lugar da tela, substitui na hora a imagem atual)
  useEffect(() => {
    const handleWindowPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            // Atualiza assinatura para não duplicar no foco logo em seguida
            lastClipboardSignatureRef.current = `${file.size}_${file.type}_${file.lastModified}`;
            processFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => {
      window.removeEventListener('paste', handleWindowPaste);
    };
  }, [processFile]);

  // Auto-Colar ao Focar na Janela / Alt+Tab
  useEffect(() => {
    if (!autoPasteEnabled) return;

    const checkClipboardOnFocus = async () => {
      if (!navigator.clipboard || !navigator.clipboard.read) return;

      try {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
          const imageType = item.types.find((t) => t.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            const signature = `${blob.size}_${blob.type}`;

            // Evita reprocessar repetidamente a mesma imagem se o usuário der Alt+Tab várias vezes
            if (lastClipboardSignatureRef.current === signature) {
              return;
            }

            lastClipboardSignatureRef.current = signature;
            const file = new File([blob], `screenshot_${Date.now()}.${imageType.split('/')[1] || 'png'}`, {
              type: imageType,
            });
            processFile(file);
            break;
          }
        }
      } catch (_) {
        // Ignora silenciosamente se o clipboard não tiver imagem ou permissão ainda não concedida
      }
    };

    const handleFocus = () => {
      checkClipboardOnFocus();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkClipboardOnFocus();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [autoPasteEnabled, processFile]);

  const handleFileSelect = useCallback(
    (file: File) => {
      processFile(file);
    },
    [processFile]
  );

  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        processFile(files[0]);
      }
      e.target.value = '';
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        processFile(files[0]);
      }
    },
    [processFile]
  );

  const resetImage = useCallback(() => {
    setImageSrc(null);
    setImageFile(null);
    setError(null);
    lastClipboardSignatureRef.current = null;
  }, []);

  return {
    imageSrc,
    imageFile,
    isDragging,
    error,
    setImageSrc,
    handleFileSelect,
    handleFileInputChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    resetImage,
  };
}
