import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import LoginForm from '@/components/auth/LoginForm';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Masuk — KPI Kasir Rajaklana',
};

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect('/dashboard');

  const { data: setup } = await supabase
    .from('app_setup')
    .select('admin_created')
    .limit(1)
    .maybeSingle();

  if (!setup?.admin_created) redirect('/setup');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-50 px-4">
      <div className="mb-8 flex flex-col items-center text-center">
        <BrandLogo size={112} priority className="mb-4 h-28 w-28" />
        <h1 className="text-xl font-bold text-surface-900">KPI Kasir Rajaklana</h1>
        <p className="mt-1 text-sm text-surface-500">Masuk untuk melanjutkan</p>
      </div>

      <LoginForm />
    </div>
  );
}
