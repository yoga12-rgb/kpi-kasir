# Changelog

## [0.2.22] - 2026-08-15

### Fixed

- Memperbaiki perilaku Bottom Sheet yang memindahkan fokus dan menutup keyboard saat mengetik pada kolom pencarian (focus trap tidak lagi berjalan ulang saat isi input berubah).

## [0.2.21] - 2026-08-15

### Changed

- Menambahkan ikon mata pada kolom password untuk menampilkan/menyembunyikan isinya.
- Menyederhanakan tombol kembali menjadi tombol bulat berisi panah tanpa teks di seluruh halaman.

## [0.2.20] - 2026-08-15

### Security

- Memisahkan pembacaan outlet pada endpoint edit agar memakai client berbasis RLS (bukan service-role), sesuai prinsip least-privilege.

## [0.2.19] - 2026-08-14

### Added

- Menambahkan pencarian, filter status, cabang, dan outlet pada daftar Penilaian.
- Menambahkan pagination Penilaian agar daftar kasir besar dimuat bertahap.

### Changed

- Daftar Penilaian secara default menampilkan kasir yang masih perlu dinilai.
- Filter Pendampingan baru diterapkan sekali saat tombol Terapkan ditekan.
- Filter Peringkat kini dipertahankan pada URL; Reset juga mengembalikan periode awal.

### Performance

- Memindahkan filter Penilaian ke server agar halaman tidak lagi memuat seluruh kasir dalam satu request.

## [0.2.18] - 2026-08-14

### Changed

- Menampilkan ringkasan catatan outlet dan jumlah foto bukti pada card daftar pendampingan agar lebih informatif tanpa membuka detail.

## [0.2.17] - 2026-08-14

### Changed

- Menyederhanakan filter pendampingan menjadi satu tombol ringkas yang membuka lembar filter, agar daftar sesi langsung terlihat tanpa tumpukan kontrol.

## [0.2.16] - 2026-08-14

### Fixed

- Mengunci scroll latar belakang saat Bottom Sheet terbuka di perangkat sentuh.
- Memindahkan tombol Ekspor CSV dan Reset ke samping judul halaman peringkat agar lebih sejajar dan mudah dijangkau.

## [0.2.15] - 2026-08-14

### Fixed

- Memperbaiki bar kontrol leaderboard yang meluap secara horizontal pada layar sempit sehingga halaman tidak lagi dapat digeser ke kiri/kanan dan tombol ekspor/reset tetap tampil penuh.

## [0.2.14] - 2026-08-14

### Changed

- Bottom Sheet kini dapat ditutup dengan gesture geser ke bawah di perangkat sentuh, dan tampil sebagai modal terpusat pada layar desktop/tablet.

## [0.2.13] - 2026-08-14

### Changed

- Menyederhanakan kontrol halaman leaderboard menjadi satu baris ringkas, memindahkan pilihan cakupan dan filter lanjutan ke dalam lembar lipat agar fokus tetap pada peringkat di perangkat mobile.

## [0.2.12] - 2026-08-14

### Changed

- Mengelompokkan filter cabang/outlet leaderboard ke dalam panel "Filter lanjutan" agar halaman lebih ringkas di perangkat mobile, dengan penanda jumlah filter aktif.

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
