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
    version: '0.2.8',
    date: '2026-08-14',
    title: 'Draf penilaian otomatis',
    summary:
      'Input penilaian kini punya satu tombol simpan dengan draf otomatis dan indikator data yang belum terkirim ke server.',
    sections: [
      {
        category: 'added',
        label: 'Fitur Baru',
        items: [
          'Aksi simpan penilaian digabung menjadi satu tombol untuk semua nilai skala.',
          'Menyimpan draf otomatis dan menandai nilai yang belum tersimpan ke server.',
        ],
      },
    ],
  },
  {
    version: '0.2.7',
    date: '2026-08-14',
    title: 'Kompatibilitas layar sambut iOS',
    summary:
      'Layar sambut iOS kini memakai metadata Apple khusus dan aset berversi agar pembaruan tampil lebih konsisten.',
    sections: [
      {
        category: 'fixed',
        label: 'Perbaikan',
        items: [
          'Memperkuat dukungan layar sambut saat aplikasi dibuka dari layar utama iPhone.',
        ],
      },
    ],
  },
  {
    version: '0.2.6',
    date: '2026-08-14',
    title: 'Layar sambut iOS',
    summary:
      'Aplikasi kini menampilkan layar sambut (splash) saat dibuka dari layar utama pada perangkat iOS.',
    sections: [
      {
        category: 'added',
        label: 'Fitur Baru',
        items: [
          'Menambahkan layar sambut khusus iOS untuk pengalaman pembukaan yang lebih mulus.',
        ],
      },
    ],
  },
  {
    version: '0.2.5',
    date: '2026-08-13',
    title: 'Peningkatan aksesibilitas dan konsistensi tampilan',
    summary:
      'Memperbaiki navigasi keyboard, fokus pada sheet, dan konsistensi state kosong di seluruh daftar.',
    sections: [
      {
        category: 'fixed',
        label: 'Perbaikan',
        items: [
          'Bottom Sheet kini memiliki focus trap, kunci scroll, dan label aksesibel.',
          'Menambahkan tautan "Lewati ke konten" untuk navigasi keyboard.',
          'Menandai halaman aktif pada pagination dengan penanda aksesibel.',
          'Menyeragamkan tampilan empty state di kasir, cabang, outlet, dan indikator penilaian.',
        ],
      },
    ],
  },
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
          'Membatasi hostname gambar dan menyaring detail error internal dari log server.',
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
