import {
  Building2,
  Users,
  Sliders,
  ShieldCheck,
  Calendar,
  Info,
  ChevronRight,
} from 'lucide-react';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { Card } from '@/components/ui/Card';
import { NavigationLink } from '@/components/ui/NavigationLink';
import { requireUser } from '@/lib/auth/guards';
import { hasPermission, type Permission } from '@/lib/auth/permissions';
import { getRolePermissions } from '@/lib/auth/permissions-server';

export default async function MenuPage() {
  const profile = await requireUser();
  const isAdmin = profile.role === 'admin';
  const permissions = await getRolePermissions(profile.role);

  const items = [
    {
      href: '/branches',
      label: 'Cabang',
      desc: isAdmin ? 'Kelola struktur cabang' : 'Lihat cabang yang ditugaskan',
      icon: Building2,
      color: 'text-indigo-600 bg-indigo-50',
      permission: 'branches.view' as Permission,
    },
    {
      href: '/cashiers',
      label: 'Kasir',
      desc: 'Lihat kasir yang ditugaskan',
      icon: Users,
      color: 'text-blue-600 bg-blue-50',
      permission: 'cashiers.view' as Permission,
    },
    ...(isAdmin
      ? ([
          {
            href: '/settings/categories',
            label: 'Indikator Penilaian',
            desc: 'Bobot & detail penilaian',
            icon: Sliders,
            color: 'text-purple-600 bg-purple-50',
          },
          {
            href: '/settings/users',
            label: 'Akun Pengguna',
            desc: 'Kelola akun & undangan',
            icon: ShieldCheck,
            color: 'text-emerald-600 bg-emerald-50',
          },
          {
            href: '/settings/periods',
            label: 'Periode',
            desc: 'Kelola periode penilaian',
            icon: Calendar,
            color: 'text-teal-600 bg-teal-50',
          },
        ] as const)
      : []),
    {
      href: '/about',
      label: 'About',
      desc: 'Tentang aplikasi & pembuat',
      icon: Info,
      color: 'text-sky-600 bg-sky-50',
    },
  ].filter((item) => !item.permission || hasPermission(permissions, item.permission));

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold text-surface-900">Menu</h1>
      <p className="mt-0.5 text-sm text-surface-500">Semua fitur aplikasi</p>

      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavigationLink key={item.href} href={item.href} pendingIndicator className="block">
              <Card className="flex items-center gap-4 transition-colors hover:bg-surface-100">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.color}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-surface-900">{item.label}</p>
                  <p className="text-sm text-surface-500">{item.desc}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-surface-400" />
              </Card>
            </NavigationLink>
          );
        })}
      </div>

      <LogoutButton />
    </div>
  );
}
