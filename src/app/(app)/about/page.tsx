import Link from 'next/link';
import { Trophy, BarChart3, ClipboardCheck, Bell, Instagram, ExternalLink } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { Card } from '@/components/ui/Card';
import { requireUser } from '@/lib/auth/guards';

export default async function AboutPage() {
  await requireUser();

  return (
    <div className="p-4">
        <h1 className="text-xl font-bold text-surface-900">About</h1>
        <p className="mt-0.5 text-sm text-surface-500">Tentang aplikasi ini</p>

        <Card className="mt-4 text-center">
          <BrandLogo size={128} className="mx-auto mb-3 h-32 w-32" />
          <h2 className="text-lg font-bold text-surface-900">KPI & Ranking Kasir</h2>
          <p className="text-sm text-surface-500">Rajaklana</p>
          <p className="mt-2 text-xs text-surface-400">Versi 1.0.0</p>
          <div className="mt-4 border-t border-surface-200 pt-4">
            <p className="text-sm text-surface-600">Dibuat oleh:</p>
            <p className="mt-1 text-base font-semibold text-surface-900">Yoga Sptriana</p>
            <Link
              href="https://www.instagram.com/mang.agooy/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
            >
              <Instagram className="h-4 w-4" />
              <span>@mang.agooy — Instagram</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </Card>

        <Card className="mt-4">
          <h3 className="mb-3 text-base font-semibold text-surface-900">Fitur Utama</h3>
          <ul className="space-y-2.5 text-sm text-surface-600">
            <li className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Trophy className="h-4 w-4" />
              </div>
              <span>Penilaian & ranking performa kasir</span>
            </li>
            <li className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                <BarChart3 className="h-4 w-4" />
              </div>
              <span>Skor periode & akumulatif</span>
            </li>
            <li className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <ClipboardCheck className="h-4 w-4" />
              </div>
              <span>Sesi pendampingan lapangan</span>
            </li>
            <li className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Bell className="h-4 w-4" />
              </div>
              <span>Reminder & alert otomatis</span>
            </li>
          </ul>
        </Card>
    </div>
  );
}
