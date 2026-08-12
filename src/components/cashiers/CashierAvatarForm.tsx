'use client';

import Cropper, { type Area } from 'react-easy-crop';
import { Camera, ImagePlus, ZoomIn, ZoomOut } from 'lucide-react';
import { type ReactNode, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CashierAvatar } from './CashierAvatar';
import { Toast } from '@/components/ui/Overlay';
import { Modal } from '@/components/ui/Modal';
import { useQueryClient } from '@tanstack/react-query';
import { appQueryKeys, invalidateAppQueries } from '@/lib/client/query-keys';
import { getErrorMessage } from '@/lib/utils';

const MAX_SOURCE_SIZE = 10 * 1024 * 1024;
const MAX_UPLOAD_SIZE = 2 * 1024 * 1024;
const CROP_OUTPUT_SIZE = 512;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Foto tidak dapat dibaca'));
    image.src = src;
  });
}

async function createCroppedFile(imageSrc: string, crop: Area): Promise<File> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = CROP_OUTPUT_SIZE;
  canvas.height = CROP_OUTPUT_SIZE;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Browser tidak mendukung pemrosesan foto');

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    CROP_OUTPUT_SIZE,
    CROP_OUTPUT_SIZE
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Foto gagal diproses'))),
      'image/jpeg',
      0.88
    );
  });

  if (blob.size > MAX_UPLOAD_SIZE) {
    throw new Error('Hasil crop masih terlalu besar. Silakan pilih area yang lebih kecil.');
  }

  return new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
}

export function CashierAvatarForm({
  cashierId,
  name,
  avatarUrl,
  canUpload = true,
  avatarSize = 88,
  details,
}: {
  cashierId: string;
  name: string;
  avatarUrl?: string | null;
  canUpload?: boolean;
  avatarSize?: number;
  details?: ReactNode;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(
    null
  );
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  async function uploadPhoto(file: File) {
    setLoading(true);
    setToast(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/cashiers/${cashierId}/avatar`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setToast({ message: getErrorMessage(data.error, 'Gagal mengunggah foto'), variant: 'error' });
        return;
      }

      setToast({ message: 'Foto profil diperbarui', variant: 'success' });
      void invalidateAppQueries(queryClient, [
        appQueryKeys.urlLists,
        appQueryKeys.leaderboardRoot,
      ]);
      router.refresh();
    } catch (err) {
      setToast({ message: getErrorMessage(err), variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  function closeCropper() {
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    setImageSrc(null);
    setCroppedAreaPixels(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  }

  async function confirmCrop() {
    if (!imageSrc || !croppedAreaPixels) return;

    setLoading(true);
    try {
      const croppedFile = await createCroppedFile(imageSrc, croppedAreaPixels);
      closeCropper();
      await uploadPhoto(croppedFile);
    } catch (err) {
      setToast({ message: getErrorMessage(err), variant: 'error' });
      setLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > MAX_SOURCE_SIZE) {
      setToast({ message: 'Ukuran foto asli maksimal 10 MB', variant: 'error' });
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      setToast({ message: 'Format harus jpg, png, atau webp', variant: 'error' });
      return;
    }

    setImageSrc(URL.createObjectURL(file));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <CashierAvatar
          name={name}
          src={avatarUrl}
          size={avatarSize}
          className="ring-4 ring-primary-500/15 ring-offset-4 ring-offset-surface-100"
        />

        {canUpload && (
          <button
            type="button"
            className="absolute -bottom-1 -right-2 flex h-10 w-10 items-center justify-center rounded-full border border-primary-500/40 bg-surface-100 text-primary-500 shadow-lg ring-4 ring-surface-50 transition-colors hover:border-primary-400 hover:bg-primary-500/10 hover:text-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:ring-offset-2 focus:ring-offset-surface-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            aria-label={avatarUrl ? 'Ganti foto profil' : 'Upload foto profil'}
            title={avatarUrl ? 'Ganti foto profil' : 'Upload foto profil'}
          >
            {avatarUrl ? <Camera className="h-4 w-4" /> : <ImagePlus className="h-4 w-4" />}
          </button>
        )}
      </div>

      {details}

      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={handleFileChange}
      />

      <Toast
        open={!!toast}
        message={toast?.message ?? ''}
        variant={toast?.variant ?? 'info'}
        onClose={() => setToast(null)}
      />

      <Modal
        open={!!imageSrc}
        onClose={loading ? () => undefined : closeCropper}
        title="Atur Foto Kasir"
        className="max-w-lg"
      >
        {imageSrc && (
          <div className="space-y-4">
            <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-black">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, area) => setCroppedAreaPixels(area)}
              />
            </div>

            <div className="flex items-center gap-3">
              <ZoomOut className="h-4 w-4 shrink-0 text-surface-500" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="h-2 w-full cursor-pointer accent-primary-600"
                aria-label="Zoom foto"
              />
              <ZoomIn className="h-4 w-4 shrink-0 text-surface-500" />
            </div>

            <p className="text-xs leading-5 text-surface-500">
              Geser foto sampai posisi wajah berada di tengah lingkaran. Gunakan slider untuk
              mengatur zoom.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                className="btn btn-secondary flex-1"
                onClick={closeCropper}
                disabled={loading}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary flex-1"
                onClick={confirmCrop}
                disabled={loading || !croppedAreaPixels}
              >
                {loading ? 'Memproses...' : 'Gunakan Foto'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
