'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import {
  MentoringEvidencePicker,
  type MentoringEvidenceDraft,
} from '@/components/mentoring/MentoringEvidencePicker';
import { MAX_MENTORING_EVIDENCE_COUNT } from '@/lib/mentoring/evidence-constants';
import { useQueryClient } from '@tanstack/react-query';
import { appQueryKeys, invalidateAppQueries } from '@/lib/client/query-keys';
import { getErrorMessage } from '@/lib/utils';

export function MentoringEvidenceUploadPanel({
  existingCount,
  sessionId,
}: {
  existingCount: number;
  sessionId: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<MentoringEvidenceDraft[]>([]);
  const [pickerKey, setPickerKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remaining = Math.max(0, MAX_MENTORING_EVIDENCE_COUNT - existingCount);

  async function uploadDrafts() {
    setError(null);
    if (drafts.some((draft) => draft.status !== 'ready')) {
      setError('Tunggu kompresi selesai atau hapus foto yang gagal diproses.');
      return;
    }
    if (drafts.length === 0) {
      setError('Pilih minimal satu foto.');
      return;
    }

    setLoading(true);
    const failures: string[] = [];
    for (const [index, draft] of drafts.entries()) {
      if (!draft.uploadFile) continue;
      const formData = new FormData();
      formData.append('file', draft.uploadFile, draft.uploadFile.name);

      try {
        const response = await fetch(`/api/mentoring-sessions/${sessionId}/evidence`, {
          method: 'POST',
          body: formData,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(getErrorMessage(payload, `Bukti foto ${index + 1} gagal diupload`));
        }
      } catch (uploadError) {
        failures.push(`Foto ${index + 1}: ${getErrorMessage(uploadError, 'Upload gagal')}`);
      }
    }

    setLoading(false);
    if (failures.length > 0) {
      setError(failures.join(' '));
      return;
    }

    setDrafts([]);
    setPickerKey((current) => current + 1);
    void invalidateAppQueries(queryClient, [
      appQueryKeys.mentoringSessionsRoot,
      appQueryKeys.cashierTabsRoot,
    ]);
    router.refresh();
  }

  if (remaining === 0) return null;

  return (
    <div className="mt-4 space-y-3">
      <MentoringEvidencePicker
        key={pickerKey}
        disabled={loading}
        existingCount={existingCount}
        maxItems={remaining}
        onChange={setDrafts}
      />
      {error && (
        <p
          className="border-danger-200 bg-danger-50 text-danger-700 rounded-lg border p-3 text-sm"
          role="alert"
        >
          {error}
        </p>
      )}
      <Button
        type="button"
        fullWidth
        disabled={loading || drafts.length === 0}
        onClick={uploadDrafts}
      >
        {loading ? 'Mengupload foto...' : 'Upload Bukti Foto'}
      </Button>
    </div>
  );
}
