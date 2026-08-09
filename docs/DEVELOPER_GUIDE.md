# Developer Guide

Dokumen ini menjelaskan kondisi aktual aplikasi KPI Kasir Rajaklana per 2026-08-09.
Gunakan dokumen ini sebagai panduan operasional developer. Jika berbeda dengan source code,
source code dan migrasi database yang sudah diterapkan menjadi sumber kebenaran.

## 1. Tujuan Produk

Aplikasi ini adalah aplikasi internal mobile-first untuk:

- menilai performa kasir per periode;
- menghitung skor kategori, skor akhir, dan skor kumulatif;
- menampilkan leaderboard lintas cabang, per cabang, atau per outlet;
- mencatat pendampingan outlet dan catatan per kasir;
- mengelola cabang, outlet, kasir, mutasi, foto, dan pengguna.

Kasir tidak memiliki akun login. Akun hanya dimiliki oleh `admin`, `manager`, dan `supervisor`.

## 2. Arsitektur Aktual

```text
Browser
  |-- Next.js App Router pages (Server Components)
  |-- Client Components untuk form, filter, modal, tab, toast, dan fetch API
  v
Next.js middleware
  |-- refresh session Supabase untuk halaman HTML
  |-- redirect halaman non-publik ke /login jika belum login
  v
Route Handlers / Server Components
  |-- requireUser / requireRole / requirePermission
  |-- validasi payload dengan Zod pada sebagian besar mutasi
  |-- createClient(): Supabase SSR client dengan cookie user
  |-- createAdminClient(): service-role client, server-only
  v
Supabase
  |-- Auth
  |-- PostgreSQL + RLS + trigger + RPC scoring/period
  |-- Storage bucket private cashier-photos
```

### Client Supabase

`src/lib/supabase/client.ts` hanya digunakan untuk login, OAuth, dan logout.

### Server Supabase

`src/lib/supabase/server.ts` mempunyai dua client:

- `createClient()`: memakai anon key dan cookie session; request tunduk pada RLS.
- `createAdminClient()`: memakai `SUPABASE_SERVICE_ROLE_KEY`; bypass RLS dan hanya boleh dipakai
  di server untuk operasi administratif yang sudah di-guard.

Jangan mengimpor `createAdminClient` ke Client Component.

## 3. Struktur Repository

```text
src/app/(app)/              halaman yang memakai AppShell
src/app/api/                Route Handlers backend
src/app/auth/callback/      callback OAuth
src/app/invite/[token]/     halaman pendaftaran lewat invite
src/components/             UI per domain dan komponen generik
src/lib/auth/               session, guards, permission
src/lib/scoring/            normalisasi dan skor murni + unit test
src/lib/storage/            signed URL dan path foto
src/lib/supabase/           client SSR/browser
src/types/                  role, entity type, dan tipe DB
supabase/migrations/        schema, RLS, trigger, RPC, storage policy
supabase/seed.sql           data contoh lokal/staging
public/                     logo, manifest, service worker
graphify-out/               knowledge graph hasil generate
```

Beberapa dokumen lama masih menyebut folder seperti `src/app/settings`, `src/lib/periods`, atau
`src/lib/validators`. Folder tersebut tidak ada pada struktur aktual; gunakan path di atas.

## 4. Route UI dan Guard

| Route                  | Fungsi                           | Guard halaman                     |
| ---------------------- | -------------------------------- | --------------------------------- |
| `/setup`               | Admin pertama                    | public, dibatasi flag `app_setup` |
| `/login`               | Login email/password atau Google | public                            |
| `/invite/[token]`      | Registrasi dari invite           | public dengan token               |
| `/dashboard`           | Ringkasan                        | `requireUser`                     |
| `/assessment`          | Daftar kasir yang dinilai        | `assessment`                      |
| `/cashiers`            | Daftar kasir                     | `cashiers.view`                   |
| `/branches`            | Daftar cabang                    | `branches.view`                   |
| `/leaderboard`         | Ranking                          | `leaderboard`                     |
| `/mentoring`           | Sesi pendampingan                | `mentoring`                       |
| `/notifications`       | Pusat notifikasi                 | `notifications`                   |
| `/menu`, `/about`      | Menu dan informasi               | `requireUser`                     |
| `/settings/categories` | Kategori/detail                  | admin                             |
| `/settings/periods`    | Buka/tutup periode               | admin                             |
| `/settings/users`      | Pengguna, invite, permission     | admin                             |

Guard UI hanya untuk pengalaman pengguna. Keamanan sebenarnya harus tetap di Route Handler dan RLS.

## 5. Role dan Permission

Role database:

- `admin`: semua cabang dan seluruh permission.
- `manager`: permission dari `role_permission`, biasanya operasional pada cabang yang ditugaskan.
- `supervisor`: permission dari `role_permission`, biasanya read-only untuk master data.

Permission yang dapat ditoggle saat ini:

`assessment`, `leaderboard`, `mentoring`, `branches.view`, `outlets.view`,
`outlets.create`, `outlets.update`, `cashiers.view`, `cashiers.create`,
`cashiers.update`, `cashier_photos.view`, `cashier_photos.create`,
`cashier_photos.update`, `notifications`.

Alur permission:

1. Page/API memanggil `requirePermission(permission)`.
2. Guard mengambil permission aktif dari `role_permission`.
3. Query data dibatasi dengan `user_branch` dan helper RLS.
4. Admin mendapat seluruh permission secara kode.

Jangan menganggap menu yang disembunyikan sebagai authorization. Endpoint dan policy harus diuji
langsung dengan user yang berbeda.

## 6. Isolasi Cabang

Hubungan akses adalah `user -> user_branch -> branch -> outlet -> cashier`.
Non-admin hanya boleh membaca cabang yang ditugaskan. Query server biasanya melakukan filter
eksplisit, sedangkan RLS menjadi lapisan kedua.

Saat menambahkan atau mengubah outlet/kasir, validasi wajib mencakup:

- permission role;
- branch yang sedang ditugaskan;
- outlet target berada pada branch yang diizinkan;
- target aktif jika operasi membutuhkan data aktif.

Setiap perubahan RLS harus diuji setidaknya dengan admin, manager cabang A, manager cabang B,
dan supervisor tanpa permission tulis.

## 7. Model Data Utama

| Tabel                                              | Peran                                          |
| -------------------------------------------------- | ---------------------------------------------- |
| `users`                                            | Profil aplikasi yang terhubung ke `auth.users` |
| `branch`                                           | Cabang organisasi                              |
| `outlet`                                           | Outlet di dalam cabang                         |
| `cashier`                                          | Kasir aktif/nonaktif dan penempatan saat ini   |
| `cashier_outlet_history`                           | Riwayat penempatan kasir                       |
| `user_branch`                                      | Penugasan user ke banyak cabang                |
| `category`, `detail`                               | Konfigurasi penilaian aktif                    |
| `category_weight_history`, `detail_config_history` | Snapshot konfigurasi per periode               |
| `period`                                           | Siklus penilaian open/closed                   |
| `assessment`                                       | Nilai detail kasir pada periode                |
| `deduction_event`                                  | Kejadian deduksi individual                    |
| `cashier_period_score`                             | Skor berjalan hasil trigger                    |
| `leaderboard_entry`                                | Snapshot periode tertutup                      |
| `cashier_cumulative_score`                         | Rata-rata skor periode tertutup                |
| `mentoring_session`, `mentoring_cashier_note`      | Catatan pendampingan                           |
| `invite`                                           | Token pendaftaran sekali pakai                 |
| `notification`                                     | Notifikasi per user                            |
| `period_log`                                       | Log buka/tutup periode                         |

Semua schema berada di `supabase/migrations/0001_init.sql` lalu dikembangkan oleh migrasi
berikutnya. Jangan mengedit migrasi lama yang sudah diterapkan; buat migrasi baru.

## 8. Aturan Perhitungan Skor

1. Skala dinormalisasi ke 0-100: `scale_value / scale_max * 100`.
2. Deduksi dimulai dari 100 dan dikurangi total poin kejadian, minimum 0.
3. Skor kategori adalah rata-rata detail yang sudah memiliki nilai.
4. Kategori tanpa detail dinilai mendapat 100.
5. Skor akhir adalah rata-rata tertimbang berdasarkan bobot kategori.
6. Trigger PostgreSQL memanggil `recalculate_cashier_period_score` setiap assessment atau event
   deduksi berubah.
7. Saat periode ditutup, `close_period` membuat snapshot leaderboard, menghitung rank, mengunci
   skor, dan memperbarui skor kumulatif.

Konfigurasi yang berubah harus berlaku mulai periode berikutnya. Ini bergantung pada snapshot
history dan pada saat ini perlu diuji lagi jika kategori/detail dinonaktifkan di tengah periode.

## 9. API Catalog

| Endpoint                                  | Method                | Guard / tujuan                            |
| ----------------------------------------- | --------------------- | ----------------------------------------- |
| `/api/setup`                              | POST                  | setup admin pertama                       |
| `/api/branches`                           | GET/POST              | lihat; tambah admin                       |
| `/api/branches/[id]`                      | PATCH/DELETE          | admin                                     |
| `/api/outlets`                            | GET/POST              | lihat/tambah sesuai permission dan branch |
| `/api/outlets/[id]`                       | PATCH/DELETE          | edit permission; delete admin             |
| `/api/cashiers`                           | GET/POST              | lihat/tambah sesuai permission            |
| `/api/cashiers/[id]`                      | PATCH/DELETE          | edit nama permission; nonaktifkan admin   |
| `/api/cashiers/[id]/transfer`             | POST                  | mutasi admin                              |
| `/api/cashiers/[id]/avatar`               | POST                  | upload/ganti foto dan signed access       |
| `/api/categories`, `/api/categories/[id]` | GET/POST/PATCH/DELETE | admin untuk mutasi                        |
| `/api/categories/[id]/details`            | GET/POST              | admin untuk mutasi                        |
| `/api/assessments`                        | POST/PATCH            | input skala/deduksi                       |
| `/api/assessments/[id]/deductions`        | POST                  | catat event deduksi                       |
| `/api/deductions/[id]`                    | DELETE                | hapus event deduksi                       |
| `/api/periods`                            | GET/POST              | daftar; buka admin                        |
| `/api/periods/[id]/close`                 | POST                  | tutup admin                               |
| `/api/periods/current`                    | GET                   | periode open                              |
| `/api/leaderboard`                        | GET                   | filter level dan mode                     |
| `/api/mentoring-sessions`                 | GET/POST              | list cursor dan catat sesi                |
| `/api/notifications`                      | GET                   | notifikasi milik user                     |
| `/api/notifications/[id]`                 | PATCH                 | tandai terbaca                            |
| `/api/invites`                            | GET/POST              | admin                                     |
| `/api/invites/[token]`                    | GET                   | baca invite dengan token                  |
| `/api/invites/accept`                     | POST                  | registrasi password                       |
| `/api/role-permissions`                   | GET/PATCH             | admin                                     |
| `/api/cron/periods`                       | GET                   | header `x-cron-secret`                    |
| `/api/cron/notifications`                 | GET                   | header `x-cron-secret`                    |

## 10. Alur Fitur Penting

### Setup dan Login

1. Root membaca `app_setup.admin_created`.
2. Jika false, user diarahkan ke `/setup`.
3. API setup membuat user Auth lewat service-role, mengubah profile menjadi admin, lalu menutup setup.
4. Login email/password memakai browser Supabase client.
5. OAuth memakai `/auth/callback` untuk menukar code menjadi session.

### Invite

1. Admin membuat invite berisi nama, role, cabang, token, dan expiry.
2. Link dibagikan manual.
3. Pendaftar dapat membuat akun password atau memakai Google OAuth jika provider aktif di Supabase.
4. Pendaftaran mengisi `users`, `user_branch`, dan menandai invite atomik dengan `used_at`.

### Foto Kasir

1. Browser memilih file maksimal 10 MB.
2. `react-easy-crop` menghasilkan JPEG 512x512 maksimal 2 MB.
3. Route memvalidasi extension dan permission, kemudian upload ke bucket private.
4. Database menyimpan path `cashier/<cashierId>/avatar.<ext>`.
5. Server membuat signed URL 1 jam saat menampilkan foto.

### Pendampingan

`GET /api/mentoring-sessions` memakai cursor berdasarkan `visited_date` dan `id`, limit 1-50,
filter cabang/outlet/tanggal, dan infinite scroll di client.

## 11. Setup Development

### Environment

Salin `.env.example` menjadi `.env.local` dan isi:

| Variable                        | Keterangan                                           |
| ------------------------------- | ---------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | URL project Supabase                                 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | key publik dengan RLS                                |
| `SUPABASE_SERVICE_ROLE_KEY`     | server-only, jangan expose                           |
| `NEXT_PUBLIC_APP_URL`           | origin aplikasi untuk link invite/OAuth              |
| `CRON_SECRET`                   | secret panjang untuk cron                            |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID`  | catatan opsional; provider dikonfigurasi di Supabase |

### Local Supabase

`supabase/config.toml` mendefinisikan API `55421`, database `55422`, Studio `55423`, dan SMTP
local `55424`. Jalankan `supabase start`, ambil key dengan `supabase status`, lalu `supabase db reset`.
`docker-compose.yml` saat ini hanya menyediakan Mailpit opsional, bukan seluruh Supabase.

### Development Server

```bash
npm run dev
```

Jika habis menjalankan `npm run build` lalu dev server menghasilkan error manifest internal, hentikan
proses Next.js lama, pastikan hanya satu `next dev` aktif, dan jalankan ulang. Bersihkan `.next`
hanya jika diperlukan dan sudah memastikan targetnya adalah cache proyek.

## 12. Database Workflow

1. Buat migrasi baru: `supabase migration new nama_perubahan`.
2. Tulis perubahan schema, grants, RLS, index, atau function pada migrasi baru.
3. Jalankan `supabase db reset` di local.
4. Jalankan seed dan uji akses lintas role/cabang.
5. Generate `src/types/database.ts` setelah schema stabil.
6. Deploy migrasi ke staging lebih dahulu.
7. Backup production sebelum `supabase db push`.

Jangan mengandalkan policy lama yang kemudian ditimpa. Audit final policy harus membaca hasil
seluruh urutan migrasi dari awal sampai akhir.

## 13. Testing dan Quality Gates

Yang tersedia saat ini:

- Vitest: normalisasi dan perhitungan kategori, 16 test lulus pada audit terakhir.
- TypeScript strict check lulus.
- ESLint lulus dengan catatan `next lint` deprecated pada Next.js 16.
- Production build lulus.

Yang belum tersedia atau belum cukup:

- folder `e2e` belum ada walaupun script/config Playwright tersedia;
- belum ada test otomatis RLS dan permission matrix;
- belum ada test integrasi trigger/RPC scoring;
- belum ada Lighthouse/performance baseline.

Minimal sebelum merge fitur database:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## 14. Deployment

Target yang direncanakan: Vercel untuk Next.js dan Supabase project terpisah untuk staging/production.

Checklist production:

1. Set semua env di Vercel; service-role key hanya server environment.
2. Konfigurasi Google provider dan redirect URL di Supabase jika OAuth akan dipakai.
3. Push migrasi dengan urutan yang sama; jangan memakai `db reset` production.
4. Pastikan private bucket `cashier-photos` dan policy sudah ada.
5. Jadwalkan `/api/cron/periods` dan `/api/cron/notifications` dengan header secret.
6. Aktifkan backup/PITR dan simpan prosedur rollback.
7. Smoke test setup/login/invite, isolasi cabang, scoring, photo, mentoring, notification, dan
   close/open period.

Deployment belum dianggap selesai sampai temuan P0 pada audit ditutup.

## 15. Troubleshooting

### `new row violates row-level security policy`

Periksa role permission, `user_branch`, branch outlet, dan migrasi RLS terakhir. Jangan langsung
menjadikan policy `using(true)` sebagai solusi; itu dapat membuka data lintas cabang.

### `next/image` hostname tidak dikonfigurasi

Tambahkan host Supabase Storage yang benar ke `next.config.mjs` dan restart server. Local Supabase
saat ini memakai host `127.0.0.1`/`localhost` port `55421`.

### OAuth `provider is not enabled`

Aktifkan Google provider di Supabase Dashboard/konfigurasi environment dan cocokkan redirect URL.
UI sudah menyediakan alur, tetapi provider tidak otomatis aktif hanya karena kode ada.

### CSS atau chunk 404 setelah perubahan

Pastikan tidak ada dua Next dev server, restart server setelah build, dan gunakan hard refresh.
Error vendor chunk biasanya berasal dari cache `.next` yang tidak sinkron dengan proses dev lama.

### Leaderboard atau list kosong

Periksa session, permission role, `user_branch`, branch/outlet aktif, periode open, dan RLS. API
leaderboard memfilter branch secara server-side sebelum mengembalikan rows.

## 16. Developer Checklist

- [ ] Perubahan perilaku punya test regresi.
- [ ] Payload API divalidasi server-side.
- [ ] Page guard, API guard, dan RLS konsisten.
- [ ] Operasi multi-tabel atomik atau punya cleanup yang jelas.
- [ ] Query list punya limit/cursor/index yang sesuai.
- [ ] Tidak ada service-role key di client atau log.
- [ ] Migrasi baru diuji pada database kosong dan database berisi data.
- [ ] Dokumentasi dan Graphify diperbarui setelah refactor besar.
- [ ] Typecheck, lint, test, dan build lulus.
