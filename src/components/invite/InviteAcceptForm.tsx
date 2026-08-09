'use client';

import { Chrome } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { getErrorMessage } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import type { UserRole } from '@/types/database';

export interface InviteAcceptFormProps {
  token: string;
  inviteName: string;
  role: UserRole;
  branchNames: string[];
  initialError?: string | null;
}

export function InviteAcceptForm({
  token,
  inviteName,
  role,
  branchNames,
  initialError = null,
}: InviteAcceptFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState(inviteName);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Password tidak sama');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, fullName, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(getErrorMessage(data.error, 'Gagal mendaftar'));
        setLoading(false);
        return;
      }

      router.push('/login?invited=1');
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const next = `/invite/${token}/google`;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });

    if (oauthError) {
      setError(getErrorMessage(oauthError));
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 rounded-xl bg-primary-50 p-4 text-sm text-primary-800">
        <p className="font-semibold">
          Anda diundang sebagai {role === 'manager' ? 'Manager' : 'Supervisor'}
        </p>
        <p className="mt-1">Nama undangan: {inviteName}</p>
        <p className="mt-1">Cabang: {branchNames.length > 0 ? branchNames.join(', ') : '-'}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email untuk Login"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nama@rajaklana.com"
          required
          autoComplete="email"
        />
        <Input
          label="Nama Lengkap"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Nama lengkap"
          required
          autoComplete="name"
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Minimal 8 karakter"
          required
          minLength={8}
          autoComplete="new-password"
        />
        <Input
          label="Ulangi Password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Ulangi password"
          required
          autoComplete="new-password"
        />
        {error && <p className="text-sm text-danger-600">{error}</p>}
        <Button type="submit" fullWidth disabled={loading}>
          {loading ? 'Mendaftar...' : 'Daftar & Masuk'}
        </Button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-surface-400">
        <div className="h-px flex-1 bg-surface-200" />
        atau
        <div className="h-px flex-1 bg-surface-200" />
      </div>

      <Button
        type="button"
        variant="secondary"
        fullWidth
        className="flex items-center justify-center gap-2"
        onClick={handleGoogleLogin}
        disabled={loading}
      >
        <Chrome className="h-4 w-4" />
        Daftar dengan Google
      </Button>
    </div>
  );
}
