import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { InviteAcceptForm } from '@/components/invite/InviteAcceptForm';
import { createAdminClient } from '@/lib/supabase/server';
import { getInviteByToken, isInviteValid } from '@/lib/invites';

export const metadata: Metadata = {
  title: 'Undangan — KPI Kasir Rajaklana',
};

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const query = searchParams ? await searchParams : {};
  const invite = await getInviteByToken(token);

  if (!invite) {
    redirect('/login?error=invalid_invite');
  }

  const check = isInviteValid(invite);
  if (!check.valid) {
    redirect(`/login?error=${encodeURIComponent(check.reason ?? 'invalid_invite')}`);
  }

  const supabase = await createAdminClient();
  const { data: branches } = await supabase
    .from('branch')
    .select('id, name')
    .in('id', invite.branch_ids);

  const branchNames = (branches ?? []).map((b) => b.name);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-50 px-4">
      <div className="mb-8 flex flex-col items-center text-center">
        <BrandLogo size={112} priority className="mb-4 h-28 w-28" />
        <h1 className="text-xl font-bold text-surface-900">KPI Kasir Rajaklana</h1>
        <p className="mt-1 text-sm text-surface-500">Terima undangan & buat akun</p>
      </div>

      <InviteAcceptForm
        token={token}
        inviteName={invite.invite_name}
        role={invite.role}
        branchNames={branchNames}
        initialError={query.error === 'google_failed' ? 'Pendaftaran dengan Google gagal. Silakan coba lagi.' : null}
      />

      <p className="mt-8 text-center text-xs text-surface-400">
        Sudah punya akun?{' '}
        <Link href="/login" className="text-primary-600 hover:underline">
          Masuk
        </Link>
      </p>
    </div>
  );
}
