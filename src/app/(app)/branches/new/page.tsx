import { BranchForm } from '@/components/branches/BranchForm';
import { requireRole } from '@/lib/auth/guards';

export default async function NewBranchPage() {
  await requireRole(['admin']);

  return (
    <div className="p-4">
        <h1 className="text-xl font-bold text-surface-900">Tambah Cabang</h1>
        <p className="mt-0.5 text-sm text-surface-500">Buat cabang baru</p>
        <div className="mt-6">
          <BranchForm />
        </div>
    </div>
  );
}
