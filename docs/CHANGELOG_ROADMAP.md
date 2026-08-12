# Changelog dan Update Aplikasi Roadmap

Dokumen ini menjadi kontrak implementasi agar setiap agent AI dan developer memperbarui
informasi release secara konsisten.

## Tujuan

- Pengguna dapat melihat fitur baru, perubahan, perbaikan bug, dan optimasi terbaru.
- Versi aplikasi memiliki satu sumber kebenaran.
- Agent berikutnya mengetahui file yang wajib diperbarui sebelum commit.
- Dokumen developer dan halaman UI tidak menampilkan versi yang berbeda.

## Milestone

### M0 - Audit dan keputusan arsitektur

Status: **Selesai**

- `package.json` dipilih sebagai sumber nomor versi.
- `src/content/updates.ts` dipilih sebagai sumber data halaman UI.
- `docs/CHANGELOG.md` dipakai untuk riwayat release yang ramah developer.
- `AGENTS.md` menjadi aturan wajib untuk agent AI.

### M1 - Sumber data dan release contract

Status: **Selesai**

- Tambahkan tipe update yang membatasi kategori release.
- Tambahkan entri release `0.2.0` dengan tanggal dan ringkasan user-facing.
- Tambahkan script `test:changelog` untuk memeriksa versi package, UI, dan dokumentasi.

Acceptance criteria:

- Versi pada package, halaman About, halaman Update, dan changelog konsisten.
- Release tanpa heading versi pada `docs/CHANGELOG.md` gagal pada pemeriksaan changelog.

### M2 - Halaman Update Aplikasi

Status: **Selesai**

- Tambahkan route `/updates` yang hanya dapat diakses user terautentikasi.
- Tampilkan versi, tanggal, ringkasan, dan kelompok perubahan.
- Gunakan label Bahasa Indonesia yang jelas: Fitur Baru, Perubahan, Perbaikan,
  Performa, dan Keamanan.
- Tambahkan link dari Menu dan About.

Acceptance criteria:

- Halaman dapat dibuka dari menu Lainnya.
- Release terbaru tampil paling atas.
- Empty state dan struktur data tetap aman jika release bertambah.

### M3 - Guardrail agent dan verifikasi

Status: **Selesai**

- Aturan changelog ditambahkan ke `AGENTS.md`.
- Checklist release ditambahkan pada dokumen ini.
- Lint, typecheck, unit test, build, dan changelog check dijalankan.

Acceptance criteria:

- Agent yang membaca `AGENTS.md` mengetahui file changelog yang harus diperbarui.
- CI atau operator dapat menjalankan `npm run test:changelog` secara deterministik.

## Prosedur Setiap Perubahan

1. Tentukan apakah perubahan berdampak pada pengguna, operasi, security, atau kontrak developer.
2. Naikkan versi sesuai Semantic Versioning bila perubahan masuk release.
3. Tambahkan update di `src/content/updates.ts` dan `docs/CHANGELOG.md`.
4. Jalankan `npm run test:changelog`.
5. Jalankan lint, typecheck, test, dan build.
6. Pastikan file changelog ikut staged dalam commit.
7. Setelah deployment, catat SHA release di runbook bila diperlukan.

## Aturan Versi

- `MAJOR`: breaking change yang membutuhkan tindakan pengguna atau integrasi.
- `MINOR`: fitur baru yang kompatibel.
- `PATCH`: bug fix, perubahan copy, atau perbaikan kecil yang kompatibel.

## Verifikasi Manual

- Buka `/updates` pada desktop dan mobile.
- Buka Update Aplikasi dari Menu dan dari About.
- Pastikan route `/updates` menyorot menu Lainnya.
- Pastikan versi pada About dan halaman Update sama.
