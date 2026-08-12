'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { Toast } from '@/components/ui/Overlay';
import { createClient } from '@/lib/supabase/client';
import { getErrorMessage } from '@/lib/utils';

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: 'error' | 'info' } | null>(null);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setToast(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setToast({ message: getErrorMessage(error), variant: 'error' });
      setLoading(false);
      return;
    }

    router.push('/dashboard');
  }

  const error = searchParams.get('error');
  const showInactive = error === 'inactive';

  return (
    <div className="w-full max-w-sm">
      {showInactive && (
        <div className="mb-4 rounded-xl bg-danger-500/10 p-3 text-sm text-danger-600">
          Akun kamu dinonaktifkan. Hubungi administrator.
        </div>
      )}
      {error === 'auth' && (
        <div className="mb-4 rounded-xl bg-danger-500/10 p-3 text-sm text-danger-600">
          Autentikasi gagal. Silakan coba lagi.
        </div>
      )}

      <form onSubmit={handleEmailLogin} className="space-y-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nama@rajaklana.com"
          required
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          autoComplete="current-password"
        />
        <Button type="submit" fullWidth disabled={loading}>
          {loading ? 'Memproses...' : 'Masuk'}
        </Button>
      </form>

      <Toast
        open={!!toast}
        message={toast?.message ?? ''}
        variant={toast?.variant ?? 'info'}
        onClose={() => setToast(null)}
      />
    </div>
  );
}

export default function LoginForm() {
  return (
    <Suspense>
      <LoginFormInner />
    </Suspense>
  );
}
