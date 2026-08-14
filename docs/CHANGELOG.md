# Changelog

## [0.2.11] - 2026-08-14

### Changed

- Merapikan halaman leaderboard: empty state konsisten, status pilihan segmen aksesibel, filter periode hanya tampil saat relevan, skeleton loading, dan penanda skor terkunci pada periode tertutup.

## [0.2.10] - 2026-08-14

### Changed

- Menampilkan jumlah kasir, tanggal, pelaksana, dan konteks cabang pada daftar serta detail pendampingan agar lebih mudah dipindai.
- Menambahkan ikon pada catatan kosong dan keterangan saat unggah bukti foto belum diaktifkan.

## [0.2.9] - 2026-08-14

### Changed

- Menambahkan ikon pada bagian Catatan Outlet dan Catatan per Kasir di detail pendampingan agar lebih mudah dipindai.

## [0.2.8] - 2026-08-14

### Added

- Menyimpan draf penilaian secara otomatis dan menggabungkan aksi simpan menjadi satu tombol dengan indikator data yang belum terkirim ke server.

## [0.2.7] - 2026-08-14

### Fixed

- Menambahkan metadata Apple khusus dan URL aset berversi agar layar sambut iOS diperbarui secara konsisten saat aplikasi dibuka dari layar utama.

## [0.2.6] - 2026-08-14

### Added

- Menambahkan layar sambut (startup screen) khusus iOS saat aplikasi dibuka dari layar utama.

## [0.2.5] - 2026-08-13

### Fixed

- Menambahkan focus trap, kunci scroll, dan label aksesibel pada Bottom Sheet agar setara dengan modal.
- Menambahkan tautan "Lewati ke konten" untuk navigasi keyboard di seluruh halaman aplikasi.
- Menandai halaman aktif pada kontrol pagination dengan `aria-current`.
- Menyeragamkan tampilan empty state pada daftar kasir, cabang, outlet, dan indikator penilaian.

## [0.2.4] - 2026-08-13

### Security

- Menambahkan proteksi origin untuk request mutasi API guna menangkal CSRF lintas-situs.
- Menerapkan batas laju (rate limit) pada seluruh endpoint mutasi data sensitif.
- Membatasi pertumbuhan store rate limiter in-memory agar tidak memicu masalah memori.
- Membatasi daftar hostname gambar pada `next/image` dan menyaring detail error internal dari log server.

### Fixed

- Menyeragamkan indikator loading daftar agar tidak berkedip saat data lama masih valid.

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
