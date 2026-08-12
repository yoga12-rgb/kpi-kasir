import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { CategoryForm } from '@/components/categories/CategoryForm';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { formatWeight } from '@/lib/utils';
import { NavigationLink } from '@/components/ui/NavigationLink';

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  await requireRole(['admin']);
  const supabase = await createClient();
  const params = await searchParams;
  const status = params?.status === 'archived' ? 'archived' : 'active';

  const { data: allCategories } = await supabase
    .from('category')
    .select('id, name, weight, is_active, detail(id, is_active)')
    .order('name');

  const categories = (allCategories ?? []).filter((category) =>
    status === 'active' ? category.is_active : !category.is_active
  );
  const activeCategories = (allCategories ?? []).filter((category) => category.is_active);
  const total = activeCategories.reduce((acc, category) => acc + Number(category.weight), 0);
  const isBalanced = Math.abs(total - 100) < 0.001;
  const remaining = Math.max(0, 100 - total);

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold text-surface-900">Indikator Penilaian</h1>
      <p className="mt-0.5 text-sm text-surface-500">Konfigurasi bobot & detail penilaian</p>

      <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl border border-surface-200 bg-surface-100 p-1">
        <NavigationLink
          href="/settings/categories"
          className={`rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors ${
            status === 'active'
              ? 'bg-white text-surface-900 shadow-sm'
              : 'text-surface-500 hover:text-surface-900'
          }`}
        >
          Aktif ({activeCategories.length})
        </NavigationLink>
        <NavigationLink
          href="/settings/categories?status=archived"
          className={`rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors ${
            status === 'archived'
              ? 'bg-white text-surface-900 shadow-sm'
              : 'text-surface-500 hover:text-surface-900'
          }`}
        >
          Arsip ({(allCategories ?? []).length - activeCategories.length})
        </NavigationLink>
      </div>

      {status === 'active' && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-surface-600">
            Total bobot:{' '}
            <span
              className={isBalanced ? 'font-bold text-success-600' : 'font-bold text-warning-600'}
            >
              {formatWeight(total)}
            </span>
          </p>
          {isBalanced ? (
            <Badge variant="success">Valid</Badge>
          ) : (
            <Badge variant="warning">Sisa {formatWeight(remaining)}</Badge>
          )}
        </div>
      )}
      {status === 'active' && !isBalanced && (
        <p className="mt-1 text-xs text-surface-500">
          Lengkapi atau sesuaikan bobot hingga 100% sebelum membuka periode penilaian.
        </p>
      )}

      <div className="mt-4 space-y-3">
        {(categories ?? []).map((category) => (
          <NavigationLink
            key={category.id}
            href={`/settings/categories/${category.id}`}
            pendingIndicator
            className="block"
          >
            <Card className="transition-colors hover:bg-surface-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-surface-900">{category.name}</p>
                  <p className="text-sm text-surface-500">
                    {category.detail?.filter((detail) => detail.is_active).length ?? 0}/
                    {category.detail?.length ?? 0} detail aktif
                  </p>
                </div>
                <Badge variant={category.is_active ? 'info' : 'muted'}>
                  {category.is_active ? formatWeight(Number(category.weight)) : 'Diarsipkan'}
                </Badge>
              </div>
            </Card>
          </NavigationLink>
        ))}
        {(categories ?? []).length === 0 && (
          <p className="py-6 text-center text-sm text-surface-500">
            {status === 'active'
              ? 'Belum ada indikator aktif. Tambahkan indikator pertama.'
              : 'Belum ada indikator yang diarsipkan.'}
          </p>
        )}
      </div>

      {status === 'active' && (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-surface-900">Tambah Indikator</h2>
          <CategoryForm activeWeightTotal={total} />
        </div>
      )}
    </div>
  );
}
