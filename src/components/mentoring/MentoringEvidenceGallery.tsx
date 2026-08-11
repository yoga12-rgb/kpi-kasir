'use client';

import Image from 'next/image';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Modal';

export interface MentoringEvidenceGalleryItem {
  byteSize: number;
  height: number;
  id: string;
  sortOrder: number;
  url: string;
  width: number;
}

export function MentoringEvidenceGallery({
  evidence,
}: {
  evidence: MentoringEvidenceGalleryItem[];
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeEvidence = activeIndex === null ? null : (evidence[activeIndex] ?? null);

  const closeModal = useCallback(() => setActiveIndex(null), []);
  const showPrevious = useCallback(() => {
    setActiveIndex((current) => {
      if (current === null || evidence.length === 0) return current;
      return (current - 1 + evidence.length) % evidence.length;
    });
  }, [evidence.length]);
  const showNext = useCallback(() => {
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
            {evidence.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className="group overflow-hidden rounded-xl border border-surface-200 bg-surface-50 text-left transition-colors hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                onClick={() => setActiveIndex(index)}
                aria-label={'Buka bukti foto ' + (index + 1)}
              >
                <div
                  className="relative w-full"
                  style={{ aspectRatio: item.width + ' / ' + item.height }}
                >
                  <Image
                    src={item.url}
                    alt={'Bukti foto ' + (index + 1)}
                    fill
                    sizes="(min-width: 640px) 33vw, 100vw"
                    className="object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                    loading="lazy"
                    unoptimized
                  />
                </div>
              </button>
            ))}
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
            <div className="relative flex max-h-[75vh] min-h-[240px] items-center justify-center overflow-hidden rounded-xl bg-black">
              <Image
                src={activeEvidence.url}
                alt={'Bukti foto ' + (activeIndex + 1)}
                width={activeEvidence.width}
                height={activeEvidence.height}
                className="max-h-[75vh] w-auto max-w-full object-contain"
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
