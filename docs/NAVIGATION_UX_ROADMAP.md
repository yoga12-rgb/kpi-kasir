# Navigation UX Roadmap

Dokumen ini menjadi kontrak implementasi untuk memperbaiki alur navigasi dan tombol kembali
tanpa melemahkan authorization, RLS, atau validasi server.

## Tujuan

- Pengguna kembali ke konteks asal yang masih relevan setelah membuka detail.
- Semua detail memiliki fallback kembali yang jelas jika dibuka langsung.
- Filter list dan tab pengaturan dapat dipulihkan melalui URL, browser back, dan refresh.
- CTA membawa pengguna langsung ke aksi yang dijanjikan.
- Active state navigasi tetap terlihat pada route sekunder.
- Tidak ada return URL eksternal atau open redirect.

## Milestone

### M0 - Audit dan kontrak navigasi

Status: **Selesai**

- Inventarisasi route, navigasi utama, link detail, tombol kembali, dan flow create.
- Identifikasi konteks yang hilang pada kasir, cabang, outlet, pendampingan, penilaian,
  undangan, dan pengaturan.
- Tetapkan fallback canonical untuk setiap detail.

### M1 - Contextual return dan tombol kembali

Status: **Selesai**

- Tambahkan helper return URL internal yang menolak URL eksternal, protocol-relative URL,
  backslash, dan input terlalu panjang.
- Sertakan konteks asal pada link menuju detail dari list, dashboard, leaderboard, dan
  halaman relasi.
- Gunakan komponen tombol kembali yang konsisten pada halaman detail dan create.
- Teruskan konteks asal setelah submit form cabang dan sesi pendampingan.

Acceptance criteria:

- Detail yang dibuka dari list kembali ke list dengan filter/page yang sama.
- Detail yang dibuka dari dashboard kembali ke dashboard.
- Detail yang dibuka langsung tetap kembali ke fallback canonical.
- Return URL eksternal tidak pernah dipakai.

### M2 - Preservasi state dan penyederhanaan flow

Status: **Selesai**

- Simpan filter pendampingan di query string.
- Simpan tab pengaturan pengguna di query string.
- Arahkan `Catat Pendampingan` langsung ke form baru.
- Tambahkan tombol batal pada halaman create.
- Ganti native anchor internal dengan `next/link`.
- Pertahankan konteks filter pendampingan dan profil kasir saat membuka form baru.

Acceptance criteria:

- Browser back/forward dan refresh mempertahankan filter/tab.
- CTA create membuka layar yang sesuai dalam satu aksi.
- Form create memiliki jalan keluar eksplisit.

### M3 - Active state dan terminologi

Status: **Selesai**

- Tandai `Lainnya` aktif pada route sekunder yang berada di dalam area menu.
- Seragamkan label navigasi utama menjadi `Beranda`, `Penilaian`, `Peringkat`,
  `Pendampingan`, dan `Lainnya`.
- Pertahankan label mobile yang pendek hanya jika diperlukan oleh lebar layar.

Acceptance criteria:

- Tepat satu item navigasi utama aktif pada setiap route aplikasi.
- Route settings, cabang, outlet, kasir, notifikasi, dan about memiliki active state.

### M4 - Verifikasi

Status: **Selesai secara otomatis; verifikasi authenticated operator tersisa**

- Jalankan lint, typecheck, unit test, build, dan diff check.
- Tambahkan unit test untuk validasi return URL.
- Unit test helper return URL sudah ditambahkan.
- E2E authenticated untuk contextual return, tab/filter URL, CTA, dan verifikasi manual Safari
  tetap membutuhkan akun test/perangkat.

## Guardrail

- `returnTo` hanya boleh berupa path internal yang diawali `/`.
- Jangan menaruh token, session, atau data sensitif di query string.
- `router.back()` bukan satu-satunya fallback karena halaman dapat dibuka langsung atau dari
  external referrer.
- Server tetap memvalidasi akses resource tujuan; return URL hanya mengatur UX.

## Verifikasi saat ini

- Lint: **Lulus**.
- Typecheck: **Lulus**.
- Unit test: **Lulus - 18 file, 58 test** (`npm.cmd run test`).
- Build: **Lulus** (`npm.cmd run build`, Next.js 16.3.0 Turbopack).
- Lint: **Lulus** (`npm.cmd run lint`).
- Typecheck: **Lulus** (`npm.cmd run typecheck`).
- E2E authenticated: membutuhkan kredensial test.

## Smoke Test Manual

Dengan akun test yang sesuai role, verifikasi:

1. Cari/filter daftar kasir, cabang, outlet, leaderboard, dan pendampingan; buka detail;
   tombol kembali harus mengembalikan URL filter dan halaman sebelumnya.
2. Buka detail dari dashboard dan notifikasi; tombol kembali harus kembali ke sumbernya.
3. Buka `/cashiers/<id>` atau `/mentoring/<id>` secara langsung; fallback harus menuju daftar
   canonical, bukan halaman kosong atau error.
4. Buka `/settings/users?tab=invite`, refresh, lalu gunakan browser back/forward; tab Undang
   harus tetap terpilih.
5. Dari daftar cabang dan pendampingan buka form baru, batalkan, lalu simpan data test;
   hasil create dan tombol kembali harus mempertahankan konteks asal.
6. Pastikan route `/branches`, `/cashiers`, `/outlets`, `/notifications`, `/settings`, dan
   `/about` menyorot menu `Lainnya`, sementara route utama hanya menyorot satu item.
7. Coba URL `returnTo=https://example.com` dan `returnTo=//example.com`; aplikasi harus
   menggunakan fallback internal.
