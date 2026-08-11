# Roadmap: First Load, UI/UX, Fetching, dan Cache

Dokumen ini adalah sumber kerja agent untuk meningkatkan performa first load dan navigasi tanpa
menurunkan authorization, RLS, konsistensi data, atau kualitas UI. Agent wajib memperbarui status,
bukti pengujian, metrik, keputusan, dan handoff setelah setiap milestone lulus.

Roadmap ini tidak menganggap cache sebagai solusi pertama. Audit kode menunjukkan bahwa bottleneck
utama saat ini adalah query Supabase yang serial, lokasi runtime yang belum dibuktikan selaras,
Client Component global yang berat, duplicate fetch, serta kurangnya streaming pada dashboard.

## 1. Identitas

| Field                         | Nilai                                             |
| ----------------------------- | ------------------------------------------------- |
| Status                        | `IMPLEMENTED_PENDING_PRODUCTION_VALIDATION`       |
| Baseline commit               | `f159963`                                         |
| Dibuat                        | 2026-08-11 WIB                                    |
| Milestone aktif               | `PF-8`                                            |
| Framework                     | Next.js App Router 16.3.0, React 19, Tailwind CSS |
| Backend                       | Supabase Auth, PostgreSQL, RLS, Route Handlers    |
| Migration terbaru             | `0057_dashboard_snapshot.sql` (production applied) |
| Sasaran                       | First load, navigasi, fetching, cache, media      |
| Perubahan lokal di luar scope | `supabase/config.toml` (milik user, tidak diubah) |

## 2. Kesimpulan Audit

### 2.1 Apakah Cache Diperlukan?

Ya, tetapi hanya cache selektif untuk data global yang jarang berubah. Cache bukan perbaikan pertama
dan tidak boleh dipasang secara menyeluruh.

Urutan dampak yang direkomendasikan:

1. Ukur baseline produksi dan selaraskan region Vercel dengan region Supabase.
2. Hilangkan waterfall query, terutama dashboard.
3. Tampilkan shell dan bagian statis segera dengan loading boundary serta Suspense yang sempit.
4. Kurangi JavaScript global dan duplicate fetch setelah hydration.
5. Tambahkan cache lintas-request hanya untuk referensi global dengan tag invalidation.
6. Optimalkan route berat lain, gambar, dan strategi prefetch berdasarkan metrik.

### 2.2 Data Yang Boleh dan Tidak Boleh Di-cache

| Data                                     | Keputusan awal            | Syarat                                                 |
| ---------------------------------------- | ------------------------- | ------------------------------------------------------ |
| Session dan `auth.getUser()`             | Jangan lintas-request     | Harus selalu tervalidasi dari session aktif            |
| Profil user dan status aktif             | Jangan lintas-request     | Dipakai untuk authentication dan deactivation          |
| Assignment `user_branch`                 | Jangan dulu               | User-scoped dan invalidasinya sensitif                 |
| Permission untuk API/write authorization | Jangan                    | Revocation harus efektif segera                        |
| Permission untuk visibilitas menu        | Boleh secara terpisah     | Key role, TTL pendek, tag invalidation, API tetap live |
| Periode aktif untuk tampilan             | Boleh                     | TTL pendek dan invalidate saat create/close            |
| Status periode untuk menerima write      | Jangan mengandalkan cache | Mutation wajib memeriksa database live                 |
| Kategori/detail konfigurasi global       | Boleh                     | Tag per domain dan invalidate setelah mutation         |
| Snapshot periode yang sudah ditutup      | Boleh lama                | Harus benar-benar immutable                            |
| Kasir, penilaian, skor periode berjalan  | Jangan shared-cache       | Data dinamis dan branch-scoped                         |
| Notifikasi, undangan, unread count       | Jangan shared-cache       | User-specific dan berubah cepat                        |
| Dashboard agregat personal               | Jangan shared-cache       | Optimalkan RPC/query lebih dahulu                      |
| Avatar privat                            | Browser private cache     | Jangan CDN/public cache; gunakan path versioned        |
| Logo, favicon, manifest, static chunks   | Browser/CDN cache         | Asset versioned dan ukuran benar                       |

Peringatan penting: hasil query Supabase yang dipengaruhi cookie/JWT/RLS tidak boleh dibungkus
cache global tanpa key user dan invalidation yang benar. Cache poisoning antar-user lebih buruk
daripada aplikasi yang lambat.

## 3. Temuan Audit Baseline

### P0-1: Dashboard Menjalankan Query Serial Terlalu Banyak

`src/app/(app)/dashboard/page.tsx` menunggu periode dan branch scope, lalu menunggu satu per satu:

- cashier count
- dua completion count
- low score count
- top score dan bottom score
- mentoring count
- unread notification count
- dua invite count
- category weight dan detail configuration

Untuk admin dengan periode aktif, terdapat sampai 14 query data halaman setelah auth/profile.
Sebagian besar query setelah `currentPeriod` dan `branchIds` tidak saling bergantung tetapi tetap
di-`await` secara serial. Ini memperbesar network round-trip, terutama jika Vercel dan Supabase
berada di region berbeda.

### P0-2: Topologi Region Belum Dikunci atau Diukur

Tidak ditemukan `preferredRegion` atau konfigurasi region Vercel di repository. Log Vercel yang
sebelumnya dibagikan menunjukkan function pernah dieksekusi di `iad1`. Agent wajib membandingkan
ini dengan region database Supabase saat ini. Jangan menebak region atau mengubahnya tanpa bukti.

Jika database berada di Asia tetapi function berada di Amerika, 14 query serial dashboard akan
membayar latency lintas-region berkali-kali.

### P0-3: First Load Melewati Beberapa Lapisan Auth dan Fetch

Alur halaman privat saat ini:

1. `src/proxy.ts` memanggil `supabase.auth.getUser()`.
2. Server render memanggil `getCurrentUser()`, lalu query profil `users`.
3. Manager/supervisor memuat `role_permission`.
4. Setelah hydration, `AppShellClient` memanggil `/api/notifications?limit=1`.
5. Route notifikasi mengulangi auth/profile lalu mengambil satu row feed dan unread count.

React `cache()` di `src/lib/auth/session.ts` dan `permissions-server.ts` hanya melakukan deduplikasi
dalam satu server render. Ini bukan cache lintas-request dan tidak menyatukan Proxy, RSC, serta API
request yang terpisah.

### P0-4: Dashboard Tidak Memiliki Loading Boundary

Route lain memiliki beberapa `loading.tsx`, tetapi dashboard tidak. Karena seluruh data dashboard
ditunggu di satu Server Component, pengguna dapat menunggu tanpa feedback progresif setelah login
atau cold navigation. Page-wide animation baru berjalan setelah data selesai, sehingga tidak
menutup waktu tunggu server.

### P1-1: JavaScript Global Terlalu Berat

Artefak `.next` saat audit menunjukkan root, app shell, dan template dashboard mereferensikan
sekitar 907,523 byte JavaScript mentah sebelum kompresi. Angka ini harus diukur ulang lewat clean
production build pada PF-0, tetapi dependency graph-nya sudah menunjukkan dua penyebab langsung:

- `AppShellClient.tsx` mengimpor Supabase browser client hanya untuk logout. Chunk yang memuat
  Supabase sekitar 250,526 byte mentah ikut dibawa ke setiap halaman privat.
- `src/app/(app)/template.tsx` mengimpor `motion/react`. Template menambah chunk sekitar 119,626
  byte mentah dan menjalankan animasi opacity/translate/scale 180 ms pada setiap route.

Seluruh app shell juga merupakan Client Component, sehingga navigasi, logo, logout, unread state,
dan children berada di bawah boundary client yang lebih lebar daripada kebutuhan interaktifnya.

### P1-2: Fetch Notifikasi Global Mengambil Data Berlebih dan Duplikat

`AppShellClient` hanya membutuhkan `unreadCount`, tetapi memanggil endpoint feed notifikasi. Endpoint
tersebut melakukan query feed dan exact unread count. Pada dashboard, unread count juga sudah
diambil oleh Server Component, sehingga pekerjaan yang sama terjadi lagi setelah hydration.

### P1-3: Route Berat Lain Juga Memiliki Waterfall

- `assessment/page.tsx`: periode, branch scope, kasir, skor, completion, lalu avatar mapping.
- `assessment/[cashierId]/page.tsx`: cashier, access check, periode, dua snapshot, assessment,
  deduction, score, dan completion secara serial.
- `cashiers/[id]/page.tsx`: cashier, avatar, access check, periode, score, dua history, mentoring,
  dan outlet options secara serial.
- `leaderboard/page.tsx`: branch scope, branches, outlets, periods secara serial. Row leaderboard
  baru diminta dari browser setelah hydration melalui `/api/leaderboard`.
- Route mentoring mengulangi pola scope -> options -> data secara serial.

### P1-4: Prefetch Belum Menghangatkan Data Dinamis Secara Penuh

Project belum mengaktifkan `cacheComponents`. Berdasarkan dokumentasi Next.js 16 lokal, dynamic
route tanpa Cache Components tidak diprefetch penuh; dengan `loading.tsx`, yang diprefetch hanya
layout sampai loading boundary dan dynamic client cache default-nya off. `prefetch` pada semua Link
tidak menjamin data Supabase siap saat klik.

### P1-5: Query dan Payload Masih Lebih Lebar Dari Kebutuhan

`getCurrentUser()` memakai `users.select('*')`. Beberapa route assessment, period, category, dan
invite juga memakai `select('*')`. Dashboard menjalankan banyak `count: 'exact'` terpisah. Exact
count tetap diperlukan pada konteks tertentu, tetapi dashboard sebaiknya menghitung agregat dalam
satu query/RPC, bukan banyak REST round-trip.

### P2-1: Logo dan PWA Asset Belum Efisien

`public/logo.png` berukuran 698 x 698 dan 220,813 byte, tetapi dipakai sekaligus sebagai favicon,
shortcut icon, Apple icon, logo UI, serta manifest icon. Manifest mendeklarasikan 1114 x 1115,
tidak sama dengan file sebenarnya. Browser dapat mengunduh aset besar untuk icon kecil.

Service worker hanya meng-cache aset publik dan `_next/static`, sehingga boundary privasinya sudah
benar. Namun cache name statis `kpi-kasir-public-v2` dapat mempertahankan hashed chunk lama dalam
cache yang sama antar-deploy. Service worker juga tidak memberi manfaat pada kunjungan pertama.

### P2-2: Avatar Privat Sudah Di-cache, Tetapi Belum Punya Thumbnail

Avatar versioned memiliki `private, max-age=31536000, immutable`, sehingga browser tidak selalu
mengambil ulang file yang sama. Ini sudah benar. Namun `CashierAvatar` memakai `unoptimized` dan
proxy mengirim file storage asli untuk ukuran avatar kecil. Optimasi lanjutan sebaiknya menghasilkan
thumbnail versioned saat upload, bukan mengubah avatar privat menjadi public cache.

### P2-3: Belum Ada Observability Performa

Tidak ditemukan Web Vitals reporter, `Server-Timing`, performance mark, atau structured query timing.
Tanpa baseline produksi, perubahan mudah terasa cepat secara lokal tetapi tidak menyelesaikan TTFB,
LCP, atau latency database sebenarnya.

### P2-4: UI Login Menjalankan Navigasi Tambahan

Setelah login berhasil, `LoginForm` menjalankan `router.push('/dashboard')` lalu `router.refresh()`.
Agent harus mengukur apakah refresh kedua menambah RSC request atau render. Hapus hanya jika Network
panel dan regression test membuktikan session cookie tetap terbaca dengan satu navigasi.

## 4. Keputusan Arsitektur

1. Jangan cache seluruh page privat, API privat, atau navigasi melalui service worker.
2. Authorization write, status akun, branch scope, dan RLS tidak boleh bergantung pada cache stale.
3. Gunakan query paralel hanya untuk data yang benar-benar independen. Pertahankan partial-error
   behavior dengan `Promise.allSettled` atau result object yang eksplisit.
4. Solusi target dashboard adalah satu RPC/view agregat ber-scope atau maksimal tiga database
   round-trip setelah auth, bukan sekadar membungkus 14 query dengan cache.
5. RPC dashboard harus `security invoker` bila memungkinkan agar RLS dan `auth.uid()` tetap berlaku.
   Jika `security definer` tidak terhindarkan, wajib ada authorization eksplisit, fixed `search_path`,
   grant minimum, dan security regression lintas-role.
6. Project saat ini tidak memakai `cacheComponents`. Untuk cache DB non-fetch jangka pendek, gunakan
   `unstable_cache` hanya pada helper referensi global yang aman, dengan tag dan TTL. Ini keputusan
   transisi, bukan alasan mengaktifkan cache global.
7. `unstable_cache` tidak boleh membaca `cookies()` atau `headers()` di dalam cache scope. Nilai key
   harus diberikan sebagai argumen, dan hasil tidak boleh dipengaruhi session yang tidak masuk key.
8. Gunakan `revalidateTag(tag, 'max')` pada Next.js 16. Bentuk satu argumen sudah deprecated.
9. Aktivasi `cacheComponents` dan migrasi ke `use cache` harus menjadi spike terpisah. Jangan
   mengaktifkan flag dan mengubah semua route dalam deploy yang sama.
10. Loading state menjaga AppShell, header, bottom nav, ukuran layout, focus, dan scroll tetap stabil.
11. Motion global tidak boleh memperlambat first content. Gunakan CSS ringan atau micro-interaction
    lokal setelah pengukuran; patuhi `prefers-reduced-motion`.
12. Initial data penting tetap server-rendered. Jangan memindahkan semua fetching ke Client
    Component hanya untuk mendapatkan cache browser.
13. Client cache list boleh dipertimbangkan setelah server bottleneck selesai, wajib key-by-query,
    TTL pendek, dedupe in-flight, abort request, mutation invalidation, dan batas memory.

## 5. Goals

### G-1: First Feedback Cepat

Pengguna melihat shell atau feedback yang relevan maksimal 100 ms setelah klik/login, tanpa spinner
global dan tanpa header/bottom nav berubah menjadi skeleton.

### G-2: Critical Path Pendek

Dashboard tidak melakukan query independen secara serial. Target awal adalah maksimal tiga database
round-trip data dashboard setelah auth/profile, lalu target final ditetapkan dari PF-0.

### G-3: Core Web Vitals Sehat

Target produksi p75 mobile: LCP <= 2.5 s, INP <= 200 ms, dan CLS <= 0.1. TTFB serta route-specific
budget ditentukan setelah region dan baseline terukur.

### G-4: JavaScript Global Berkurang

Supabase browser SDK dan Motion tidak boleh menjadi dependency wajib setiap halaman privat bila
fungsinya dapat diselesaikan server-side atau dengan CSS. Target minimum awal adalah pengurangan
30 persen raw shared/app-shell JS dari baseline clean build.

### G-5: Cache Aman dan Dapat Di-invalidasi

Setiap cache mempunyai owner, key, TTL, tag, mutation invalidator, fallback, dan test isolasi role.
Tidak boleh ada cache tanpa dokumen konsistensi.

### G-6: Tidak Ada Regression Data atau UX

Admin, manager, supervisor, user nonaktif, dan assignment branch tetap benar. Refresh, back/forward,
mutation, notifikasi, foto privat, dan offline behavior tetap teruji.

## 6. Definisi Selesai

Implementasi dianggap selesai jika:

1. Baseline cold/warm load tercatat untuk admin dan role terbatas pada mobile serta desktop.
2. Region function dan database terbukti selaras atau keputusan pengecualiannya terdokumentasi.
3. Dashboard memenuhi query-round-trip budget dan tidak menggandakan unread fetch.
4. Dashboard menampilkan shell/stable skeleton secara progresif tanpa layout shift.
5. Shared client JS memenuhi budget PF-0 dan tidak membawa Supabase hanya untuk logout.
6. Cache matrix aktual sama dengan implementasi; semua mutation terkait menginvalidasi tag.
7. Permission revocation, deactivation, dan branch reassignment berlaku sesuai SLA keamanan.
8. Tidak ada private response di Cache Storage/service worker atau public CDN.
9. Route berat lain memenuhi budget query dan first-content masing-masing.
10. Lint, typecheck, unit, API, security, E2E, clean build, dan production smoke lulus.
11. Roadmap berisi bukti sebelum/sesudah dan handoff terbaru.

## 7. Kontrak Kerja Agent

### Sebelum Milestone

1. Baca `AGENTS.md`, `docs/DEVELOPER_GUIDE.md`, dokumen ini, dan dokumentasi Next.js lokal yang
   relevan di `node_modules/next/dist/docs`.
2. Jalankan `git status --short`; jangan mengubah atau menghapus perubahan user pada
   `supabase/config.toml`.
3. Catat commit awal, deployment ID, region function, region Supabase, dan migration terbaru.
4. Hanya satu milestone boleh `IN_PROGRESS`.
5. Simpan baseline sebelum source change. Jangan memakai hasil dev server sebagai bukti produksi.

### Setelah Milestone

1. Jalankan acceptance criteria dan test gate milestone.
2. Jalankan `git diff --check` dan `git status --short`.
3. Catat file berubah, migration, keputusan, metrik sebelum/sesudah, test, risiko, dan rollback.
4. Ubah milestone menjadi `COMPLETE` hanya setelah semua gate lulus.
5. Perbarui `Milestone aktif`, tabel bukti, log keputusan, dan handoff sebelum lanjut.
6. Jangan menggabungkan cache, perubahan RLS, dan migrasi Cache Components dalam satu milestone.

## 8. Urutan Milestone

| ID   | Tujuan                                          | Status    | Dependensi |
| ---- | ----------------------------------------------- | --------- | ---------- |
| PF-0 | Baseline, observability, dan performance budget | `IMPLEMENTED_PENDING_METRICS` | -          |
| PF-1 | Selaraskan deployment dan database region       | `IMPLEMENTED_PENDING_REDEPLOY` | PF-0       |
| PF-2 | Pendekkan critical path dashboard               | `IMPLEMENTED_PENDING_ROLE_TEST` | PF-0, PF-1 |
| PF-3 | Streaming UI dan hilangkan duplicate fetch      | `IMPLEMENTED_PENDING_AUTH_E2E` | PF-2       |
| PF-4 | Kurangi JavaScript global                       | `IMPLEMENTED_PENDING_AUTH_E2E` | PF-0       |
| PF-5 | Terapkan cache server selektif                  | `IMPLEMENTED_PENDING_WARM_CACHE_TEST` | PF-2, PF-4 |
| PF-6 | Optimalkan route berat dan client reuse         | `IMPLEMENTED_PENDING_ROLE_E2E` | PF-2, PF-5 |
| PF-7 | Optimalkan logo, avatar, dan PWA cache          | `IMPLEMENTED_PENDING_DEPLOY_SMOKE` | PF-0       |
| PF-8 | Security regression dan rollout produksi        | `BLOCKED_EXTERNAL_VALIDATION` | PF-1..PF-7 |

## 9. PF-0: Baseline dan Observability

**Tujuan:** membuktikan waktu yang habis di server, database, transfer, hydration, dan render.

**Langkah:**

1. Buat clean production build dan catat shared/app-shell/page JS raw serta compressed.
2. Uji `/login -> /dashboard`, direct `/dashboard`, `/assessment`, `/leaderboard`, dan satu detail
   kasir pada cold browser serta warm browser.
3. Gunakan network throttling mobile yang konsisten. Jalankan minimal lima sampel per skenario dan
   gunakan median serta p75, bukan satu screenshot.
4. Catat TTFB, FCP, LCP, INP, CLS, transferred JS/CSS/image, request count, dan hydration duration.
5. Tambahkan structured timing yang tidak memuat PII untuk auth, profile, permissions, dashboard
   data, dan API utama. Pertimbangkan `Server-Timing` pada Route Handler.
6. Catat jumlah Supabase round-trip dan latency setiap query dashboard.
7. Rekam React Profiler untuk AppShell, dashboard, leaderboard initial fetch, dan navigation.
8. Tetapkan budget final per route berdasarkan baseline dan target pada bagian Goals.

**Acceptance criteria:** bottleneck terukur per lapisan, dapat diulang, dan memiliki data cold/warm
untuk admin serta role terbatas.

**Test gate:** clean build, smoke production lokal, tidak ada PII/token di log, dan overhead
instrumentasi diukur.

## 10. PF-1: Region Runtime dan Database

**Tujuan:** menghilangkan latency lintas-region sebelum menambah kompleksitas cache.

**Langkah:**

1. Verifikasi region Supabase dari dashboard/project settings.
2. Verifikasi execution region Vercel dari deployment production dan function logs.
3. Ukur RTT function -> Supabase minimal 20 sampel.
4. Jika tidak selaras, pilih region Vercel yang paling dekat dengan Supabase dan mayoritas pengguna.
5. Terapkan konfigurasi region pada scope terkecil yang didukung deployment saat ini.
6. Redeploy, ulangi baseline PF-0, dan dokumentasikan dampak serta rollback.

**Acceptance criteria:** region alignment terbukti atau pengecualian disetujui dengan data latency;
tidak ada kenaikan error auth/storage.

**Test gate:** production smoke login, dashboard, CRUD ringan, avatar, OAuth callback, dan cron.

## 11. PF-2: Critical Path Dashboard

**Tujuan:** menurunkan 14 query data serial menjadi maksimal tiga round-trip setelah auth/profile.

**Langkah:**

1. Kelompokkan dependency: session/profile, periode, branch scope, lalu agregat independen.
2. Sebagai perbaikan aman pertama, mulai query independen bersamaan dan gunakan
   `Promise.allSettled` agar partial error tetap berfungsi.
3. Ukur lagi. Jika target belum tercapai, buat migration baru setelah `0056` untuk RPC
   `get_dashboard_snapshot` atau view agregat yang mengembalikan kontrak typed.
4. Hitung branch scope sekali. Hindari join/filter yang sama pada banyak count terpisah.
5. Prefer `security invoker`. Bila memakai `security definer`, ikuti aturan keamanan bagian 4.
6. Pertahankan hasil top/bottom, readiness period, undangan, mentoring, dan notifikasi yang sama.
7. Tambahkan query-plan evidence dan index hanya jika `EXPLAIN (ANALYZE, BUFFERS)` membuktikan perlu.
8. Jangan cache dashboard personalized pada milestone ini.

**Acceptance criteria:** maksimal tiga data round-trip setelah auth/profile, hasil parity semua role,
partial error tetap tampil, dan p75 server duration memenuhi budget PF-0.

**Test gate:** unit mapping, SQL/RPC test, API/security regression, role matrix E2E, lint, typecheck,
dan build.

## 12. PF-3: Streaming UI dan Duplicate Fetch

**Tujuan:** pengguna melihat halaman stabil segera sementara data sekunder menyusul.

**Langkah:**

1. Tambahkan `dashboard/loading.tsx` untuk cold navigation dengan dimensi yang sama seperti layout.
2. Pisahkan heading, periode, KPI utama, ranking, reminder, dan quick action ke boundary yang logis.
3. Gunakan Suspense dekat data lambat; jangan menjadikan header atau bottom nav sebagai fallback.
4. Hindari terlalu banyak boundary kecil yang menghasilkan pop-in acak.
5. Ganti fetch `/api/notifications?limit=1` di shell dengan kontrak unread-only atau initial server
   value plus Client Component kecil.
6. Pastikan dashboard tidak mengambil unread count dua kali.
7. Uji dan hapus `router.refresh()` setelah login bila terbukti redundan.
8. Tambahkan pending feedback pada navigation tanpa mengunci tombol global.

**Acceptance criteria:** feedback <= 100 ms, shell tidak remount, CLS <= 0.1, satu unread request
atau kurang, dan tidak ada full-page skeleton pada warm interaction.

**Test gate:** Playwright cold/warm navigation, screenshot mobile/desktop, reduced motion, offline/error
state, React Profiler, lint, typecheck, dan build.

## 13. PF-4: JavaScript Global

**Tujuan:** mengurangi biaya download, parse, dan hydration setiap halaman privat.

**Langkah:**

1. Ubah logout menjadi POST Route Handler atau Server Action yang melakukan server-side sign-out dan
   redirect. Pastikan CSRF/origin behavior benar.
2. Hapus import Supabase browser client dari global AppShell.
3. Pecah AppShell menjadi Server Component dengan Client Component kecil hanya untuk pathname,
   unread badge, atau interaksi yang benar-benar perlu.
4. Ganti page-wide Motion dengan CSS transition ringan atau hapus animasi first load. Pertahankan
   micro-interaction lokal yang terbukti berguna.
5. Audit icon imports dan Client Component boundary setelah pemisahan shell.
6. Bandingkan clean bundle dan hydration profile terhadap PF-0.

**Acceptance criteria:** Supabase SDK tidak berada dalam dependency graph halaman privat hanya karena
logout, Motion bukan dependency global, raw shared/app-shell JS turun minimal 30 persen, dan UX
navigasi tidak regresi.

**Test gate:** auth/logout/OAuth regression, bundle manifest diff, Playwright navigation, reduced
motion, lint, typecheck, unit, security, dan build.

## 14. PF-5: Cache Server Selektif

**Tujuan:** mengurangi query referensi berulang tanpa cache leakage atau authorization stale.

**Langkah:**

1. Buat cache registry berisi owner, data classification, key, TTL, tag, invalidator, dan fallback.
2. Pisahkan permission UI dari permission authorization. API/write guard tetap live.
3. Implementasikan satu kandidat lebih dahulu, misalnya current period display atau konfigurasi
   global, memakai helper server yang tidak membaca cookies di cache scope.
4. Gunakan key eksplisit dan `revalidateTag(tag, 'max')` dari mutation Route Handler.
5. Untuk perubahan yang harus terlihat segera setelah mutation, evaluasi `updateTag` atau explicit
   response state; jangan bergantung pada stale-while-revalidate tanpa memahami UX.
6. Tambahkan cache hit/miss metric tanpa mencatat isi sensitif.
7. Uji cold miss, warm hit, TTL expiry, mutation invalidation, deploy baru, dan cache failure.
8. Jangan memakai service role untuk query cached kecuali datanya global/non-sensitive, field
   allowlist ketat, dan review security menyetujui bypass RLS tersebut.
9. Buat ADR terpisah untuk `cacheComponents`/`use cache`. Jangan mengaktifkannya pada milestone ini.

**Acceptance criteria:** kandidat cache mengurangi query terukur, mutation tidak meninggalkan UI
stale di luar SLA, dan test membuktikan tidak ada hasil antar-user/branch yang tertukar.

**Test gate:** cache unit/integration test, permission revocation test, branch reassignment test,
security regression, lint, typecheck, dan clean build.

## 15. PF-6: Route Berat dan Client Reuse

**Tujuan:** menerapkan pola dashboard ke route lain berdasarkan urutan dampak.

**Urutan:**

1. Assessment detail: paralelkan snapshot, assessment, score, dan completion setelah cashier/period.
2. Cashier detail: stream profile utama lebih dahulu; history/mentoring dipisah per tab dan lazy-load
   saat tab dibuka.
3. Leaderboard: server-render atau preload first page agar row tidak menunggu hydration; pertahankan
   client fetch untuk filter/load-more.
4. Assessment list: gabungkan score/completion dengan query atau RPC terukur dan pertahankan avatar
   proxy versioned.
5. Mentoring: reuse branch scope dan paralelkan option/data yang independen.
6. Ganti `select('*')` dengan field minimum di critical path.
7. Evaluasi exact count hanya setelah query plan; jangan menghapus pagination atau correctness.
8. Client cache keyed-query boleh ditambah hanya jika repeat-navigation trace menunjukkan manfaat.

**Acceptance criteria:** setiap route mempunyai budget query/TTFB/LCP, initial content tidak menunggu
fetch browser yang tidak perlu, tab sekunder tidak memblokir profile utama, dan scope role tetap benar.

**Test gate:** parity data, race/abort test, tab lazy-load network assertion, role E2E, lint,
typecheck, API/security, dan build.

## 16. PF-7: Logo, Avatar, dan PWA

**Tujuan:** menurunkan transfer media tanpa membuka akses privat.

**Langkah:**

1. Buat favicon 16/32, Apple icon 180, dan PWA icon 192/512 dari sumber logo yang benar.
2. Perbaiki ukuran manifest agar sama dengan file dan gunakan aset terkompresi.
3. Pertahankan logo UI melalui `next/image` atau format terukur yang paling ringan.
4. Hasilkan thumbnail avatar versioned saat upload, misalnya ukuran list dan detail terpisah.
5. Simpan file original/crop sesuai kebijakan storage; proxy tetap memeriksa session dan permission.
6. Jangan mengubah header avatar menjadi `public`.
7. Version-kan service worker cache per build atau batasi cache ke icon/manifest. Pastikan chunk lama
   dibersihkan dan tidak ada navigation/API/private image yang masuk Cache Storage.
8. Uji update deploy agar tidak menimbulkan 404 stale chunk.

**Acceptance criteria:** favicon tidak mengunduh logo 220 KB, manifest valid, avatar list memakai
thumbnail, private cache tetap private, dan SW update tidak menyimpan chunk orphan tanpa batas.

**Test gate:** manifest audit, storage authorization, image visual regression, SW update E2E,
offline public-asset smoke, lint, typecheck, dan build.

## 17. PF-8: Regression dan Rollout Produksi

**Skenario wajib:**

1. Cold/warm login dan direct dashboard pada desktop/mobile.
2. Admin, manager, supervisor, user nonaktif, dan user tanpa assignment branch.
3. Permission diaktifkan/dimatikan saat cache masih warm.
4. Branch assignment diubah saat user sedang aktif.
5. Periode dibuat/ditutup dan konfigurasi kategori/detail diubah.
6. CRUD kasir/outlet, assessment, mentoring, invite, notification read, dan logout.
7. Avatar authorized/unauthorized, version lama/baru, dan cache browser.
8. Supabase lambat, query gagal sebagian, offline, API 401/403/500, dan retry.
9. Browser back/forward, repeat navigation, search, pagination, dan prefetch.
10. Deploy baru dengan service worker/cache lama.

**Performance gate:**

- dashboard data round-trip sesuai PF-2
- tidak ada duplicate unread fetch
- feedback navigasi <= 100 ms
- p75 LCP/INP/CLS memenuhi Goals
- shared/app-shell JS memenuhi PF-4
- cache hit memperbaiki latency tanpa stale authorization
- tidak ada private response pada CDN atau Cache Storage

**Regression gate minimum:**

- `npm.cmd run lint`
- `npm.cmd run typecheck`
- `npm.cmd test`
- `npm.cmd run test:api`
- `npm.cmd run test:security`
- `npm.cmd run test:types`
- `npm.cmd run test:e2e`
- `npm.cmd run build`
- `git diff --check`

**Rollout:** deploy satu milestone besar per release, gunakan production smoke dan monitoring minimal
24 jam untuk PF-1, PF-2, PF-4, serta PF-5. Siapkan rollback commit dan migration strategy sebelum
traffic dialihkan penuh.

## 18. File Map

**Critical path dan shell:**

- `src/proxy.ts`
- `src/app/(app)/layout.tsx`
- `src/app/(app)/template.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/components/layout/AppShell.tsx`
- `src/components/layout/AppShellClient.tsx`
- `src/components/auth/LoginForm.tsx`
- `src/lib/auth/session.ts`
- `src/lib/auth/permissions-server.ts`
- `src/app/api/notifications/route.ts`

**Route berat:**

- `src/app/(app)/assessment/page.tsx`
- `src/app/(app)/assessment/[cashierId]/page.tsx`
- `src/app/(app)/cashiers/[id]/page.tsx`
- `src/app/(app)/leaderboard/page.tsx`
- `src/app/api/leaderboard/route.ts`
- `src/app/(app)/mentoring/page.tsx`
- `src/app/(app)/mentoring/[id]/page.tsx`
- `src/lib/server/list-queries.ts`

**Media/PWA:**

- `src/app/layout.tsx`
- `src/components/brand/BrandLogo.tsx`
- `src/components/cashiers/CashierAvatar.tsx`
- `src/app/api/storage/cashier-avatar/route.ts`
- `src/lib/storage/cashier-avatar.ts`
- `public/manifest.webmanifest`
- `public/sw.js`
- `public/logo.png`

## 19. Hal Di Luar Scope

- Menghapus RLS atau mengganti server query dengan service role demi kecepatan.
- Cache seluruh HTML privat, API privat, notification, assessment, atau avatar di CDN.
- Mengambil semua row sekaligus untuk menghindari pagination.
- Mengganti Supabase atau Next.js tanpa benchmark dan ADR terpisah.
- Menambah Redis, React Query, atau SWR sebelum kebutuhan lintas-instance/client terbukti.
- Mengaktifkan `cacheComponents` tanpa spike kompatibilitas route, cookies, `dynamic`, dan tests.
- Menambah index tanpa query plan produksi/staging.
- Mengorbankan error state, accessibility, reduced motion, atau data freshness agar metrik terlihat baik.

## 20. Bukti Milestone

| Milestone | Commit | Deployment | Metrik sebelum/sesudah | Test | Status    | Catatan                           |
| --------- | ------ | ---------- | ---------------------- | ---- | --------- | --------------------------------- |
| PF-0 | working tree | belum deploy | Telemetry opt-in, Server-Timing debug, timing server; metrik p75 produksi belum ada | typecheck, lint, build | `IMPLEMENTED_PENDING_METRICS` | Path telemetry dinormalisasi agar tidak memuat ID/token |
| PF-1 | working tree | belum deploy | Supabase linked ke `ap-southeast-2`; `vercel.json` mengunci function ke `syd1` | `supabase db push --dry-run --linked` | `IMPLEMENTED_PENDING_REDEPLOY` | Verifikasi region log Vercel setelah deploy wajib |
| PF-2 | working tree | migration `0057` applied | Dashboard: satu RPC scoped + unread request-scoped terpisah; fallback paralel | typecheck, unit, types, build, remote migration dry-run | `IMPLEMENTED_PENDING_ROLE_TEST` | RPC security definer memiliki auth/scope eksplisit |
| PF-3 | working tree | belum deploy | Dashboard loading boundary; shell tidak browser-fetch notification; login tanpa refresh kedua | typecheck, lint, build | `IMPLEMENTED_PENDING_AUTH_E2E` | Header/bottom nav tetap di luar skeleton |
| PF-4 | working tree | belum deploy | Manifest dashboard direct entry 89,334 raw byte; SDK Supabase dan Motion tidak ada pada graph dashboard | clean build, manifest audit | `IMPLEMENTED_PENDING_AUTH_E2E` | Angka tidak dibandingkan 1:1 dengan artifact audit lama |
| PF-5 | working tree | belum deploy | Cache `period-options`, TTL 60 s, tag/invalidation terdokumentasi | typecheck, lint, build | `IMPLEMENTED_PENDING_WARM_CACHE_TEST` | Tidak ada cache shared untuk data user/branch |
| PF-6 | working tree | belum deploy | Assessment/mentoring paralel; leaderboard SSR first page; tab kasir lazy + abort | typecheck, lint, build; test Playwright ditambahkan | `IMPLEMENTED_PENDING_ROLE_E2E` | Test butuh user E2E non-production |
| PF-7 | working tree | belum deploy | Icon ukuran benar, thumbnail avatar private, SW hanya cache asset publik | unit avatar, clean build, PWA E2E pernah lulus 2 project | `IMPLEMENTED_PENDING_DEPLOY_SMOKE` | Retry PWA lokal saat Supabase dapat diakses dari runtime test |
| PF-8 | - | - | Production metrics, security SQL, role matrix belum dapat dieksekusi penuh di environment ini | unit/type/lint/build lulus; Docker/security dan auth E2E blocked | `BLOCKED_EXTERNAL_VALIDATION` | Jangan tandai production-ready sebelum checklist di bawah lulus |

## 21. Log Keputusan

| Tanggal    | Keputusan                                | Alasan                                                                 |
| ---------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| 2026-08-11 | Cache bukan milestone pertama            | Query serial dan kemungkinan region latency memberi dampak lebih besar |
| 2026-08-11 | Private data tidak di-shared-cache       | Mencegah data lintas-user/branch dan stale authorization               |
| 2026-08-11 | `unstable_cache` hanya transisi terbatas | Project belum memakai Cache Components; migrasi perlu spike terpisah   |
| 2026-08-11 | Dashboard ditargetkan RPC/agregat        | Mengurangi round-trip lebih deterministik daripada cache personalized  |
| 2026-08-11 | Avatar versioned tetap private           | Browser cache sudah bermanfaat tanpa membuka storage                   |
| 2026-08-11 | Dashboard memakai RPC `security definer` | RLS tidak dapat dijadikan satu agregat round-trip; function memeriksa `auth.uid()`, user aktif, role, dan branch scope secara eksplisit |
| 2026-08-11 | Region function dikonfigurasi `syd1`     | Linked Supabase memakai pooler `ap-southeast-2`; deployment perlu redeploy agar konfigurasi berlaku |
| 2026-08-11 | Cache global hanya periode reference     | Data allowlist global memakai TTL pendek dan invalidasi tag; authorization tetap database live |
| 2026-08-11 | SW tidak cache `_next` atau private data  | Menghindari stale chunk setelah deploy dan cache leakage antar user |
| 2026-08-11 | Detail kasir memakai endpoint tab privat | Profil utama tidak menunggu history/mutasi/mentoring; endpoint memeriksa permission dan branch lagi |
| 2026-08-11 | `cn` dipisah dari formatter tanggal      | Shell client tidak lagi menarik `date-fns` hanya untuk className |
| 2026-08-11 | Telemetry menormalisasi path dinamis     | Menghindari ID kasir atau token undangan masuk ke log Web Vitals |

## 22. Handoff dan Validasi Produksi

### Implementasi yang sudah dilakukan

1. `0057_dashboard_snapshot.sql` telah diterapkan ke Supabase production. Verifikasi dry-run linked
   pada 2026-08-11 menghasilkan `Remote database is up to date`.
2. Dashboard memakai RPC scoped sebagai critical path dan mempertahankan fallback query paralel bila
   RPC tidak tersedia atau payload tidak valid. Unread notification tetap user-scoped dan hanya
   dideduplikasi dalam satu render React.
3. App shell tidak mengimpor Supabase browser SDK untuk logout dan tidak fetch feed notification
   setelah hydration. Logout memakai Server Action; notification bell dirender dari server dengan
   Suspense yang sempit.
4. Assessment, mentoring, leaderboard, dan detail kasir dipangkas query serialnya. Data tab sekunder
   kasir dimuat hanya saat tab dibuka, request sebelumnya dibatalkan, dan endpoint ulang memeriksa
   akses cabang/permission.
5. Cache lintas-request dibatasi ke opsi periode global. Registry berada di
   `docs/CACHE_REGISTRY.md`; create/close period dan cron rollover menginvalidasi tag.
6. Avatar list memakai thumbnail private versioned; original tetap private. PWA memakai icon khusus
   dan service worker hanya menyimpan manifest/icon publik, bukan API, navigasi, avatar, atau chunk
   Next.js.
7. Observability aktif hanya bila `NEXT_PUBLIC_PERFORMANCE_TELEMETRY=true` atau
   `PERFORMANCE_DEBUG=true`. Payload tidak berisi identitas, query, token, atau path dinamis mentah.

### Bukti Verifikasi Saat Ini

- `npm.cmd run typecheck`: lulus.
- `npm.cmd run lint`: lulus.
- `npm.cmd test`: lulus, 37 test.
- `npm.cmd run test:types`: lulus.
- `npm.cmd run build`: lulus, 35 route.
- `npm.cmd run test:ops`: lulus untuk environment lokal non-production; service role tetap server-only.
- `supabase.cmd db push --dry-run --linked`: lulus; remote production database up to date.
- `git diff --check`: lulus; hanya warning normalisasi line ending Git di Windows.

### Gate yang Masih Wajib Sebelum Sign-off Production

1. Push/deploy perubahan ini agar `vercel.json` menerapkan `syd1`. Pastikan log function atau header
   `x-vercel-id` menunjukkan eksekusi region yang diharapkan, lalu bandingkan minimal 20 sampel RTT
   function ke Supabase dan cold/warm dashboard.
2. Jalankan `npm.cmd run test:ops` di Vercel dengan `OPS_ENV=production`. Nilai lokal HTTP memang
   ditolak oleh preflight production dan tidak boleh dipakai sebagai bukti deployment.
3. Jalankan `npm.cmd run test:security` setelah Docker Desktop/Supabase local sehat. Saat handoff,
   Docker daemon menolak akses sehingga SQL regression, termasuk scope RPC dashboard, belum berjalan.
4. Jalankan `npm.cmd run test:e2e` memakai akun test non-production untuk admin, manager, supervisor,
   user nonaktif, dan tanpa branch assignment. Jangan memakai akun production.
5. Jalankan PWA smoke terhadap deployment/staging. Smoke lokal saat handoff tidak bisa membuka
   `/login` karena middleware menunggu Supabase yang tidak dapat dicapai dari sandbox; proses server
   sementara sudah dihentikan. PWA E2E sebelumnya lulus desktop dan mobile sebelum retry ini.
6. Aktifkan telemetry/debug sementara, kumpulkan minimal lima cold dan warm sample desktop/mobile
   per route penting, kemudian nonaktifkan atau arahkan log ke observability terkelola. Target p75
   tetap LCP <= 2.5 s, INP <= 200 ms, CLS <= 0.1.
7. Pantau error auth, storage avatar, dashboard RPC fallback, cache period, dan service-worker update
   minimal 24 jam. Rollback aplikasi adalah commit sebelumnya; migration `0057` additive dan dapat
   dibiarkan tidak dipakai bila rollback kode diperlukan.

Jangan mengubah `supabase/config.toml` milik user. Jangan menambah cache shared lain, mengaktifkan
Cache Components, atau cache response private pada CDN/service worker sebelum semua gate di atas
memiliki bukti pengukuran dan regression test.
