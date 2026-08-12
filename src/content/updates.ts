export type UpdateCategory =
  | 'added'
  | 'changed'
  | 'fixed'
  | 'performance'
  | 'security';

export interface AppUpdateSection {
  category: UpdateCategory;
  label: string;
  items: string[];
}

export interface AppUpdate {
  version: string;
  date: string;
  title: string;
  summary: string;
  sections: AppUpdateSection[];
}

export const appUpdates: AppUpdate[] = [
  {
    version: '0.2.1',
    date: '2026-08-12',
    title: 'Penyederhanaan navigasi update',
    summary: 'Akses Update Aplikasi kini dipusatkan melalui halaman About agar navigasi tidak ganda.',
    sections: [
      {
        category: 'changed',
        label: 'Perubahan',
        items: ['Menghapus duplikasi menu Update Aplikasi dari halaman Lainnya.'],
      },
    ],
  },
  {
    version: '0.2.0',
    date: '2026-08-12',
    title: 'Navigasi dan transparansi update',
    summary: 'Aplikasi kini memiliki halaman khusus untuk mengikuti perkembangan fitur dan perbaikan.',
    sections: [
      {
        category: 'added',
        label: 'Fitur Baru',
        items: [
          'Halaman Update Aplikasi untuk melihat riwayat release terbaru.',
          'Tombol kembali mempertahankan konteks daftar, filter, dan halaman asal.',
        ],
      },
      {
        category: 'changed',
        label: 'Perubahan',
        items: [
          'Label navigasi utama diseragamkan menjadi Penilaian dan Peringkat.',
          'Tab pengaturan pengguna dan filter pendampingan tersimpan di URL.',
        ],
      },
      {
        category: 'performance',
        label: 'Performa',
        items: ['Navigasi Pendampingan menggunakan prefetch untuk perpindahan yang lebih responsif.'],
      },
      {
        category: 'fixed',
        label: 'Perbaikan',
        items: ['Label tombol kembali pada profil kasir kini menyesuaikan halaman asal.'],
      },
    ],
  },
];
