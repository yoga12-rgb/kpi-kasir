'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CheckCircle2, Info } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { Toast } from '@/components/ui/Overlay';
import { getErrorMessage } from '@/lib/utils';

const steps = ['Akun Admin', 'Struktur', 'Selesai'];

export function SetupWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: 'error' | 'info' } | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  async function createAdmin(e: React.FormEvent) {
    e.preventDefault();

    if (password !== confirmPassword) {
      setToast({ message: 'Password tidak sama', variant: 'error' });
      return;
    }

    setLoading(true);
    setToast(null);

    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setToast({ message: getErrorMessage(data.error, 'Gagal membuat admin'), variant: 'error' });
        setLoading(false);
        return;
      }

      setStep(1);
      setLoading(false);
    } catch (error) {
      setToast({ message: getErrorMessage(error), variant: 'error' });
      setLoading(false);
    }
  }

  function handleFinish() {
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm">
      {/* Step indicator */}
      <div className="mb-6 flex items-center justify-center gap-2">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                i <= step ? 'bg-primary-500 text-surface-900' : 'bg-surface-200 text-surface-500'
              }`}
            >
              {i + 1}
            </div>
            <span className={`text-xs ${i <= step ? 'text-surface-900' : 'text-surface-400'}`}>
              {label}
            </span>
            {i < steps.length - 1 && <div className="h-px w-6 bg-surface-300" />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <>
          <h2 className="mb-1 text-lg font-semibold text-surface-900">Buat Akun Administrator</h2>
          <p className="mb-6 text-sm text-surface-500">
            Akun pertama untuk mengelola aplikasi KPI Kasir Rajaklana.
          </p>
          <form onSubmit={createAdmin} className="space-y-4">
            <Input
              label="Nama Lengkap"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nama Administrator"
              required
              autoComplete="name"
            />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@rajaklana.com"
              required
              autoComplete="email"
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
            <Button type="submit" fullWidth disabled={loading}>
              {loading ? 'Membuat...' : 'Lanjut'}
            </Button>
          </form>
        </>
      )}

      {step === 1 && (
        <>
          <h2 className="mb-1 text-lg font-semibold text-surface-900">Struktur Perusahaan</h2>
          <p className="mb-6 text-sm text-surface-500">
            Setelah masuk, administrator dapat membuat Cabang, Outlet, Indikator & Detail Penilaian
            melalui menu pengaturan.
          </p>
          <div className="space-y-2.5 rounded-xl bg-primary-50 p-4 text-sm text-primary-800">
            <p className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success-600" />
              <span>Akun administrator berhasil dibuat</span>
            </p>
            <p className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success-600" />
              <span>Silakan masuk menggunakan email & password yang baru dibuat</span>
            </p>
            <p className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
              <span>Struktur Cabang/Outlet dan konfigurasi penilaian dibuat di dalam aplikasi</span>
            </p>
          </div>
          <Button onClick={handleFinish} fullWidth className="mt-6">
            Selesai — Masuk ke Aplikasi
          </Button>
        </>
      )}

      <Toast
        open={!!toast}
        message={toast?.message ?? ''}
        variant={toast?.variant ?? 'info'}
        onClose={() => setToast(null)}
      />
    </div>
  );
}
