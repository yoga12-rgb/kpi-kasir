import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { CategoryForm } from '@/components/categories/CategoryForm';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { formatWeight } from '@/lib/utils';

export default async function CategoriesPage() {
  await requireRole(['admin']);
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from('category')
    .select('*, detail(count)')
    .eq('is_active', true)
    .order('name');

  const total = (categories ?? []).reduce((acc, c) => acc + Number(c.weight), 0);

  return (
    <div className="p-4">
        <h1 className="text-xl font-bold text-surface-900">Kategori Penilaian</h1>
        <p className="mt-0.5 text-sm text-surface-500">Konfigurasi bobot & detail penilaian</p>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-surface-600">
            Total bobot:{' '}
            <span className={Math.abs(total - 100) < 0.001 ? 'font-bold text-success-600' : 'font-bold text-danger-600'}>
              {formatWeight(total)}
            </span>
          </p>
          {Math.abs(total - 100) < 0.001 ? (
            <Badge variant="success">Valid</Badge>
          ) : (
            <Badge variant="danger">Harus 100%</Badge>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {(categories ?? []).map((category) => (
            <Link key={category.id} href={`/settings/categories/${category.id}`} className="block">
              <Card className="transition-colors hover:bg-surface-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-surface-900">{category.name}</p>
                    <p className="text-sm text-surface-500">{category.detail?.[0]?.count ?? 0} detail</p>
                  </div>
                  <Badge variant="info">{formatWeight(Number(category.weight))}</Badge>
                </div>
              </Card>
            </Link>
          ))}
          {(categories ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-surface-500">
              Belum ada kategori. Tambahkan kategori pertama.
            </p>
          )}
        </div>

        <div className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-surface-900">Tambah Kategori</h2>
          <CategoryForm />
        </div>
    </div>
  );
}
