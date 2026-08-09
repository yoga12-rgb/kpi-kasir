import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { SetupWizard } from '@/components/setup/SetupWizard';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Setup — KPI Kasir Rajaklana',
};

export default async function SetupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: setup } = await supabase
    .from('app_setup')
    .select('admin_created')
    .limit(1)
    .maybeSingle();

  if (setup?.admin_created) redirect(user ? '/dashboard' : '/login');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-50 px-4">
      <div className="mb-8 flex flex-col items-center text-center">
        <BrandLogo size={112} priority className="mb-4 h-28 w-28" />
        <h1 className="text-xl font-bold text-surface-900">KPI Kasir Rajaklana</h1>
        <p className="mt-1 text-sm text-surface-500">Pengaturan awal aplikasi</p>
      </div>

      <SetupWizard />
    </div>
  );
}
