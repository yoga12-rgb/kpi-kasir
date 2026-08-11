# Roadmap: Search Tanpa Full Page Re-render

Dokumen ini adalah sumber kerja agent untuk memperbaiki search bar agar penekanan Enter hanya
memperbarui area data yang relevan. Header, bottom navigation, judul halaman, tab, form lain, dan
state client yang tidak terkait harus tetap stabil.

Agent wajib membaca dokumen ini sebelum mengubah kode dan memperbarui status, bukti pengujian,
keputusan, log, serta handoff setelah setiap milestone lulus. Jangan menandai milestone selesai
hanya berdasarkan review kode.

## 1. Identitas

| Field                         | Nilai                                             |
| ----------------------------- | ------------------------------------------------- |
| Status                        | `IN_PROGRESS`                                     |
| Baseline commit               | `947754a`                                         |
| Dibuat                        | 2026-08-11 WIB                                    |
| Milestone aktif               | SR-6                                              |
| Framework                     | Next.js App Router 16.3.0, React 19, Tailwind CSS |
| Backend                       | Supabase Auth, PostgreSQL, RLS, Route Handlers    |
| Sasaran                       | Search dan pagination daftar operasional          |
| Perubahan lokal di luar scope | `supabase/config.toml`                            |

## 2. Goals

### G-1: Tidak Ada Full Document Navigation

Menekan Enter atau tombol cari tidak boleh melakukan reload dokumen. `AppShell`, header, sidebar,
bottom navigation, dan state client di luar daftar harus tetap terpasang.

### G-2: Hanya Area Hasil Yang Pending

Selama request pencarian, hanya list dan pagination yang boleh menampilkan status pending.
`loading.tsx` satu halaman tidak boleh muncul akibat pencarian pada route yang sama.

### G-3: Hanya Data Relevan Yang Diambil Ulang

Pencarian pengguna tidak boleh mengambil ulang data role, branch, dan invite. Pencarian outlet
tidak boleh mengambil ulang detail branch, permission, atau form edit. Query server harus terbatas
pada dataset yang dicari.

### G-4: URL Tetap Dapat Dibagikan

Keyword, filter status, dan halaman tetap tercermin pada query URL. Refresh browser, back/forward,
dan membuka link langsung harus menghasilkan state daftar yang sama.

### G-5: Tidak Ada Race Condition

Request lama wajib dibatalkan atau diabaikan. Respons untuk keyword lama tidak boleh menimpa hasil
keyword terbaru.

### G-6: Authorization Tidak Berubah

Admin, manager, dan supervisor harus tetap melihat data sesuai permission dan assignment branch.
Optimasi tidak boleh memindahkan query Supabase langsung ke browser atau membocorkan service role.

### G-7: Performa Terukur

Search harus memberi feedback maksimal 100 ms dan menampilkan hasil pada target p75 maksimal 500
ms pada koneksi produksi normal. Target dapat disesuaikan hanya setelah SR-0 mencatat baseline.

## 3. Definisi Selesai

Implementasi dianggap selesai jika:

1. Tidak ada search bar sasaran yang memakai native `<form method="get">` untuk submit utama.
2. Menekan Enter tidak menghasilkan document request baru dan tidak meremount `AppShell`.
3. Header, navbar, tab aktif, focus input, dan scroll halaman tidak berubah saat search.
4. Hanya list, empty state, error state, count, dan pagination yang diperbarui.
5. Keyword baru selalu mereset pagination ke halaman pertama.
6. Pagination memperbarui URL dan data tanpa full page navigation.
7. Back/forward mengembalikan keyword, filter, page, dan hasil yang sesuai.
8. Request lama dibatalkan dengan `AbortController`.
9. Initial render tidak melakukan duplicate fetch setelah hydration.
10. Semua response API tervalidasi, terotorisasi, dan tidak menggunakan `select('*')` tanpa alasan.
11. Scope branch dan permission lulus security regression.
12. Lint, typecheck, unit test, API smoke, E2E, dan build production lulus.

## 4. Temuan Audit Baseline

### 4.1 Search Yang Melakukan Navigasi Dokumen

Search berikut memakai native `<form method="get">`:

- `src/app/(app)/cashiers/page.tsx`
- `src/app/(app)/branches/page.tsx`
- `src/app/(app)/branches/[id]/page.tsx`
- `src/app/(app)/outlets/[id]/page.tsx`
- `src/app/(app)/settings/users/page.tsx`

Submit native menyebabkan browser memuat dokumen kembali. Akibatnya `AppShell` mengambil session
dan permission lagi, `AppShellClient` remount, notification count dapat diminta ulang, dan animasi
masuk pada `src/app/(app)/template.tsx` terlihat lagi.

### 4.2 Scope Fetch Terlalu Lebar

- Halaman Kasir mengulang permission, branch scope, list, exact count, dan pemetaan avatar.
- Halaman Cabang mengulang permission, branch scope, list, dan exact count.
- Detail Cabang mengulang data branch, access check, permission, outlet list, dan form lain.
- Detail Outlet mengulang data outlet, branch scope, permission, cashier list, dan form lain.
- Halaman Pengguna menjalankan `Promise.all` untuk users, branches, dan invites walaupun `q` hanya
  memengaruhi users.
- `UserSettingsTabs` menerima ketiga tab sebagai React node dari Server Component, sehingga
  pencarian tab Pengguna tetap membangun data tab Hak Akses dan Undang.

### 4.3 Loading Boundary Terlalu Besar Untuk Search

Route sasaran memiliki `loading.tsx` yang mengganti seluruh konten halaman dengan list/detail
skeleton. Boundary tersebut benar untuk cold route navigation, tetapi terlalu luas untuk search
pada route yang sama.

### 4.4 Pola Internal Yang Sudah Benar

- `src/components/leaderboard/LeaderboardView.tsx` melakukan fetch API dan mengganti state rows.
- `src/components/invite/InviteList.tsx` mencegah submit native dan hanya memperbarui item list.
- `src/components/data-list/DataList.tsx` sudah mempunyai pemisahan initial loading dan loading
  tambahan.

Pola tersebut menjadi referensi, tetapi agent tidak boleh menyalin kekurangan seperti error
handling yang tidak terstandardisasi atau request tanpa cancellation.

## 5. Keputusan Arsitektur

1. Target akhir memakai Client Component sebagai controller search dan pagination.
2. Initial data tetap dirender server-side dan diberikan sebagai props agar first paint cepat.
3. Setelah hydration, pencarian mengambil data melalui Route Handler terotorisasi.
4. URL diperbarui melalui `window.history.replaceState` untuk search/filter dan `pushState` untuk
   pagination. API Next.js 16.3.0 menyinkronkannya dengan `useSearchParams` tanpa reload.
5. Controller yang memakai `useSearchParams` wajib berada di dalam `Suspense` boundary kecil.
6. Jangan memakai `router.refresh()` untuk search atau pagination.
7. Jangan mengambil Supabase langsung dari Client Component untuk menggantikan Route Handler.
8. Jangan mengirim service role, storage credential, atau data di luar scope branch ke browser.
9. Route Handler adalah sumber kontrak pagination/filter. Server initial loader dan client fetch
   harus memakai helper query yang sama bila memungkinkan agar hasil tidak berbeda.
10. Search submit memakai Enter/tombol, bukan fetch pada setiap karakter, kecuali UX kemudian
    secara eksplisit memilih debounce.
11. Saat refetch, pertahankan layout dan focus. Boleh mempertahankan hasil lama dengan indikator
    pending kecil; jangan mengganti seluruh halaman dengan skeleton.
12. Entity row memakai key ID stabil. Gunakan `React.memo` hanya setelah profiler membuktikan row
    mahal; jangan menambah memoization spekulatif.
13. Route-level `loading.tsx` tetap dipertahankan untuk cold navigation. Search client-side tidak
    boleh memicunya.
14. Index database hanya boleh ditambahkan setelah `EXPLAIN ANALYZE` membuktikan kebutuhan. Bila
    diperlukan, gunakan migration setelah `0056`; jangan mengedit migration lama.

## 6. Kontrak Kerja Agent

### Sebelum Milestone

1. Baca `AGENTS.md`, `docs/DEVELOPER_GUIDE.md`, dokumen ini, dan dokumentasi Next.js lokal terkait
   `Form`, `useSearchParams`, native History API, Suspense, serta template.
2. Jalankan `git status --short` dan pertahankan perubahan user yang tidak terkait.
3. Catat commit awal dan migration terbaru.
4. Hanya satu milestone boleh berstatus `IN_PROGRESS`.
5. Ukur perilaku sebelum mengubah kode; jangan mengandalkan kesan visual saja.

### Setelah Milestone

1. Jalankan test gate milestone dan regression gate minimum.
2. Jalankan `git diff --check` dan `git status --short`.
3. Catat file, keputusan, hasil test, metrik, blocker, dan risiko tersisa.
4. Ubah status menjadi `COMPLETE` hanya jika acceptance criteria dan test gate lulus.
5. Perbarui `Milestone aktif`, tabel bukti, handoff, dan log sebelum mulai milestone berikutnya.

## 7. Urutan Milestone

| ID   | Tujuan                                       | Status        | Dependensi       |
| ---- | -------------------------------------------- | ------------- | ---------------- |
| SR-0 | Baseline render, network, dan query          | `COMPLETE`    | -                |
| SR-1 | Infrastruktur controller search/list bersama | `COMPLETE`    | SR-0             |
| SR-2 | Menyamakan dan mengamankan kontrak API list  | `COMPLETE`    | SR-0             |
| SR-3 | Migrasi daftar Kasir dan Cabang              | `COMPLETE`    | SR-1, SR-2       |
| SR-4 | Migrasi list pada detail Cabang dan Outlet   | `COMPLETE`    | SR-1, SR-2       |
| SR-5 | Isolasi pencarian Pengguna dan data tab      | `COMPLETE`    | SR-1, SR-2       |
| SR-6 | Regression, profiling, dan rollout           | `IN_PROGRESS` | SR-3 sampai SR-5 |

## 8. SR-0: Baseline Render Dan Network

**Tujuan:** membuktikan komponen dan request apa yang berulang ketika Enter ditekan.

**Langkah:**

1. Uji semua route sasaran pada production build lokal, desktop dan mobile.
2. Rekam React Profiler untuk submit search pertama dan kedua.
3. Rekam Network panel dan tandai document, RSC, API, avatar, notification, serta Supabase request.
4. Catat apakah focus, scroll, tab, header, navbar, dan animasi template berubah.
5. Ukur waktu submit, pending pertama, response, commit list, dan jumlah komponen yang remount.
6. Uji admin dan satu role terbatas pada route Kasir/Cabang.
7. Simpan hasil minimal tiga pengulangan per route pada tabel bukti.

**Acceptance criteria:** tersedia baseline yang dapat diulang dan setiap re-render telah
diklasifikasikan sebagai document reload, RSC render, Client Component render, atau row update.

**Test gate:** tidak ada source change selain instrumentasi terkontrol; lint/typecheck bila source
instrumentation ditambahkan.

## 9. SR-1: Infrastruktur Search Dan List

**Tujuan:** menyediakan primitive bersama tanpa memaksakan satu komponen visual untuk semua route.

**Komponen/helper yang disarankan:**

- `src/components/search/SearchController.tsx`
- `src/components/search/SearchField.tsx`
- `src/components/search/ClientPagination.tsx`
- `src/lib/client/url-search-state.ts`
- `src/lib/client/reconcile-list.ts` bila profiler membuktikan kebutuhan

**Kontrak minimum controller:**

- menerima initial query, page, total, dan items
- submit memakai `preventDefault`
- search/filter memakai `replaceState` dan menghapus `page`
- pagination memakai `pushState`
- membaca perubahan back/forward melalui `useSearchParams`
- membatalkan request aktif sebelum request baru
- mengabaikan response setelah unmount
- membedakan `initialLoading`, `refreshing`, dan `loadingPage`
- mempertahankan hasil lama selama refresh cepat
- menyediakan error dan retry hanya pada area list
- `aria-busy` dan live status yang tidak berisik

**Acceptance criteria:** harness test membuktikan Enter tidak reload, stale response tidak dapat
menang, URL sinkron, focus tetap di input, dan hanya subtree list yang berubah.

**Test gate:** unit test URL state, AbortController/race test, component test bila setup tersedia,
lint, typecheck, dan build.

## 10. SR-2: Kontrak API List

**Tujuan:** memastikan client list mendapat data yang sama dengan initial Server Component.

**Route yang diaudit/diubah:**

- `GET /api/cashiers`
- `GET /api/branches`
- `GET /api/outlets`
- route baru `GET /api/users` atau endpoint admin yang setara

**Langkah:**

1. Ekstrak query list ke helper server per domain agar initial loader dan Route Handler tidak
   menduplikasi filter, order, scope, dan pagination.
2. Standardisasi response menjadi `items`, `page`, `pageSize`, `total`, dan `totalPages`, atau
   dokumentasikan adapter bila kompatibilitas endpoint lama harus dipertahankan.
3. Tambahkan filter status Kasir dengan perilaku admin/non-admin yang identik dengan halaman lama.
4. Pastikan response Kasir menyediakan URL proxy avatar, bukan signed credential atau object
   storage publik.
5. Pastikan Outlet list menyediakan cashier count yang saat ini ditampilkan di detail Cabang.
6. Endpoint Users wajib `requireRole(['admin'])`, validasi Zod, select kolom minimum, dan tidak
   mengembalikan token/invite data.
7. Batasi `q` maksimal 100 karakter dan escape pola `ILIKE`.
8. Pertahankan RLS serta branch assignment. Tambahkan test admin, manager, supervisor, user
   nonaktif, request tanpa session, dan scope cabang lain.
9. Jangan gunakan `createAdminClient()` untuk list biasa kecuali ada alasan keamanan yang diuji.

**Acceptance criteria:** initial server data dan API response identik untuk kombinasi query yang
sama; request tidak sah ditolak dan tidak ada data lintas cabang.

**Test gate:** API contract, security regression, typecheck, lint, dan query parity test.

## 11. SR-3: Daftar Kasir Dan Cabang

**Tujuan:** memigrasikan dua search utama dengan risiko terukur.

**Langkah Kasir:**

1. Pertahankan heading, status filter, dan search field di luar area hasil.
2. Pindahkan rows, empty/error state, count, avatar, dan pagination ke controller list Kasir.
3. Status filter admin menggunakan controller yang sama dan mereset page.
4. Pertahankan scope manager/supervisor dan format masa kerja.
5. Pastikan avatar lama tidak diunduh ulang hanya karena keyword berubah bila URL sama.

**Langkah Cabang:**

1. Pindahkan hanya cards, count, empty/error state, dan pagination ke controller list Cabang.
2. Tombol Tambah, heading, dan permission tetap stabil.
3. Pertahankan outlet count serta badge status.

**Acceptance criteria:** profiler menunjukkan AppShell, heading, search input, dan tombol page tidak
remount; hanya list/count/pagination commit saat hasil datang.

**Test gate:** E2E Enter/button/back/forward/pagination, mobile screenshot, role regression, API
test, lint, typecheck, unit test, dan build.

## 12. SR-4: Detail Cabang Dan Outlet

**Tujuan:** search child list tidak merender ulang seluruh detail dan form CRUD.

**Detail Cabang:**

- branch identity, badge, edit form, dan tambah outlet tetap stabil
- hanya outlet list/count/pagination yang fetch ulang
- mutation tambah/edit outlet harus menginvalidasi atau menyinkronkan list tanpa full refresh

**Detail Outlet:**

- outlet identity, branch link, badge, edit form, dan tambah kasir tetap stabil
- hanya cashier list/count/pagination yang fetch ulang
- mutation tambah/edit/status kasir harus menginvalidasi list dengan mekanisme eksplisit

**Keputusan mutation:** `router.refresh()` boleh tetap dipakai sementara untuk mutation di luar
search, tetapi controller wajib menyinkronkan props initial terbaru. Solusi akhir sebaiknya memakai
event/invalidation lokal agar refresh besar dapat dihapus pada roadmap terpisah.

**Acceptance criteria:** mengetik dan submit search tidak mereset input form CRUD, tidak memutar
animasi halaman, dan tidak mengambil ulang detail parent.

**Test gate:** E2E search setelah create/edit, focus/scroll test, role/branch regression, lint,
typecheck, unit test, dan build.

## 13. SR-5: Pengguna Dan Tab Pengaturan

**Tujuan:** pencarian user tidak mengambil atau merender ulang Hak Akses dan Undangan.

**Langkah:**

1. Pisahkan initial users, role permissions, dan invite menjadi data boundary terpisah.
2. Jangan menjalankan `listInvites()` atau query branches saat hanya tab Pengguna yang dibuka.
3. Tab yang belum dibuka boleh lazy-load saat pertama dipilih dan mempertahankan state setelahnya.
4. Search user memakai endpoint admin SR-2 dan hanya mengganti `UserManagementList` serta
   pagination.
5. Setelah update role/status user, perbarui item terkait atau invalidate hanya user list.
6. Switching tab tidak boleh menghapus keyword user atau me-refetch tab yang sudah stabil tanpa
   invalidation.

**Acceptance criteria:** satu search user menghasilkan tepat satu request list user; tidak ada
request invites, branches, atau role permissions sebagai efek search.

**Test gate:** network assertion E2E, admin-only API test, tab state test, mutation regression,
lint, typecheck, unit test, dan build.

## 14. SR-6: Regression Dan Rollout

**Skenario wajib:**

1. Submit kosong, whitespace, keyword valid, karakter `%`, `_`, dan `\\`.
2. Submit cepat berurutan A lalu B dengan response A lebih lambat.
3. Search pada page lebih dari satu harus kembali ke page pertama.
4. Pagination maju/mundur, browser back/forward, refresh, dan direct URL.
5. Empty state, API 400, 401, 403, 500, offline, dan retry.
6. Admin, manager, supervisor, user nonaktif, serta lintas branch.
7. Mobile keyboard Enter, focus tetap, iOS tidak auto-zoom, dan layout tidak bergeser.
8. Mutation create/edit/status lalu search ulang.
9. Cold navigation tetap memakai route skeleton; search hangat tidak memakai full-page skeleton.
10. Reduced motion dan template animation tidak terpicu oleh perubahan query client.

**Performance gate:**

- tidak ada request bertipe `document` saat search
- tidak ada remount `AppShellClient`
- maksimal satu list API request per submit
- request lama berstatus aborted saat ditimpa
- feedback pending maksimal 100 ms
- hasil p75 sesuai budget SR-0
- tidak ada duplicate fetch sesaat setelah hydration

**Regression gate minimum:**

- `npm.cmd run lint`
- `npm.cmd run typecheck`
- `npm.cmd test`
- `npm.cmd run test:api`
- `npm.cmd run test:security`
- `npm.cmd run test:e2e`
- `npm.cmd run build`
- `git diff --check`

**Rollout:** lakukan per route, dimulai Cabang, lalu Kasir, detail Cabang/Outlet, dan terakhir Users.
Pantau error API, request count, query latency, Vercel invocation, serta laporan data scope. Jangan
menggabungkan semua route dalam satu deploy tanpa bukti milestone sebelumnya.

## 15. File Map

**File utama yang kemungkinan berubah:**

- `src/app/(app)/cashiers/page.tsx`
- `src/app/(app)/branches/page.tsx`
- `src/app/(app)/branches/[id]/page.tsx`
- `src/app/(app)/outlets/[id]/page.tsx`
- `src/app/(app)/settings/users/page.tsx`
- `src/components/settings/UserSettingsTabs.tsx`
- `src/components/settings/UserManagementList.tsx`
- `src/components/ui/PaginationControls.tsx` atau komponen client baru
- `src/app/api/cashiers/route.ts`
- `src/app/api/branches/route.ts`
- `src/app/api/outlets/route.ts`
- endpoint users baru
- test unit/API/E2E terkait

**File referensi, jangan diubah tanpa kebutuhan:**

- `src/components/leaderboard/LeaderboardView.tsx`
- `src/components/invite/InviteList.tsx`
- `src/components/data-list/DataList.tsx`
- `src/components/layout/AppShell.tsx`
- `src/components/layout/AppShellClient.tsx`
- `src/app/(app)/template.tsx`

## 16. Hal Di Luar Scope

- Menghapus route-level skeleton untuk cold navigation.
- Mengubah seluruh navigasi aplikasi menjadi client-only.
- Mengganti Supabase atau App Router.
- Menghapus pagination atau mengambil semua row sekaligus.
- Menurunkan authorization/RLS demi performa.
- Mengoptimalkan mutation `router.refresh()` yang tidak berkaitan dengan search, kecuali diperlukan
  agar list tetap konsisten.
- Menambah library data-fetching baru tanpa pembuktian bahwa primitive React/Next yang ada tidak
  cukup.
- Menambah index database tanpa query plan.

## 17. Bukti Milestone

| Milestone | Commit  | File                                                                  | Test/Metrik                                                               | Status        | Catatan                                                                                                                                            |
| --------- | ------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| SR-0      | -       | Audit source + Next docs                                              | Static audit                                                              | `COMPLETE`    | Native GET forms and page-level fetching confirmed; browser profiler unavailable without authenticated fixture                                     |
| SR-1      | 591430b | `use-url-list`, SearchField, ClientPagination, five client list views | lint, typecheck, 35 unit tests                                            | `COMPLETE`    | URL history, abort/stale guard, pending/error/retry, and server initial data implemented; authenticated browser profiler unavailable               |
| SR-2      | 591430b | `list-queries.ts`, list route handlers, `/api/users`                  | lint, typecheck, build, API smoke (9 protected routes)                    | `COMPLETE`    | Specific selects, pagination metadata, status scope, avatar proxy, and admin-only users endpoint implemented; DB security suite is final SR-6 gate |
| SR-3      | 591430b | `CashierListClient`, `BranchListClient`, page shells                  | lint, typecheck, build, public E2E                                        | `COMPLETE`    | Native GET forms removed; status/search/pagination stay inside client list area                                                                    |
| SR-4      | 591430b | detail list client components and page shells                         | lint, typecheck, build                                                    | `COMPLETE`    | Parent identity, edit forms, and create forms stay outside child list refetch                                                                      |
| SR-5      | 591430b | `UserListClient`, `InviteTabClient`, `UserManagementList` sync        | lint, typecheck, build                                                    | `COMPLETE`    | Users search uses one users request; branch/invite fetch is lazy on Undang tab; role permission remains mount-lazy                                 |
| SR-6      | -       | `search-rendering.spec.ts`, smoke/docs                                | unit 35 pass, lint pass, build pass, API smoke 9 pass, E2E 2 pass/10 skip | `IN_PROGRESS` | Authenticated search E2E and React Profiler/network p75 require credentials; security regression blocked because local PostgreSQL exits 137        |

## 18. Catatan Handoff Aktif

- Mulai dari SR-0 dan ukur document request serta remount, bukan hanya waktu respons.
- Root cause utama adalah native GET form dan query list yang berada di page-level Server Component.
- Mengganti ke `next/form` memperbaiki full document reload, tetapi belum cukup untuk goal hanya
  area list yang fetch dan render ulang.
- Target akhir adalah initial server data + client list API + native History API.
- Halaman Users adalah route terakhir karena datanya paling saling terkait dan berisiko.
- Pertahankan URL query, pagination, exact count, avatar proxy, role, dan branch scope.
- Jangan mengubah `supabase/config.toml`; file tersebut merupakan perubahan lokal di luar scope.
- Migration production terbaru adalah `0056`; roadmap ini tidak membutuhkan migration kecuali
  query plan membuktikan kebutuhan index.
- Current implementation status: search/list code is complete, but production sign-off is held until
  authenticated E2E, React Profiler/network metrics, and `npm.cmd run test:security` run in a prepared
  environment. Do not call this production-ready from code checks alone.

## 19. Log Perubahan Dokumen

| Waktu          | Agent | Perubahan                                                                                                                                                                                                                                                                                   |
| -------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-11 WIB | Codex | Membuat roadmap dan goals berdasarkan audit native GET search, page-level fetch, route loading boundary, dan pola client list yang sudah ada.                                                                                                                                               |
| 2026-08-11 WIB | Codex | SR-1 sampai SR-5 diimplementasikan: controller URL/abort, client list Kasir/Cabang/detail, API query helper dan `/api/users`, serta lazy tab Undang. Lint, typecheck, unit test, build, API smoke, dan public E2E dijalankan; security DB dan authenticated profiling menunggu environment. |
| 2026-08-11 WIB | Codex | Final gate diulang: typecheck, lint, 35 unit test, build, API smoke 9/9, dan E2E 2 pass/10 skip. `test:security` dicoba dengan Docker dan mode PostgreSQL-only, tetapi container lokal restart/exit 137; stack dihentikan tanpa reset atau perubahan production.                            |
| 2026-08-11 WIB | Codex | Commit `591430b` dibuat lokal. Push/deploy ditahan sampai SR-6 memiliki security regression dan authenticated E2E/profiling.                                                                                                                                                                |
