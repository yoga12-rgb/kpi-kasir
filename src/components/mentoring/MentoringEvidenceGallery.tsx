'use client';

import Image from 'next/image';
import { ChevronLeft, ChevronRight, ImageOff, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/cn';

export interface MentoringEvidenceGalleryItem {
  byteSize: number;
  height: number;
  id: string;
  sortOrder: number;
  url: string;
  width: number;
}

type ImageLoadStatus = 'loading' | 'loaded' | 'error';

function EvidenceImageFeedback({
  dark = false,
  skeletonTestId,
  status,
}: {
  dark?: boolean;
  skeletonTestId: string;
  status: ImageLoadStatus;
}) {
  if (status === 'loaded') return null;

  if (status === 'loading') {
    return (
      <div
        aria-hidden="true"
        className={cn('absolute inset-0 animate-pulse', dark ? 'bg-surface-800' : 'bg-surface-200')}
        data-testid={skeletonTestId}
      />
    );
  }

  return (
    <div
      className={cn(
        'absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center',
        dark ? 'bg-black text-surface-300' : 'bg-surface-100 text-surface-500'
      )}
      role="status"
    >
      <ImageOff className="h-6 w-6" aria-hidden="true" />
      <span className="text-xs">Foto gagal dimuat</span>
    </div>
  );
}

export function MentoringEvidenceGallery({
  evidence,
}: {
  evidence: MentoringEvidenceGalleryItem[];
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [thumbnailStatuses, setThumbnailStatuses] = useState<Record<string, ImageLoadStatus>>({});
  const [modalImageStatus, setModalImageStatus] = useState<ImageLoadStatus>('loading');
  const activeEvidence = activeIndex === null ? null : (evidence[activeIndex] ?? null);

  const updateThumbnailStatus = useCallback((id: string, status: ImageLoadStatus) => {
    setThumbnailStatuses((current) =>
      current[id] === status ? current : { ...current, [id]: status }
    );
  }, []);
  const openEvidence = useCallback((index: number) => {
    setModalImageStatus('loading');
    setActiveIndex(index);
  }, []);
  const closeModal = useCallback(() => {
    setActiveIndex(null);
    setModalImageStatus('loading');
  }, []);
  const showPrevious = useCallback(() => {
    setModalImageStatus('loading');
    setActiveIndex((current) => {
      if (current === null || evidence.length === 0) return current;
      return (current - 1 + evidence.length) % evidence.length;
    });
  }, [evidence.length]);
  const showNext = useCallback(() => {
    setModalImageStatus('loading');
    setActiveIndex((current) => {
      if (current === null || evidence.length === 0) return current;
      return (current + 1) % evidence.length;
    });
  }, [evidence.length]);

  return (
    <>
      <Card className="mt-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-surface-900">Bukti Foto</h2>
          {evidence.length > 0 && (
            <span className="text-xs text-surface-500">{evidence.length} dari 3 foto</span>
          )}
        </div>

        {evidence.length === 0 ? (
          <EmptyState
            title="Belum ada bukti foto"
            description="Bukti foto akan tampil di sini setelah ditambahkan."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {evidence.map((item, index) => {
              const imageStatus = thumbnailStatuses[item.id] ?? 'loading';

              return (
                <button
                  key={item.id}
                  type="button"
                  className="group overflow-hidden rounded-xl border border-surface-200 bg-surface-50 text-left transition-colors hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                  onClick={() => openEvidence(index)}
                  aria-busy={imageStatus === 'loading'}
                  aria-label={'Buka bukti foto ' + (index + 1)}
                >
                  <div
                    className="relative w-full overflow-hidden bg-surface-100"
                    style={{ aspectRatio: item.width + ' / ' + item.height }}
                  >
                    <EvidenceImageFeedback
                      skeletonTestId="mentoring-evidence-thumbnail-skeleton"
                      status={imageStatus}
                    />
                    <Image
                      src={item.url}
                      alt={'Bukti foto ' + (index + 1)}
                      fill
                      sizes="(min-width: 640px) 33vw, 100vw"
                      className={cn(
                        'object-contain transition-[opacity,transform] duration-200 group-hover:scale-[1.02]',
                        imageStatus === 'loaded' ? 'opacity-100' : 'opacity-0'
                      )}
                      loading="lazy"
                      onLoad={() => updateThumbnailStatus(item.id, 'loaded')}
                      onError={() => updateThumbnailStatus(item.id, 'error')}
                      unoptimized
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <Modal
        open={activeEvidence !== null}
        onClose={closeModal}
        title={activeEvidence ? 'Bukti Foto ' + ((activeIndex ?? 0) + 1) : undefined}
        className="bg-surface-950 max-w-4xl p-3"
      >
        {activeEvidence && activeIndex !== null && (
          <div className="relative">
            <div
              className="relative flex max-h-[75vh] min-h-[240px] items-center justify-center overflow-hidden rounded-xl bg-black"
              aria-busy={modalImageStatus === 'loading'}
            >
              <EvidenceImageFeedback
                dark
                skeletonTestId="mentoring-evidence-lightbox-skeleton"
                status={modalImageStatus}
              />
              <Image
                src={activeEvidence.url}
                alt={'Bukti foto ' + (activeIndex + 1)}
                width={activeEvidence.width}
                height={activeEvidence.height}
                className={cn(
                  'max-h-[75vh] w-auto max-w-full object-contain transition-opacity duration-200',
                  modalImageStatus === 'loaded' ? 'opacity-100' : 'opacity-0'
                )}
                onLoad={() => setModalImageStatus('loaded')}
                onError={() => setModalImageStatus('error')}
                unoptimized
              />
            </div>
            <button
              type="button"
              className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white transition-colors hover:bg-black focus:outline-none focus:ring-2 focus:ring-primary-400"
              onClick={closeModal}
              aria-label="Tutup bukti foto"
            >
              <X className="h-5 w-5" />
            </button>
            {evidence.length > 1 && (
              <>
                <button
                  type="button"
                  className="absolute left-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white transition-colors hover:bg-black focus:outline-none focus:ring-2 focus:ring-primary-400"
                  onClick={showPrevious}
                  aria-label="Bukti foto sebelumnya"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white transition-colors hover:bg-black focus:outline-none focus:ring-2 focus:ring-primary-400"
                  onClick={showNext}
                  aria-label="Bukti foto berikutnya"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
