export type UpdateCategory = 'added' | 'changed' | 'fixed' | 'performance' | 'security';

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
    version: '0.2.4',
    date: '2026-08-13',
    title: 'Penguatan keamanan aplikasi',
    summary:
      'Menambahkan proteksi origin, batas laju pada mutasi data, serta penguatan kebijakan keamanan.',
    sections: [
      {
        category: 'security',
        label: 'Keamanan',
        items: [
          'Menambahkan proteksi origin untuk menangkal permintaan mutasi lintas-situs.',
          'Menerapkan batas laju pada endpoint mutasi data sensitif.',
          'Memperketat Content-Security-Policy dan membatasi hostname gambar.',
          'Menyaring detail error internal agar tidak tercatat ke log server.',
        ],
      },
      {
        category: 'fixed',
        label: 'Perbaikan',
        items: [
          'Indikator loading daftar tidak lagi berkedip saat data lama masih valid.',
        ],
      },
    ],
  },
  {
    version: '0.2.3',
    date: '2026-08-13',
    title: 'Rincian indikator di leaderboard',
    summary:
      'Setiap card ranking kini dapat menampilkan nilai semua indikator dengan tampilan ringkas.',
    sections: [
      {
        category: 'added',
        label: 'Fitur Baru',
        items: [
          'Menambahkan kontrol ekspansi pada card leaderboard untuk melihat nilai setiap indikator.',
          'Menambahkan bar visual untuk membantu membandingkan nilai indikator dengan cepat.',
        ],
      },
      {
        category: 'performance',
        label: 'Performa',
        items: [
          'Rincian indikator menggunakan snapshot skor yang sama dengan skor total leaderboard.',
        ],
      },
    ],
  },
  {
    version: '0.2.2',
    date: '2026-08-12',
    title: 'Penyederhanaan login',
    summary: 'Login kembali menggunakan email dan password sampai Google OAuth siap digunakan.',
    sections: [
      {
        category: 'changed',
        label: 'Perubahan',
        items: ['Menghapus tombol login dan pendaftaran dengan Google dari UI.'],
      },
    ],
  },
  {
    version: '0.2.1',
    date: '2026-08-12',
    title: 'Penyederhanaan navigasi update',
    summary:
      'Akses Update Aplikasi kini dipusatkan melalui halaman About agar navigasi tidak ganda.',
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
    summary:
      'Aplikasi kini memiliki halaman khusus untuk mengikuti perkembangan fitur dan perbaikan.',
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
        items: [
          'Navigasi Pendampingan menggunakan prefetch untuk perpindahan yang lebih responsif.',
        ],
      },
      {
        category: 'fixed',
        label: 'Perbaikan',
        items: ['Label tombol kembali pada profil kasir kini menyesuaikan halaman asal.'],
      },
    ],
  },
];
