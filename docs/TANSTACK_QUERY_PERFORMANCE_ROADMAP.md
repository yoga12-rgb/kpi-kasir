# TanStack Query Performance Roadmap

Dokumen ini menjadi kontrak implementasi untuk menambahkan TanStack Query tanpa mengubah aturan otorisasi, RLS, atau perilaku bisnis aplikasi.

## Tujuan

- Menghindari fetch ulang untuk URL dan filter yang sama selama cache masih segar.
- Menggabungkan request identik yang berjalan bersamaan (request deduplication).
- Mempertahankan data lama saat filter atau halaman baru sedang dimuat.
- Mengganti refresh seluruh RSC tree dengan invalidasi cache yang terarah secara bertahap.
- Menjaga agar cache selalu terisolasi berdasarkan resource dan konteks query, bukan berdasarkan token atau data sensitif.

## Batasan keamanan

- TanStack Query hanya optimasi cache di browser; API route dan Supabase RLS tetap menjadi sumber kebenaran.
- Session, profil, permission, `user_branch`, keputusan akses, dan data dashboard tidak dipersist ke localStorage/IndexedDB.
- Query key tidak boleh memuat access token, email, atau PII. Query key harus memuat filter/scope yang memengaruhi hasil.
- Query client wajib dibersihkan saat logout atau pergantian akun.
- Error 4xx tidak boleh diulang otomatis. Cache tidak boleh dipakai untuk melewati 401/403.

## Temuan audit yang menjadi dasar

1. Belum ada `QueryClient` atau dependency TanStack Query.
2. `useUrlList` mengelola state, abort, dan hasil secara manual sehingga cache hilang ketika komponen unmount.
3. Leaderboard, pendampingan, notifikasi, dan detail tab kasir memiliki fetch manual serta cache lokal yang hanya hidup selama komponen aktif.
4. Banyak mutasi memanggil `router.refresh()`, yang dapat mengulang render/fetch seluruh tree. Penggantian harus dilakukan per domain setelah query key tersedia.
5. Halaman server sudah mengirim data awal. Migrasi harus memakai `initialData` atau `HydrationBoundary` agar tidak terjadi fetch ganda saat hydration.

## Milestone

### M0 - Fondasi dan guardrail

Status: **Selesai**

- Tambahkan dependency `@tanstack/react-query`.
- Tambahkan `QueryClientProvider` satu kali di root.
- Tetapkan default `staleTime`, `gcTime`, tanpa retry untuk mencegah retry 4xx yang tidak perlu, dan tanpa persistence.
- Tambahkan hook fetch bersama pada tahap berikutnya hanya jika tidak mengubah kontrak response API.

Acceptance criteria:

- `typecheck`, `lint`, dan `build` lulus.
- Tidak ada request auth atau API yang menjadi cache lintas pengguna.

### M1 - List URL dan pencarian

Status: **Selesai**

- Migrasikan `useUrlList` ke `useQuery`.
- Gunakan query key yang memuat pathname, filter yang dipakai, dan nilai filter.
- Gunakan `placeholderData: keepPreviousData` agar list tidak berkedip saat halaman/filter berubah.
- Pertahankan URL search params, abort signal, error message, pagination, dan `initialResult` dari server.

Resource:

- Kasir
- Cabang
- Outlet pada detail cabang
- Kasir pada detail outlet
- Pengguna

Acceptance criteria:

- Pindah kembali ke filter/halaman sebelumnya tidak langsung fetch ulang selama data masih fresh.
- Search dan pagination tetap memperbarui URL dan tidak mengubah hak akses.

### M2 - Detail tab dan pengaturan role

Status: **Selesai**

- Migrasikan tab detail kasir ke query per tab dengan cache per `cashierId` dan tab.
- Migrasikan role permissions ke query dan mutation dengan optimistic update serta rollback.
- Pastikan perubahan user/role tidak menggunakan cache untuk keputusan otorisasi.

Acceptance criteria:

- Kembali ke tab yang sudah dibuka tidak mengulang request dalam `staleTime`.
- Toggle permission mengembalikan state lama jika PATCH gagal.

### M3 - Query infinite untuk feed besar

Status: **Selesai**

- Migrasikan leaderboard, pendampingan, dan notifikasi ke `useInfiniteQuery`.
- Pertahankan cursor dari server, batasi jumlah page di memori, dan deduplikasi request.
- Mutasi baca notifikasi memperbarui cache item/feed dan unread count secara terarah.

Acceptance criteria:

- Load-more tidak meminta page yang sama dua kali.
- Cursor invalid atau 401/403 ditangani sebagai error, bukan loop retry.

### M4 - Invalidasi mutation per domain

Status: **Selesai untuk seluruh query yang sudah dimigrasikan**

- Buat katalog query key dan helper invalidasi.
- Ganti `router.refresh()` hanya pada mutation yang sudah memiliki query key lengkap.
- Invalidasi minimal sesuai domain: cashier, outlet/branch, assessment, mentoring, invite, notification, dan permission.

Progress saat ini:

- Role permission sudah memakai optimistic mutation, rollback, dan invalidasi query terarah.
- Notifikasi sudah memakai optimistic mutation dan invalidasi tanpa refetch semua cursor page.
- Mutation skor, periode, kasir, avatar, mutasi outlet, cabang, outlet, dan pendampingan sekarang menandai query domain terkait stale sebelum `router.refresh()`.
- Mutation pembuatan, pencabutan, dan pembuatan ulang invite sekarang memakai cache query yang sama, optimistic update/rollback untuk action list, dan invalidasi domain invite.
- Katalog key dan test prefix invalidation tersedia di `src/lib/client/query-keys.ts`.
- `router.refresh()` tetap dipertahankan pada mutation yang memperbarui data utama dari Server Component props. Ini disengaja agar heading, jumlah item, metadata, dan keputusan server tetap sinkron; invalidasi cache dilakukan lebih dulu untuk query client yang terdampak.

Acceptance criteria:

- Setelah mutation, hanya query yang terdampak yang di-refetch atau di-update.
- Tidak ada data lama yang tampil setelah mutation berhasil.

### M5 - Verifikasi performa dan produksi

Status: **Automated selesai; verifikasi operator tersisa**

- Tambahkan pengukuran cache hit/miss dan durasi query tanpa merekam token/PII.
- Uji desktop dan Safari iPhone: navigasi, back/forward, login/logout, pergantian role, offline sementara, dan 401/403.
- Jalankan typecheck, lint, unit/API contract test, build, dan smoke test.
- Update runbook deployment dan rollback.

Acceptance criteria:

- Tidak ada kebocoran data antar akun pada browser yang sama setelah logout/login.
- Build production dan smoke test lulus.
- Cache hanya meningkatkan UX; bukan menggantikan validasi server/RLS.

Progress saat ini:

- Automated gate lokal (`typecheck`, `lint`, `npm test`, `build`, dan `git diff --check`) sudah lulus.
- Playwright berhasil menemukan 36 test pada tiga project (`chromium`, `mobile`, `webkit-mobile`). Smoke test public production build pada Chromium lulus 1/1.
- E2E authenticated, pengujian lintas akun, dan verifikasi Safari iPhone fisik belum dijalankan karena membutuhkan kredensial test dan perangkat/runtime target.

## Konfigurasi awal yang disetujui

- `staleTime`: 30 detik untuk query list/detail yang berubah berkala.
- `gcTime`: 5 menit untuk cache memori browser.
- `refetchOnWindowFocus`: `false` untuk list/detail agar Safari tidak memicu fetch setiap kembali ke tab; feed notifikasi dapat memakai kebijakan khusus pada M3.
- `retry`: `false` secara global sampai fetch helper dapat membedakan network/5xx dari 4xx.
- Persistence: **tidak digunakan** pada fase awal.

## Prosedur agent

Setelah setiap milestone:

1. Baca ulang diff dan pastikan file di luar scope tidak berubah.
2. Jalankan acceptance test milestone dan catat hasilnya di dokumen ini.
3. Hanya tandai **Selesai** jika semua acceptance criteria lulus.
4. Jika gagal, kembalikan status menjadi **Terblokir** dengan error yang dapat direproduksi dan jangan melanjutkan ke milestone berikutnya.

## Verifikasi implementasi saat ini

- `npm run typecheck`: **Lulus**.
- `npm run lint`: **Lulus**.
- `npm test`: **Lulus**, 17 file dan 55 test.
- `npm run build`: **Lulus**, production build Next.js berhasil.
- `npm run test:e2e -- --list`: **Lulus**, 36 test terdeteksi pada Chromium, mobile, dan WebKit mobile.
- Smoke test production build (`public-path.spec.ts`, Chromium): **Lulus**, 1 test.
- `git diff --check`: **Lulus**.

## Catatan implementasi

- M0 dan M1 diimplementasikan pada `QueryProvider` dan `useUrlList`.
- M2 diimplementasikan pada tab detail kasir dan pengaturan role permission.
- M3 sudah diimplementasikan untuk leaderboard, pendampingan, dan notifikasi.
- M4 selesai untuk semua domain query client yang sudah tersedia; `router.refresh()` yang tersisa adalah bagian dari sinkronisasi Server Component, bukan cache invalidation yang terlewat.
- `npm install` melaporkan 5 vulnerability pada dependency tree saat instalasi (3 moderate, 1 high, 1 critical). Ini tidak berasal dari perubahan query dan perlu audit dependency terpisah sebelum production release.
