# Changelog

## [0.2.3] - 2026-08-13

### Added

- Menambahkan rincian nilai setiap indikator pada card leaderboard melalui kontrol ekspansi.
- Menambahkan bar visual agar perbandingan nilai indikator lebih cepat dipindai.

### Performance

- Mengirim snapshot indikator dari sumber skor periode yang sama tanpa fetch tambahan saat mode periode.

## [0.2.2] - 2026-08-12

### Changed

- Menonaktifkan tombol login dan pendaftaran dengan Google sampai provider OAuth dikonfigurasi.
- Alur login dan pendaftaran kembali menggunakan email dan password.

## [0.2.1] - 2026-08-12

### Changed

- Memusatkan akses Update Aplikasi melalui halaman About agar tidak tampil ganda di Menu.

## [0.2.0] - 2026-08-12

### Added

- Menambahkan halaman Update Aplikasi untuk melihat riwayat release.
- Menambahkan navigasi kontekstual agar tombol kembali mempertahankan halaman dan filter asal.

### Changed

- Menyeragamkan label navigasi menjadi Penilaian dan Peringkat.
- Tab pengguna dan filter pendampingan dapat dipulihkan melalui URL.

### Performance

- Menambahkan prefetch pada navigasi Pendampingan untuk perpindahan halaman yang lebih cepat.

### Fixed

- Label tombol kembali pada profil kasir kini menyesuaikan konteks navigasi sebelumnya.
