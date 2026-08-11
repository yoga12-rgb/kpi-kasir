'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

export function initialsOf(name: string): string {
  return (name ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');
}

export function CashierAvatar({
  name,
  src,
  size = 48,
  className,
  loading = 'lazy',
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
  loading?: 'lazy' | 'eager';
}) {
  const style = { width: size, height: size };
  const textSize = size >= 64 ? 'text-2xl' : size >= 40 ? 'text-lg' : 'text-sm';
  const imageRef = useRef<HTMLImageElement>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [errorSrc, setErrorSrc] = useState<string | null>(null);
  const hasSource = Boolean(src);
  const imageLoaded = hasSource && loadedSrc === src;
  const imageErrored = hasSource && errorSrc === src;
  const state = !hasSource
    ? 'fallback'
    : imageLoaded
      ? 'loaded'
      : imageErrored
        ? 'error'
        : 'loading';

  const setImageResult = useCallback((image: HTMLImageElement, imageSrc: string) => {
    const finish = () => {
      if (image.naturalWidth > 0) {
        setLoadedSrc(imageSrc);
        return;
      }
      setErrorSrc(imageSrc);
    };

    if (typeof image.decode !== 'function') {
      finish();
      return;
    }

    void image
      .decode()
      .catch(() => undefined)
      .then(finish);
  }, []);

  useEffect(() => {
    if (!src) return;

    const image = imageRef.current;
    if (!image?.complete) return;

    if (image.naturalWidth === 0) {
      setErrorSrc(src);
      return;
    }

    setImageResult(image, src);
  }, [setImageResult, src]);

  if (src) {
    return (
      <div
        data-avatar-frame
        data-avatar-state={state}
        aria-busy={state === 'loading'}
        className={cn('relative flex shrink-0 overflow-hidden rounded-full', className)}
        style={style}
      >
        <Image
          ref={imageRef}
          src={src}
          alt={name}
          width={size}
          height={size}
          loading={loading}
          unoptimized
          onLoad={(event) => setImageResult(event.currentTarget, src)}
          onError={() => setErrorSrc(src)}
          className={cn(
            'h-full w-full rounded-full object-cover transition-opacity duration-150',
            imageLoaded ? 'opacity-100' : 'opacity-0'
          )}
        />
        {state === 'loading' && (
          <div
            aria-hidden="true"
            className="absolute inset-0 animate-pulse rounded-full bg-surface-200"
          />
        )}
        {state === 'error' && (
          <div
            aria-hidden="true"
            className={cn(
              'absolute inset-0 flex items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700',
              textSize
            )}
          >
            {initialsOf(name)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      data-avatar-frame
      data-avatar-state="fallback"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700',
        textSize,
        className
      )}
      style={style}
    >
      {initialsOf(name)}
    </div>
  );
}
