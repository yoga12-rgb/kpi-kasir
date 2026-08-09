import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { DetailForm } from '@/components/categories/DetailForm';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { formatWeight } from '@/lib/utils';

export default async function CategoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(['admin']);
  const { id } = await params;
  const supabase = await createClient();

  const { data: category } = await supabase
    .from('category')
    .select('*, detail(*)')
    .eq('id', id)
    .single();

  if (!category) notFound();

  return (
    <div className="p-4">
        <Link href="/settings/categories" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline">
          <ArrowLeft className="h-4 w-4" />
          <span>Kategori</span>
        </Link>

        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-surface-900">{category.name}</h1>
            <p className="text-sm text-surface-500">Detail penilaian</p>
          </div>
          <Badge variant="info">{formatWeight(Number(category.weight))}</Badge>
        </div>

        <div className="mt-6 space-y-2">
          {(category.detail ?? []).map(
            (detail: {
              id: string;
              name: string;
              type: 'scale' | 'deduction';
              scale_max: number | null;
              deduction_points: number | null;
              is_active: boolean;
            }) => (
            <Card key={detail.id} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-surface-900">{detail.name}</p>
                <p className="text-xs text-surface-500">
                  {detail.type === 'scale'
                    ? `Skala 0–${detail.scale_max}`
                    : `Deduksi -${detail.deduction_points} poin/kejadian`}
                </p>
              </div>
              {detail.is_active ? (
                <Badge variant="success">Aktif</Badge>
              ) : (
                <Badge variant="muted">Nonaktif</Badge>
              )}
            </Card>
          ))}
          {(category.detail ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-surface-500">Belum ada detail.</p>
          )}
        </div>

        <div className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-surface-900">Tambah Detail</h2>
          <DetailForm categoryId={category.id} />
        </div>
    </div>
  );
}
