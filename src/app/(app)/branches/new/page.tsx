import { BranchForm } from '@/components/branches/BranchForm';
import { BackLink } from '@/components/navigation/BackLink';
import { requireRole } from '@/lib/auth/guards';
import { getSafeReturnTo } from '@/lib/navigation';

export default async function NewBranchPage({
  searchParams,
}: {
  searchParams?: Promise<{ returnTo?: string }>;
}) {
  await requireRole(['admin']);
  const params = await searchParams;
  const backHref = getSafeReturnTo(params?.returnTo, '/branches');

  return (
    <div className="p-4">
        <BackLink href={backHref} label="Cabang" />
        <h1 className="mt-2 text-xl font-bold text-surface-900">Tambah Cabang</h1>
        <p className="mt-0.5 text-sm text-surface-500">Buat cabang baru</p>
        <div className="mt-6">
          <BranchForm returnTo={backHref} />
        </div>
    </div>
  );
}
