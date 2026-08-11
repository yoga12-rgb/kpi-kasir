'use client';

import { ArrowLeft, ArrowRight, Camera, Images, LoaderCircle, X } from 'lucide-react';
import NextImage from 'next/image';
import { useEffect, useRef, useState } from 'react';
import {
  MAX_MENTORING_EVIDENCE_COUNT,
  MAX_MENTORING_EVIDENCE_SOURCE_BYTES,
  MENTORING_EVIDENCE_ACCEPT,
  MENTORING_EVIDENCE_ALLOWED_INPUT_MIME,
  MENTORING_EVIDENCE_TRANSPORT_BYTES,
} from '@/lib/mentoring/evidence-constants';
import { cn } from '@/lib/cn';

export type MentoringEvidenceDraftStatus = 'processing' | 'ready' | 'failed';

export interface MentoringEvidenceDraft {
  id: string;
  previewUrl: string;
  status: MentoringEvidenceDraftStatus;
  uploadFile: File | null;
  error?: string;
}

interface ImageSource {
  close?: () => void;
  height: number;
  width: number;
  draw: (context: CanvasRenderingContext2D, width: number, height: number) => void;
}

function loadImageSource(file: File): Promise<ImageSource> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file, { imageOrientation: 'from-image' }).then((bitmap) => ({
      close: () => bitmap.close(),
      height: bitmap.height,
      width: bitmap.width,
      draw: (context, width, height) => context.drawImage(bitmap, 0, 0, width, height),
    }));
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        height: image.naturalHeight,
        width: image.naturalWidth,
        draw: (context, width, height) => context.drawImage(image, 0, 0, width, height),
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Foto tidak dapat dibaca oleh browser'));
    };
    image.src = objectUrl;
  });
}

function canvasBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function compressForTransport(file: File, id: string) {
  if (file.size > MAX_MENTORING_EVIDENCE_SOURCE_BYTES) {
    throw new Error('Ukuran foto asli maksimal 10 MB');
  }
  if (
    file.type &&
    !(MENTORING_EVIDENCE_ALLOWED_INPUT_MIME as readonly string[]).includes(file.type)
  ) {
    throw new Error('Format foto harus JPG, PNG, atau WebP');
  }

  const source = await loadImageSource(file);
  const canvas = document.createElement('canvas');
  const maxDimension = Math.max(source.width, source.height);
  const dimensions = [1280, 1152, 1024, 896, 720];
  const qualities = [0.82, 0.72, 0.62, 0.55];
  let outputType = 'image/webp';
  let accepted: Blob | null = null;

  try {
    for (const dimension of dimensions) {
      const scale = Math.min(1, dimension / maxDimension);
      const width = Math.max(1, Math.round(source.width * scale));
      const height = Math.max(1, Math.round(source.height * scale));
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Browser tidak mendukung pemrosesan foto');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      source.draw(context, width, height);

      for (const quality of qualities) {
        let blob = await canvasBlob(canvas, outputType, quality);
        if (!blob && outputType !== 'image/jpeg') {
          outputType = 'image/jpeg';
          blob = await canvasBlob(canvas, outputType, quality);
        }
        if (blob && blob.size <= MENTORING_EVIDENCE_TRANSPORT_BYTES) {
          accepted = blob;
          break;
        }
      }
      if (accepted) break;
    }
  } finally {
    source.close?.();
    canvas.width = 0;
    canvas.height = 0;
  }

  if (!accepted) {
    throw new Error('Foto terlalu kompleks untuk dikompres. Pilih foto lain.');
  }

  const extension = outputType === 'image/webp' ? 'webp' : 'jpg';
  return new File([accepted], 'evidence-' + id + '.' + extension, {
    type: outputType,
    lastModified: Date.now(),
  });
}

function statusLabel(status: MentoringEvidenceDraftStatus) {
  if (status === 'processing') return 'Mengompres...';
  if (status === 'failed') return 'Gagal diproses';
  return 'Siap diupload';
}

export function MentoringEvidencePicker({
  disabled = false,
  existingCount = 0,
  maxItems = MAX_MENTORING_EVIDENCE_COUNT,
  onChange,
}: {
  disabled?: boolean;
  existingCount?: number;
  maxItems?: number;
  onChange: (items: MentoringEvidenceDraft[]) => void;
}) {
  const [items, setItems] = useState<MentoringEvidenceDraft[]>([]);
  const itemsRef = useRef(items);
  const mountedRef = useRef(true);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  function applyItems(next: MentoringEvidenceDraft[]) {
    itemsRef.current = next;
    setItems(next);
    onChange(next);
  }

  function updateItem(id: string, update: Partial<MentoringEvidenceDraft>) {
    applyItems(itemsRef.current.map((item) => (item.id === id ? { ...item, ...update } : item)));
  }

  async function processFile(file: File) {
    const id = crypto.randomUUID();
    const sourcePreviewUrl = URL.createObjectURL(file);
    const draft: MentoringEvidenceDraft = {
      id,
      previewUrl: sourcePreviewUrl,
      status: 'processing',
      uploadFile: null,
    };
    applyItems([...itemsRef.current, draft]);

    try {
      const compressedFile = await compressForTransport(file, id);
      const compressedPreviewUrl = URL.createObjectURL(compressedFile);
      if (!mountedRef.current || !itemsRef.current.some((item) => item.id === id)) {
        URL.revokeObjectURL(compressedPreviewUrl);
        return;
      }
      URL.revokeObjectURL(sourcePreviewUrl);
      updateItem(id, {
        previewUrl: compressedPreviewUrl,
        status: 'ready',
        uploadFile: compressedFile,
      });
    } catch (error) {
      if (!mountedRef.current || !itemsRef.current.some((item) => item.id === id)) return;
      updateItem(id, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Foto tidak dapat diproses',
      });
    }
  }

  function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    const available = Math.max(0, maxItems - itemsRef.current.length);
    files.slice(0, available).forEach((file) => void processFile(file));
  }

  function removeItem(id: string) {
    const current = itemsRef.current;
    const item = current.find((entry) => entry.id === id);
    if (item) URL.revokeObjectURL(item.previewUrl);
    applyItems(current.filter((entry) => entry.id !== id));
  }

  function moveItem(id: string, direction: -1 | 1) {
    const current = [...itemsRef.current];
    const index = current.findIndex((entry) => entry.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return;
    [current[index], current[nextIndex]] = [current[nextIndex], current[index]];
    applyItems(current);
  }

  const canAddMore = !disabled && items.length < maxItems;

  return (
    <div className="rounded-xl border border-surface-200 bg-surface-50 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-surface-900">Bukti Foto</h3>
          <p className="mt-0.5 text-xs text-surface-500">
            {existingCount > 0
              ? `Tambahkan maksimal ${maxItems} foto lagi`
              : 'Opsional, maksimal 3 foto'}
          </p>
        </div>
        <span className="text-xs text-surface-500">
          {existingCount + items.length}/{MAX_MENTORING_EVIDENCE_COUNT}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          ref={cameraInputRef}
          type="file"
          accept={MENTORING_EVIDENCE_ACCEPT}
          capture="environment"
          className="sr-only"
          onChange={handleFiles}
          disabled={!canAddMore}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept={MENTORING_EVIDENCE_ACCEPT}
          multiple
          className="sr-only"
          onChange={handleFiles}
          disabled={!canAddMore}
        />
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => cameraInputRef.current?.click()}
          disabled={!canAddMore}
          title="Ambil foto dengan kamera"
        >
          <Camera className="h-4 w-4" />
          <span>Kamera</span>
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => galleryInputRef.current?.click()}
          disabled={!canAddMore}
          title="Pilih foto dari perangkat"
        >
          <Images className="h-4 w-4" />
          <span>Galeri</span>
        </button>
      </div>

      {items.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="overflow-hidden rounded-xl border border-surface-200 bg-white"
            >
              <div className="relative aspect-square bg-surface-100">
                <NextImage
                  src={item.previewUrl}
                  alt={'Preview bukti foto ' + (index + 1)}
                  fill
                  sizes="(min-width: 640px) 33vw, 100vw"
                  className={cn('object-contain', item.status === 'processing' && 'opacity-50')}
                  unoptimized
                />
                {item.status === 'processing' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                    <LoaderCircle className="h-7 w-7 animate-spin text-primary-600" />
                  </div>
                )}
                <button
                  type="button"
                  className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  onClick={() => removeItem(item.id)}
                  disabled={disabled}
                  aria-label="Hapus preview bukti foto"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 p-2">
                <span
                  className={cn(
                    'min-w-0 truncate text-xs',
                    item.status === 'failed' ? 'text-danger-600' : 'text-surface-500'
                  )}
                  title={item.error}
                >
                  {statusLabel(item.status)}
                </span>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    className="icon-button h-7 w-7"
                    onClick={() => moveItem(item.id, -1)}
                    disabled={disabled || index === 0}
                    aria-label="Geser foto ke kiri"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="icon-button h-7 w-7"
                    onClick={() => moveItem(item.id, 1)}
                    disabled={disabled || index === items.length - 1}
                    aria-label="Geser foto ke kanan"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {item.error && (
                <p className="px-2 pb-2 text-xs text-danger-600" role="alert">
                  {item.error}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
