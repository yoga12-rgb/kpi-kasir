export const CONFIGURABLE_PERMISSIONS = [
  'assessment',
  'leaderboard',
  'mentoring',
  'branches.view',
  'outlets.view',
  'outlets.create',
  'outlets.update',
  'cashiers.view',
  'cashiers.create',
  'cashiers.update',
  'cashier_photos.view',
  'cashier_photos.create',
  'cashier_photos.update',
  'notifications',
] as const;

export type Permission = (typeof CONFIGURABLE_PERMISSIONS)[number];

export const PERMISSION_DETAILS: Record<Permission, { label: string; description: string }> = {
  assessment: {
    label: 'Penilaian',
    description: 'Melihat kasir dan mengisi penilaian periode berjalan',
  },
  leaderboard: {
    label: 'Leaderboard',
    description: 'Melihat ranking dan skor performa kasir',
  },
  mentoring: {
    label: 'Pendampingan',
    description: 'Melihat dan mencatat sesi pendampingan lapangan',
  },
  'branches.view': {
    label: 'Lihat cabang',
    description: 'Melihat cabang yang ditugaskan beserta outletnya',
  },
  'outlets.view': {
    label: 'Lihat outlet',
    description: 'Melihat outlet pada cabang yang ditugaskan',
  },
  'outlets.create': {
    label: 'Tambah outlet',
    description: 'Menambahkan outlet pada cabang yang ditugaskan',
  },
  'outlets.update': {
    label: 'Edit outlet',
    description: 'Mengubah nama outlet pada cabang yang ditugaskan',
  },
  'cashiers.view': {
    label: 'Lihat kasir',
    description: 'Melihat data kasir pada cabang yang ditugaskan',
  },
  'cashiers.create': {
    label: 'Tambah kasir',
    description: 'Menambahkan kasir pada outlet yang ditugaskan',
  },
  'cashiers.update': {
    label: 'Edit nama kasir',
    description: 'Mengubah nama kasir pada cabang yang ditugaskan',
  },
  'cashier_photos.view': {
    label: 'Lihat foto kasir',
    description: 'Melihat foto kasir pada cabang yang ditugaskan',
  },
  'cashier_photos.create': {
    label: 'Upload foto kasir',
    description: 'Mengunggah foto untuk kasir tanpa foto',
  },
  'cashier_photos.update': {
    label: 'Ganti foto kasir',
    description: 'Mengganti foto kasir pada cabang yang ditugaskan',
  },
  notifications: {
    label: 'Notifikasi',
    description: 'Melihat notifikasi dan pengingat aplikasi',
  },
};

export const DEFAULT_ROLE_PERMISSIONS: Record<'manager' | 'supervisor', readonly Permission[]> = {
  manager: [
    'assessment',
    'leaderboard',
    'mentoring',
    'branches.view',
    'outlets.view',
    'outlets.create',
    'outlets.update',
    'cashiers.view',
    'cashiers.create',
    'cashier_photos.view',
    'notifications',
  ],
  supervisor: [
    'assessment',
    'leaderboard',
    'mentoring',
    'branches.view',
    'outlets.view',
    'cashiers.view',
    'cashier_photos.view',
    'notifications',
  ],
};

export function hasPermission(permissions: readonly Permission[], permission: Permission) {
  return permissions.includes(permission);
}
