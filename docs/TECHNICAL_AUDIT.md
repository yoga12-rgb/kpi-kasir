# Technical Audit

Audit ini dilakukan pada 2026-08-09 terhadap source code, migrasi Supabase, konfigurasi,
knowledge graph, dan hasil command lokal. Audit ini tidak menggantikan penetration test pada
environment staging.

## 1. Evidence

| Check                      | Hasil                                                       |
| -------------------------- | ----------------------------------------------------------- |
| `npm run typecheck`        | Lulus                                                       |
| `npm run lint`             | Lulus dengan ESLint CLI flat config                         |
| `npm test`                 | Lulus, 10 file dan 35 test                                  |
| `npm run build`            | Lulus, Next.js 16.3.0                                       |
| `npm audit --omit=dev`     | Lulus tanpa high/critical production finding                |
| Playwright E2E             | Lulus, 8 test desktop/mobile termasuk PWA cache boundary   |
| `npm run test:api`         | Lulus, 6 protected endpoint menghasilkan JSON 401           |
| `npm run test:types`       | Lulus, generated schema dan marker tabel/RPC tervalidasi    |
| `npm run test:ops`         | Lulus, non-production dan synthetic production preflight   |
| `npm run test:security`    | Lulus, security/RLS/RPC regression deterministik            |
| `supabase db lint --local` | Lulus; tidak ada schema error yang dilaporkan               |
| Supabase migration list    | `0053` diterapkan pada Supabase lokal                        |
| Graphify                   | Diperbarui: 802 node, 1.577 edge; SQL belum terindeks penuh |

## 1.1 Status Remediasi Terbaru

Temuan P0 dan P1-1 sampai P1-5 pada audit historis di bawah ini sudah ditangani pada migration
`0026` sampai `0053`, generated database types, dan route yang terkait.
Bukti regresi terbaru mencakup privilege/RLS matrix, rollback transaction, permission dependency,
API contract smoke, dan authenticated Playwright critical path. Temuan di bawah tetap dipertahankan
sebagai jejak audit awal, bukan sebagai status code saat ini.

- Role escalation dan akun nonaktif: ditutup melalui user mutation RPC, active-user guard, dan
  regression SQL.
- Policy write permissive serta RPC state-changing: dicabut/dibatasi; mutation sensitif melewati
  route guard dan service-role client sesuai kontrak.
- Kebocoran leaderboard/cross-branch dan kolom sensitif: ditutup dengan scope branch, snapshot
  historis, grants column-level, dan test isolasi.
- Operasi multi-tabel, invite, transfer, mentoring, avatar, lifecycle, scoring, period, cron,
  notification, pagination, dan error contract: dibuat atomik/idempotent atau diberi kompensasi dan
  regression test.
- Dependency production high/critical: tidak ditemukan pada `npm audit --omit=dev` terakhir.
- P1-5 `Database = any`: ditutup dengan schema generated dari Supabase lokal, compatibility aliases,
  strict typecheck, dan `npm run test:types` sebagai regression guard. `@supabase/ssr` dan
  `@supabase/supabase-js` juga diselaraskan pada range yang kompatibel.

Residual risk yang belum dapat dibuktikan dari workspace lokal: restore backup production yang nyata,
penetration test eksternal, edge rate limit multi-instance, dan Lighthouse baseline. Prosedurnya ada
di `docs/OPERATIONS_RUNBOOK.md` dan harus dijalankan pada staging/production sebelum go-live.

## 2. Ringkasan Arsitektur

Implementasi memakai Next.js App Router dengan Server Components untuk halaman, Client Components
untuk interaksi, Route Handlers untuk API, Supabase SSR client dengan cookie session, PostgreSQL
RLS/trigger/RPC untuk data dan skor, serta private Storage untuk foto kasir.

Struktur ini cocok untuk aplikasi internal single-tenant dengan volume kecil sampai menengah.
Kekuatan utamanya adalah pemisahan domain per folder, soft delete, snapshot konfigurasi, signed URL,
dan branch-aware query pada banyak alur utama.

## 3. Findings Prioritas

Bagian ini mempertahankan snapshot temuan audit awal untuk jejak audit. Status implementasi terkini
dan bukti remediation ada di bagian 1.1; rekomendasi di bawah tidak boleh dibaca sebagai kondisi
source code saat ini tanpa membandingkannya dengan bagian tersebut.

### P0 - Blocker Produksi

#### P0-1: User dapat menaikkan role sendiri melalui RLS

Evidence: policy `users_update_own` di `supabase/migrations/0002_rls_policies.sql:146-149`
mengizinkan user mengupdate baris miliknya dengan `with check (id = auth.uid())`, tanpa membatasi
kolom. Grant update juga diberikan kepada role `authenticated` di `0004_grants.sql`.

Impact: user biasa berpotensi mengubah `role` menjadi `admin` atau mengubah `is_active` melalui
Supabase Data API langsung, walaupun UI tidak menyediakan form tersebut.

Recommendation: cabut direct update untuk role/is_active/email; gunakan update column-level hanya
untuk profil aman seperti `full_name`, atau pindahkan seluruh update profile ke endpoint server.
Tambahkan regression test yang mencoba update role sebagai manager/supervisor.

#### P0-2: Policy write permisif masih aktif pada tabel operasional

Evidence: `0007_write_policies_server_guarded.sql:49-80` membuat policy `for all ... using(true)
with check(true)` untuk `assessment`, `deduction_event`, `mentoring_session`, dan
`mentoring_cashier_note`. Migrasi `0019` hanya menghapus policy permisif untuk `cashier` dan
`cashier_outlet_history`; policy lainnya tidak dihapus.

Impact: user authenticated dapat menulis atau menghapus data lintas cabang langsung melalui Data
API, melewati permission dan guard Route Handler. RLS baca pada beberapa tabel tidak cukup untuk
menutup jalur tulis ini.

Recommendation: buat migrasi remediation yang menghapus seluruh policy server-guarded lama dan
pilih satu model secara konsisten: (a) semua write sensitif memakai service-role dari endpoint
yang sudah guard, lalu revoke write authenticated; atau (b) buat policy write branch-aware yang
juga memeriksa permission. Tambahkan SQL test lintas cabang.

#### P0-3: RPC state-changing dapat dipanggil langsung oleh authenticated

Evidence: fungsi `recalculate_cashier_period_score`, `close_period`, dan `open_period` dibuat
`security definer` dan diberi `grant execute ... to authenticated` di
`supabase/migrations/0004_grants.sql:44-46`. `close_period` dan `open_period` tidak memeriksa role
admin di dalam function. Route admin saat ini memakai `createClient()` (anon key dengan session),
bukan service-role client.

Impact: authenticated caller dapat memanggil RPC langsung dan mengubah skor, menutup periode,
atau membuka periode tanpa melewati `requireRole` dari API.

Recommendation: revoke execute dari `anon, authenticated` untuk function state-changing dan panggil
function melalui service-role client setelah API guard, atau tambahkan authorization check di dalam
function. Jangan mengandalkan route guard sebagai satu-satunya lapisan untuk RPC yang exposed.

#### P0-4: Snapshot leaderboard terbuka lintas cabang melalui RLS

Evidence: policy `le_select_auth` pada `0002_rls_policies.sql:398` menggunakan `using(true)`.
Endpoint leaderboard memang memfilter cabang, tetapi direct table access tidak mengikuti filter itu.

Impact: user authenticated dapat membaca snapshot leaderboard semua cabang melalui Data API,
berbeda dengan kontrak akses UI manager/supervisor.

Recommendation: batasi policy dengan permission leaderboard dan `user_has_branch_access(branch_id)`,
atau cabut direct table read dan kembalikan data hanya dari endpoint server yang terfilter.

### P1 - Risiko Tinggi

#### P1-1: Dependency audit menemukan 3 high severity

`npm audit --omit=dev` menemukan vulnerability pada PostCSS yang ikut di dependency Next dan pada
Sharp `0.34.5`. Perbaikan yang ditawarkan npm memerlukan upgrade Next ke 16.x dan bersifat breaking.

Recommendation: buat branch upgrade terpisah, upgrade Next/Sharp/PostCSS dengan regression test,
dan jangan menjalankan `npm audit fix --force` langsung pada branch utama.

#### P1-2: Operasi multi-tabel tidak atomik

Contoh:

- `POST /api/cashiers` membuat cashier lalu history pada request terpisah.
- transfer mengubah history, cashier, lalu history baru dan mengabaikan beberapa error.
- mentoring membuat session lalu notes pada request terpisah.
- setup membuat Auth user lalu profile dan `app_setup` tanpa cleanup jika langkah akhir gagal.
- upload foto menghapus object lama sebelum upload dan update database sukses.

Impact: data setengah jadi, riwayat hilang, object storage yatim, atau user Auth tanpa profile.

Recommendation: gunakan RPC transaction untuk operasi multi-tabel atau implementasikan kompensasi
yang eksplisit. Untuk foto, upload object baru -> update DB -> hapus object lama setelah sukses.

#### P1-3: Jaminan non-retroaktif scoring belum kuat saat config dinonaktifkan

`recalculate_cashier_period_score` melakukan loop pada kategori/detail aktif saat ini, walaupun
history bobot/config sudah dibuat saat periode dibuka. Menonaktifkan category/detail di tengah
periode dapat mengubah detail yang ikut dihitung.

Recommendation: recalculate berdasarkan snapshot `category_weight_history` dan
`detail_config_history` untuk periode tersebut, bukan flag aktif saat ini. Tambahkan test untuk
menonaktifkan config setelah penilaian dibuat.

#### P1-4: Cron notifikasi tidak idempotent dan urutan periode salah

`src/app/api/cron/notifications/route.ts` mengurutkan `leaderboard_entry` dengan `period_id` UUID,
bukan tanggal periode. Cron juga insert reminder/alert setiap run tanpa unique key atau deduplication.

Impact: low-score tiga periode terakhir dapat salah, dan user menerima duplikasi notifikasi.

Recommendation: join ke `period` dan order `start_date desc`; tambah idempotency key seperti
`(user_id, type, period_id, cashier_id)` atau tabel delivery log; filter user aktif; lakukan bulk
insert/upsert.

#### P1-5: Tipe Supabase masih `Database = any`

`src/types/database.ts:224-227` mendefinisikan database sebagai `any`. Type entity manual tetap
membantu autocomplete, tetapi query Supabase, relasi, kolom, dan RPC tidak diverifikasi compiler.

Recommendation: generate tipe dari database lokal/staging dan hentikan penggunaan `any` setelah
schema stabil. Type hasil relation dengan helper type kecil, bukan `as unknown as` berulang.

### P2 - Risiko Menengah

#### P2-1: E2E belum ada walaupun script Playwright tersedia

`package.json` memiliki `test:e2e` dan `playwright.config.ts`, tetapi folder `e2e` belum ada.
Belum ada automation untuk setup, invite, branch isolation, scoring, photo, period, atau mentoring.

Recommendation: mulai dari smoke test autentikasi dan role matrix, lalu tambah test workflow kritis.

#### P2-2: Pagination belum konsisten

Mentoring sudah memakai cursor/infinite scroll. Namun daftar kasir, leaderboard, branch, category,
invite, dan users masih mengambil banyak data sekaligus atau memakai limit tetap. `DataList` reusable
ada tetapi belum dipakai oleh komponen lain.

Recommendation: standar API cursor pagination dengan sort stabil, limit, `nextCursor`, dan filter;
prioritaskan cashiers, leaderboard, users, dan notifications. Tambah index sesuai query nyata.

#### P2-3: PWA service worker belum diregistrasikan

`public/sw.js` dan manifest tersedia, tetapi tidak ditemukan pemanggilan
`navigator.serviceWorker.register`. Akibatnya caching/offline app shell yang didokumentasikan
belum aktif, walaupun manifest dapat mendukung instalasi.

Recommendation: register SW dari client entry setelah load, uji update/versioning/cache invalidation,
dan jangan cache response API atau halaman private secara tidak sengaja.

#### P2-4: Setup memiliki race condition

`POST /api/setup` melakukan read `admin_created`, lalu create Auth user dan update flag secara
terpisah. Dua request bersamaan dapat sama-sama lolos pengecekan awal.

Recommendation: gunakan lock/unique database transaction atau RPC setup atomik; cleanup Auth user
jika profile/flag gagal.

#### P2-5: Upload foto hanya memvalidasi extension

Route avatar memeriksa ukuran dan extension dari nama file. Extension dan MIME dari browser dapat
dipalsukan.

Recommendation: decode/re-encode gambar di server atau validasi magic bytes, normalisasi format,
dan simpan object baru sebelum mengganti pointer database.

#### P2-6: Permukaan cron dan callback perlu hardening

Cron menerima secret dari header atau query string; query string dapat tercatat di access log.
OAuth callback membentuk origin dari `x-forwarded-host` tanpa allowlist eksplisit.

Recommendation: hanya terima header secret, gunakan constant-time comparison bila relevan, dan
gunakan allowlist origin production dari `NEXT_PUBLIC_APP_URL`.

#### P2-7: Aksesibilitas modal dan zoom

Modal belum memiliki focus trap/focus restore. Metadata viewport mengatur `maximumScale: 1` dan
`userScalable: false`, yang menghambat zoom pengguna.

Recommendation: gunakan dialog focus management dan izinkan zoom browser.

#### P2-8: Dokumentasi dan Graphify belum menjadi sumber kebenaran tunggal

Dokumen lama masih menyatakan `pnpm`, struktur folder yang tidak ada, PWA library yang belum dipakai,
dan status E2E/PWA yang lebih maju dari implementasi. Graphify sudah diregenerasi saat audit ini
dengan 802 node dan 1.577 edge, tetapi 27 file SQL belum terindeks karena `tree_sitter_sql` belum
terpasang. Dengan demikian Graphify membantu alur TypeScript, tetapi belum mencakup seluruh RLS,
grant, dan function database.

Recommendation: gunakan README dan Developer Guide ini sebagai referensi aktual, review dokumen lama
per rilis, dan pasang dependency SQL Graphify sebelum menjadikan graph sebagai peta database.

## 4. Hal yang Sudah Baik

- Middleware dan server guard memisahkan autentikasi dari permission.
- Banyak payload mutasi memakai Zod di server.
- Foto berada di private bucket dan ditampilkan lewat signed URL.
- Struktur history dan soft delete menjaga riwayat operasional.
- Snapshot bobot/detail dan tabel skor membantu konsistensi periode.
- Mentoring list sudah memakai cursor, filter tanggal, abort controller, dan infinite scroll.
- Unit scoring inti memiliki test dan hasil build/typecheck/lint saat audit lulus.
- Service-role client dipisahkan dari browser client secara file.

## 5. Roadmap Rekomendasi

### Sprint 0: Security remediation

1. Tutup P0-1 sampai P0-4 dengan migrasi RLS/grant baru.
2. Ubah route period menjadi service-role setelah guard, atau amankan function internal.
3. Tambah SQL regression test untuk direct REST/RPC sebagai setiap role.
4. Rotasi key bila pernah ada key yang masuk log/repository.

### Sprint 1: Data integrity and scoring

1. Transaction/RPC untuk create cashier, transfer, mentoring, setup, dan photo replacement.
2. Perbaiki snapshot scoring agar benar-benar memakai history periode.
3. Idempotency notification dan order berdasarkan tanggal periode.
4. Tambahkan constraints/index yang relevan setelah melihat query plan.

### Sprint 2: Type safety and testing

1. Generate `Database` type.
2. Tambahkan unit test validation/date/permission helper.
3. Tambahkan integration test migrasi, trigger, RPC, dan RLS.
4. Tambahkan Playwright smoke + branch isolation matrix.

### Sprint 3: Scale, PWA, and observability

1. Terapkan cursor pagination ke list panjang.
2. Register dan uji service worker secara aman.
3. Tambahkan error tracking, structured logs, cron health check, dan metrics.
4. Upgrade dependency pada branch terpisah dan ukur Lighthouse mobile.

## 6. Kesimpulan

Aplikasi sudah memiliki fondasi produk yang cukup lengkap dan build lokal yang sehat. Risiko terbesar
bukan pada UI, tetapi pada boundary keamanan database: policy lama yang permisif, profile update yang
memungkinkan role escalation, dan RPC state-changing yang masih exposed. Tutup empat P0 tersebut
sebelum deployment production; setelah itu fokus pada transaksi, idempotency, generated types, E2E,
dan pagination.
