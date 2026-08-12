import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { CategoryEditForm } from '@/components/categories/CategoryEditForm';
import { CategoryStatusButton } from '@/components/categories/CategoryStatusButton';
import { DetailForm } from '@/components/categories/DetailForm';
import { DetailStatusButton } from '@/components/categories/DetailStatusButton';
import { NavigationLink } from '@/components/ui/NavigationLink';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export default async function CategoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ detailStatus?: string }>;
}) {
  await requireRole(['admin']);
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();

  const { data: category } = await supabase
    .from('category')
    .select(
      'id, name, weight, is_active, detail(id, category_id, name, type, scale_max, deduction_points, is_active)'
    )
    .eq('id', id)
    .single();

  if (!category) notFound();

  const { data: activeCategories } = await supabase
    .from('category')
    .select('id, weight')
    .eq('is_active', true);
  const otherActiveWeightTotal = (activeCategories ?? [])
    .filter((activeCategory) => activeCategory.id !== category.id)
    .reduce((total, activeCategory) => total + Number(activeCategory.weight), 0);

  const detailStatus =
    query?.detailStatus === 'active' || query?.detailStatus === 'archived'
      ? query.detailStatus
      : category.is_active
        ? 'active'
        : 'archived';
  const allDetails = category.detail ?? [];
  const details = allDetails.filter((detail) =>
    detailStatus === 'active' ? detail.is_active : !detail.is_active
  );
  const categoryListHref = category.is_active
    ? '/settings/categories'
    : '/settings/categories?status=archived';

  return (
    <div className="p-4">
      <NavigationLink
        href={categoryListHref}
        className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Indikator</span>
      </NavigationLink>

      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-surface-900">{category.name}</h1>
          <p className="text-sm text-surface-500">Detail penilaian</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={category.is_active ? 'success' : 'muted'}>
            {category.is_active ? 'Aktif' : 'Diarsipkan'}
          </Badge>
          <CategoryStatusButton
            categoryId={category.id}
            categoryName={category.name}
            isActive={category.is_active}
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl border border-surface-200 bg-surface-100 p-1">
        <NavigationLink
          href={`/settings/categories/${category.id}?detailStatus=active`}
          className={`rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors ${
            detailStatus === 'active'
              ? 'bg-white text-surface-900 shadow-sm'
              : 'text-surface-500 hover:text-surface-900'
          }`}
        >
          Detail Aktif ({allDetails.filter((detail) => detail.is_active).length})
        </NavigationLink>
        <NavigationLink
          href={`/settings/categories/${category.id}?detailStatus=archived`}
          className={`rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors ${
            detailStatus === 'archived'
              ? 'bg-white text-surface-900 shadow-sm'
              : 'text-surface-500 hover:text-surface-900'
          }`}
        >
          Detail Arsip ({allDetails.filter((detail) => !detail.is_active).length})
        </NavigationLink>
      </div>

      <div className="mt-3 space-y-2">
        {details.map((detail) => (
          <Card key={detail.id} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-surface-900">{detail.name}</p>
              <p className="text-xs text-surface-500">
                {detail.type === 'scale'
                  ? `Skala 0-${detail.scale_max}`
                  : `Deduksi -${detail.deduction_points} poin/kejadian`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant={detail.is_active ? 'success' : 'muted'}>
                {detail.is_active ? 'Aktif' : 'Diarsipkan'}
              </Badge>
              {category.is_active && (
                <DetailStatusButton
                  categoryId={category.id}
                  detailId={detail.id}
                  detailName={detail.name}
                  isActive={detail.is_active}
                />
              )}
            </div>
          </Card>
        ))}
        {details.length === 0 && (
          <p className="py-6 text-center text-sm text-surface-500">
            {detailStatus === 'active'
              ? 'Belum ada detail aktif.'
              : 'Belum ada detail yang diarsipkan.'}
          </p>
        )}
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-surface-900">Konfigurasi Indikator</h2>
        {category.is_active ? (
          <CategoryEditForm
            categoryId={category.id}
            initialName={category.name}
            initialWeight={Number(category.weight)}
            otherActiveWeightTotal={otherActiveWeightTotal}
          />
        ) : (
          <Card>
            <p className="text-sm text-surface-500">
              Indikator arsip bersifat read-only. Pulihkan indikator untuk mengubah konfigurasi.
            </p>
          </Card>
        )}
      </div>

      {category.is_active && (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-surface-900">Tambah Detail</h2>
          <DetailForm categoryId={category.id} />
        </div>
      )}
    </div>
  );
}
