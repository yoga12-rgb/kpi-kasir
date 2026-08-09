# Spesifikasi Teknis — Aplikasi KPI & Ranking Kasir Rajaklana

> Dokumen ini adalah **Dokumen Spesifikasi Teknis** yang disusun mengacu pada `plan.md` dan `prd.md`.
> Status: Draft awal — selalu diperbarui mengikuti perkembangan implementasi.

---

## 1. Ringkasan Arsitektur

Aplikasi **Next.js (App Router)** sebagai frontend + backend API (route handlers / server actions), dengan **Supabase** (PostgreSQL + Auth + Realtime) sebagai backend service, di-deploy ke **Vercel**. Styling memakai **Tailwind CSS**. Aplikasi merupakan **PWA** dengan **App Shell** dan route statis (static route) agar cepat dan bisa di-install di perangkat mobile.

```
┌─────────────────────────────┐
│  Mobile / Desktop Browser   │
│  ┌───────────────────────┐  │
│  │   Next.js (App Router)│  │
│  │   - PWA App Shell     │  │
│  │   - UI Mobile-first   │  │
│  │   - Tailwind CSS      │  │
│  └──────────┬────────────┘  │
└─────────────┼───────────────┘
              │ HTTPS
      ┌───────▼────────┐
      │   Vercel       │  (Server Components / Route Handlers / Server Actions)
      └───────┬────────┘
              │ HTTPS (anonymized via service key / RLS policies)
      ┌───────▼────────┐
      │   Supabase     │
      │  PostgreSQL +  │
      │  Auth + RLS    │
      └────────────────┘
```

### Prinsip Arsitektur

1. **RLS (Row Level Security)** sebagai lapisan keamanan data utama — request dari client selalu melewati Supabase dengan user context.
2. **Server-side** untuk operasi sensitif (setup wizard, invite, close periode, perhitungan skor) via Route Handlers / Server Actions agar tidak mengekspos service key di client.
3. **Skor dihitung** melalui kombinasi query PostgreSQL + komputasi di server (kron job / Edge Function), disimpan sebagai **snapshot** per periode (leaderboard) untuk konsistensi dan performa baca.
4. **Periode otomatis** dijalankan oleh scheduler (misal `pg_cron` di Supabase atau cron Vercel) — keputusan akhir ada di technical decision di bawah.

---

## 2. Keputusan Teknis (ADR Ringkas)

| ADR | Keputusan | Alasan |
| --- | --- | --- |
| ADR-01 | Next.js App Router (Server Components by default) | Performa, SEO tidak kritis tapi SSR membantu, integrasi Supabase baik |
| ADR-02 | Supabase untuk Auth, DB, Realtime | Managed Postgres + RLS + Auth siap pakai (OAuth Google disediakan) |
| ADR-03 | PWA via `@serwist/next` atau `next-pwa` | App Shell + offline-first; pilih library yang stabil di App Router |
| ADR-04 | Skor disimpan sebagai snapshot di tabel `leaderboard` dan `periode_kategori` | Non-retroaktif & konsisten walau konfigurasi berubah |
| ADR-05 | Scheduler periode: **`pg_cron`** di Supabase untuk operasi DB (close/open periode, snapshot), dan **reminder notifikasi** via cron Vercel (GET /api/cron) | logika DB dekat dengan data; notifikasi jalan sebagai HTTP cron |
| ADR-06 | Semua mutasi penting via Server Actions / Route Handlers (server-only) | Keamanan, validasi di server, tidak bocor service key |
| ADR-07 | `soft delete` (flag `is_active`) di semua tabel master | Menjaga integritas riwayat |
| ADR-08 | Migration SQL pertama dijalankan via Supabase CLI / `supabase/migrations` | Versioned & reproducible di lokal + produksi |

---

## 3. Skema Database

> Postgres (Supabase). Konvensi: `uuid` PK default `gen_random_uuid()`, timestamp `timestamptz`, soft delete `is_active boolean default true`, audit `created_at`, `updated_at`.

### 3.1 Tabel Master

#### `users` (profil aplikasi, terhubung ke `auth.users` Supabase)

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid PK | = `auth.users.id` |
| email | text unique | |
| full_name | text | |
| role | enum(`admin`, `manager`, `supervisor`) | |
| is_active | boolean default true | soft delete |
| created_at / updated_at | timestamptz | |

> Role disimpan di tabel profil (bukan metadata auth) agar mudah di-RLS.

#### `branch` (Cabang)

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid PK | |
| name | text | |
| code | text unique nullable | kode cabang opsional |
| is_active | boolean default true | |
| created_at / updated_at | timestamptz | |

#### `outlet` (Outlet)

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid PK | |
| branch_id | uuid FK → branch(id) | |
| name | text | |
| is_active | boolean default true | |
| created_at / updated_at | timestamptz | |

#### `cashier` (Kasir)

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid PK | |
| name | text | |
| outlet_id | uuid FK → outlet(id) | outlet penempatan saat ini |
| is_active | boolean default true | |
| created_at / updated_at | timestamptz | |

#### `cashier_outlet_history` (riwayat penempatan kasir)

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid PK | |
| cashier_id | uuid FK → cashier(id) | |
| outlet_id | uuid FK → outlet(id) | |
| started_at | timestamptz | tanggal mulai di outlet tsb |
| ended_at | timestamptz nullable | null = penempatan aktif |

#### `user_branch` (penugasan user ke cabang, banyak-ke-banyak)

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid PK | |
| user_id | uuid FK → users(id) | |
| branch_id | uuid FK → branch(id) | |
| assigned_at | timestamptz | |

### 3.2 Konfigurasi Penilaian

#### `category` (Kategori Penilaian)

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid PK | |
| name | text | |
| weight | numeric(5,2) | bobot % (misal 25.00) |
| is_active | boolean default true | |
| created_at / updated_at | timestamptz | |

#### `category_weight_history` (snapshot bobot per periode — non-retroaktif)

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid PK | |
| category_id | uuid FK → category(id) | |
| period_id | uuid FK → period(id) | periode mulai berlaku |
| weight | numeric(5,2) | bobot yang berlaku |
| unique(category_id, period_id) | | |

#### `detail` (Detail Penilaian)

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid PK | |
| category_id | uuid FK → category(id) | |
| name | text | |
| type | enum(`scale`, `deduction`) | |
| scale_max | numeric nullable | wajib jika type=scale (skala maks) |
| deduction_points | numeric nullable | poin per kejadian, wajib jika type=deduction |
| is_active | boolean default true | |
| created_at / updated_at | timestamptz | |

#### `detail_config_history` (snapshot skala/poin per periode — non-retroaktif)

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid PK | |
| detail_id | uuid FK → detail(id) | |
| period_id | uuid FK → period(id) | |
| scale_max | numeric nullable | |
| deduction_points | numeric nullable | |
| unique(detail_id, period_id) | | |

### 3.3 Periode & Penilaian

#### `period` (Periode Penilaian)

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid PK | |
| label | text | misal "2026-08" |
| start_date | date | |
| end_date | date | |
| status | enum(`open`, `closed`) | |
| closed_at | timestamptz nullable | |
| created_at | timestamptz | |

#### `assessment` (Penilaian per kasir per detail per periode)

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid PK | |
| period_id | uuid FK → period(id) | |
| cashier_id | uuid FK → cashier(id) | |
| detail_id | uuid FK → detail(id) | |
| scale_value | numeric nullable | nilai input untuk type=scale |
| normalized_score | numeric(5,2) | hasil normalisasi 0–100 (diisi sistem) |
| assessed_by | uuid FK → users(id) | user penginput |
| assessed_at | timestamptz | |
| unique(period_id, cashier_id, detail_id) | | satu nilai per kasir per detail per periode |

#### `deduction_event` (Kejadian Deduksi)

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid PK | |
| assessment_id | uuid FK → assessment(id) | merujuk penilaian detail tipe deduction |
| note | text nullable | catatan kejadian |
| points | numeric | poin deduksi (copy dari konfigurasi saat kejadian) |
| occurred_at | timestamptz | |
| created_by | uuid FK → users(id) | |
| created_at | timestamptz | |

### 3.4 Skor Tersimpan (Snapshot)

#### `cashier_period_score` (skor per kasir per periode, termasuk per kategori)

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid PK | |
| period_id | uuid FK → period(id) | |
| cashier_id | uuid FK → cashier(id) | |
| total_score | numeric(5,2) | Σ(skor kategori × bobot) |
| category_scores | jsonb | `{ category_id: { score, weight, status } }` untuk audit & tampilan |
| is_locked | boolean default false | true setelah periode closed |
| updated_at | timestamptz | |
| unique(period_id, cashier_id) | | |

#### `leaderboard_entry` (snapshot leaderboard saat periode ditutup)

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid PK | |
| period_id | uuid FK → period(id) | |
| cashier_id | uuid FK → cashier(id) | |
| outlet_id | uuid FK → outlet(id) | outlet saat periode tsb (snapshot) |
| branch_id | uuid FK → branch(id) | cabang saat periode tsb (snapshot) |
| total_score | numeric(5,2) | |
| category_scores | jsonb | |
| rank_outlet | int nullable | rank saat close (diisi saat query/finalisasi) |
| rank_branch | int nullable | |
| rank_global | int nullable | |
| unique(period_id, cashier_id) | | |

#### `cashier_cumulative_score` (skor akumulatif berjalan)

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid PK | |
| cashier_id | uuid PK / FK | 1:1 |
| cumulative_score | numeric(10,2) | agregasi semua periode (misal rata-rata/sum sesuai keputusan) |
| periods_count | int | jumlah periode ikut dihitung |
| updated_at | timestamptz | |

> **Keputusan akumulatif**: diasumsikan **rata-rata skor seluruh periode terkunci** (`AVG(data periode)`) — keputusan akhir dikonfirmasi saat milestone implementasi. Alternatif: SUM.

### 3.5 Pendampingan

#### `mentoring_session` (Sesi Pendampingan)

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid PK | |
| outlet_id | uuid FK → outlet(id) | outlet yang dikunjungi |
| conducted_by | uuid FK → users(id) | pelaksana (Manager/Supervisor) |
| visited_date | date | |
| note_outlet | text nullable | catatan umum outlet |
| created_at / updated_at | timestamptz | |

#### `mentoring_cashier_note` (catatan per kasir dalam satu sesi)

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid PK | |
| session_id | uuid FK → mentoring_session(id) | |
| cashier_id | uuid FK → cashier(id) | |
| note | text | |
| unique(session_id, cashier_id) | | |

### 3.6 Invite & Notifikasi

#### `invite` (link invite Manager/Supervisor)

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid PK | |
| email | text | email yang diundang |
| role | enum(`manager`, `supervisor`) | |
| token | text unique | token acak (SIP-32 url-safe) |
| branch_ids | uuid[] | cabang yang ditugaskan saat akun dibuat |
| expires_at | timestamptz | |
| used_at | timestamptz nullable | null = belum dipakai |
| created_by | uuid FK → users(id) | |
| created_at | timestamptz | |

#### `notification` (notifikasi in-app)

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | uuid PK | |
| user_id | uuid FK → users(id) | penerima |
| type | enum(`reminder_unassessed`, `low_score_alert`, `system`) | |
| title | text | |
| body | text | |
| payload | jsonb nullable | data terkait (cashier_id, period_id, dsb.) |
| is_read | boolean default false | |
| created_at | timestamptz | |

### 3.7 Tabel Pendukung

- `app_setup` — menandai status setup (admin pertama sudah dibuat?). Satu baris: `id`, `admin_created boolean default false`, `completed_at`.
- `period_log` — log otomatis/manual open-close periode (audit).

---

## 4. Aturan Perhitungan Skor (Implementasi)

1. **Normalisasi detail**
   - Skala: `normalized = (scale_value / scale_max) * 100` — pakai `scale_max` dari `detail_config_history` sesuai periode.
   - Deduksi: `normalized = GREATEST(0, 100 - SUM(deduction_event.points))` per periode.
2. **Skor kategori** = `AVG(normalized_score)` semua detail aktif di kategori tsb pada periode tsb, dihitung dari `assessment` + `deduction_event`.
   - Jika tidak ada `assessment` sama sekali pada kategori → dianggap **100**.
   - Jika sebagian detail dinilai → rata-rata hanya atas detail yang dinilai.
3. **Skor akhir** = `Σ(category_score × weight)` bobot dari `category_weight_history` periode tsb.
4. Snapshot disimpan ke `cashier_period_score` (real-time saat ada perubahan) dan `leaderboard_entry` (saat close).

---

## 5. API / Endpoint

> Auth: Supabase session. Authorization: Server Action/Route Handler cek role + penugasan cabang + RLS.

### 5.1 Auth & Setup

| Method | Path | Fungsi |
| --- | --- | --- |
| POST | `/api/setup` | Create admin pertama (cek `app_setup`) |
| POST | `/api/auth/login` | Login email+password (bisa via Supabase client langsung) |
| POST | `/api/auth/google` | Login Google OAuth (redirect flow Supabase) |
| POST | `/api/invites` | Admin buat link invite (token, email, role, branch_ids) |
| POST | `/api/invites/accept` | Terima invite & register akun (email+password / OAuth) |
| GET | `/api/invites/[token]` | Ambil info invite untuk form registrasi |

### 5.2 Master Data

| Method | Path | Fungsi |
| --- | --- | --- |
| GET/POST | `/api/branches` | List/create cabang |
| PATCH/DELETE(soft) | `/api/branches/[id]` | Update/nonaktifkan cabang |
| GET/POST | `/api/branches/[branchId]/outlets` | List/create outlet |
| GET/POST | `/api/outlets/[outletId]/cashiers` | List/create kasir |
| PATCH | `/api/cashiers/[id]` | Update kasir |
| POST | `/api/cashiers/[id]/transfer` | Mutasi kasir antar outlet (tulis ke `cashier_outlet_history`) |
| DELETE(soft) | `/api/cashiers/[id]` | Nonaktifkan kasir |

### 5.3 Konfigurasi Penilaian

| Method | Path | Fungsi |
| --- | --- | --- |
| GET/POST | `/api/categories` | List/create kategori |
| PATCH | `/api/categories/[id]` | Update kategori (bobot) → buat `category_weight_history` utk periode berikutnya |
| DELETE(soft) | `/api/categories/[id]` | Nonaktifkan |
| GET/POST | `/api/categories/[categoryId]/details` | List/create detail |
| PATCH | `/api/details/[id]` | Update detail (scale_max / deduction_points) → `detail_config_history` |
| DELETE(soft) | `/api/details/[id]` | Nonaktifkan |
| GET | `/api/periods/current/config` | Konfigurasi aktif utk periode berjalan (bobot, detail) |

### 5.4 Penilaian & Skor

| Method | Path | Fungsi |
| --- | --- | --- |
| GET | `/api/cashiers/[id]/assessment?period=` | Ambil penilaian kasir pada periode |
| POST | `/api/assessments` | Input/update penilaian skala (upsert; re-calc skor) |
| DELETE | `/api/assessments/[id]` | Hapus penilaian (re-calc skor) |
| GET | `/api/assessments/[id]/deductions` | List kejadian deduksi |
| POST | `/api/assessments/[id]/deductions` | Catat kejadian deduksi (re-calc skor) |
| DELETE | `/api/deductions/[id]` | Hapus kejadian deduksi (re-calc skor) |
| GET | `/api/cashiers/[id]/scores?period=` | Skor periode + rincian kategori |
| GET | `/api/cashiers/[id]/cumulative` | Skor akumulatif |

### 5.5 Leaderboard

| Method | Path | Fungsi |
| --- | --- | --- |
| GET | `/api/leaderboard?period=&level=outlet|branch|global&branchId=&outletId=` | Ranking, filter level, skor periode |
| GET | `/api/leaderboard/cumulative?level=&branchId=&outletId=` | Ranking akumulatif |
| GET | `/api/leaderboard/export?format=csv` | Export CSV (FR-LB-05) |

### 5.6 Pendampingan

| Method | Path | Fungsi |
| --- | --- | --- |
| GET/POST | `/api/mentoring-sessions` | List/create sesi |
| GET/PATCH | `/api/mentoring-sessions/[id]` | Detail/update sesi |
| DELETE(soft) | `/api/mentoring-sessions/[id]` | Hapus sesi |
| GET | `/api/outlets/[id]/mentoring` | Riwayat dari sisi outlet |
| GET | `/api/cashiers/[id]/mentoring` | Riwayat dari sisi kasir |

### 5.7 Periode & Notifikasi

| Method | Path | Fungsi |
| --- | --- | --- |
| POST | `/api/periods/[id]/close` | Tutup periode manual (admin, log ke `period_log`) |
| POST | `/api/periods/[id]/open` | Buka periode manual (admin) |
| GET | `/api/cron/periods` | Cron: auto close/open periode + snapshot leaderboard |
| GET | `/api/cron/notifications` | Cron: kirim reminder & low-score alert |
| GET | `/api/notifications` | List notifikasi user |
| PATCH | `/api/notifications/[id]/read` | Tandai dibaca |

---

## 6. Struktur Folder Proyek

```
kpi-kasir-v2/
├─ .clinerules
├─ plan.md
├─ prd.md
├─ technical-spec.md
├─ user-flow-wireframe.md
├─ milestone.md
├─ testing-qa-checklist.md
├─ development-maintenance-plan.md
├─ package.json
├─ next.config.mjs
├─ tailwind.config.ts
├─ tsconfig.json
├─ middleware.ts                      # auth guard + redirect setup wizard
├─ docker-compose.yml                 # environment lokal (Supabase lokal / Postgres)
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/
│  │  ├─ 0001_init.sql
│  │  ├─ 0002_rls_policies.sql
│  │  └─ 0003_functions_cron.sql
│  └─ seed.sql
├─ public/
│  ├─ manifest.webmanifest
│  ├─ icons/ (pwa-icon-192, pwa-icon-512)
│  └─ sw.js (generated via serwist)
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx                 # App Shell (header, bottom nav, providers)
│  │  ├─ page.tsx                   # redirect: /setup | /dashboard | /login
│  │  ├─ setup/page.tsx             # Onboarding wizard (admin pertama)
│  │  ├─ login/page.tsx
│  │  ├─ dashboard/page.tsx
│  │  ├─ branches/page.tsx
│  │  ├─ branches/[id]/page.tsx
│  │  ├─ outlets/[id]/page.tsx
│  │  ├─ cashiers/
│  │  │  ├─ page.tsx
│  │  │  └─ [id]/page.tsx           # profil kasir, penilaian, riwayat mentoring, mutasi
│  │  ├─ assessment/
│  │  │  ├─ page.tsx                # daftar kasir perlu dinilai
│  │  │  └─ [cashierId]/page.tsx    # form penilaian per kategori/detail
│  │  ├─ mentoring/
│  │  │  ├─ page.tsx
│  │  │  └─ new/page.tsx
│  │  ├─ leaderboard/
│  │  │  ├─ page.tsx
│  │  │  └─ cumulative/page.tsx
│  │  ├─ settings/
│  │  │  ├─ categories/page.tsx
│  │  │  ├─ users/page.tsx
│  │  │  └─ invites/page.tsx
│  │  ├─ about/page.tsx             # credit Yoga Sptriana
│  │  ├─ api/ ...                   # route handlers (bagian 5)
│  │  └─ error.tsx / not-found.tsx / loading.tsx
│  ├─ components/
│  │  ├─ ui/                        # BottomSheet, Toast, AppBar, Toggle, Modal, Skeleton, dsb.
│  │  ├─ data-list/                 # reusable: DataList, InfiniteScroll, FilterBar, PullToRefresh
│  │  ├─ leaderboard/               # LeaderboardCard, RankBadge, ScoreBar
│  │  ├─ assessment/                # ScaleInput, DeductionForm, CategorySection
│  │  ├─ mentoring/                 # SessionForm, CashierNoteList
│  │  └─ setup/                     # SetupWizard, StepIndicator, AdminForm
│  ├─ lib/
│  │  ├─ supabase/
│  │  │  ├─ client.ts               # browser client
│  │  │  ├─ server.ts               # server client (cookies)
│  │  │  ├─ admin.ts                # service-role client (server-only!)
│  │  │  └─ middleware.ts
│  │  ├─ auth/
│  │  │  ├─ guards.ts               # requireRole, requireBranchAccess
│  │  │  └─ session.ts
│  │  ├─ scoring/
│  │  │  ├─ normalize.ts
│  │  │  ├─ category.ts
│  │  │  └─ recalc.ts               # hitung ulang cashier_period_score
│  │  ├─ periods/
│  │  │  ├─ scheduler.ts
│  │  │  └─ close.ts
│  │  ├─ validators/                # zod schemas
│  │  │  ├─ branch.ts
│  │  │  ├─ category.ts
│  │  │  ├─ assessment.ts
│  │  │  └─ mentoring.ts
│  │  └─ utils.ts
│  ├─ hooks/
│  │  ├─ useInfiniteData.ts
│  │  ├─ usePullToRefresh.ts
│  │  └─ useToast.ts
│  ├─ types/
│  │  ├─ database.ts                # generated types (supabase gen types)
│  │  ├─ entities.ts
│  │  └─ api.ts
│  └─ middleware.ts (atau di root)
└─ docs/ (opsional: catatan tambahan, ADR detail)
```

---

## 7. Keamanan (RLS) Ringkas

| Tabel | Policy Ringkas |
| --- | --- |
| users | SELECT sendiri; SELECT semua untuk admin; UPDATE sendiri/profil oleh admin |
| branch / outlet | Baca: semua user aktif; tulis: admin |
| cashier | Baca: user dgn akses cabang terkait / admin; tulis: **server-guarded** (lihat ADR) |
| category / detail | Baca: semua user aktif; tulis: admin |
| assessment / deduction_event | Baca: admin atau user dgn akses cabang dari outlet kasir; tulis: **server-guarded** |
| mentoring_session / mentoring_cashier_note | Baca: admin atau user dgn akses cabang outlet; tulis: **server-guarded** |
| leaderboard_entry / cashier_period_score | Baca: semua user aktif (atau sesuai cabang); tulis: server (service role / RLS service) |
| invite | Hanya admin yg buat; token bisa dibaca publik utk view |
| notification | Hanya pemilik (user_id) |

> **ADR (keputusan arsitektur) — policy WRITE:** Semua operasi tulis (`cashier`, `cashier_outlet_history`, `assessment`, `deduction_event`, `mentoring_session`, `mentoring_cashier_note`) dipaksa melalui route handler server-side (`src/app/api/...`) yang melakukan otorisasi bisnis (`requireRole`, `requireBranchAccess`, validasi zod). Client browser **tidak** menulis langsung ke Supabase. Oleh karena itu policy WRITE untuk `authenticated` dibuat permisif (`for all ... using true with check true`, migrasi `0007`), sementara **policy SELECT/READ tetap dibatasi RLS per cabang** sehingga data lintas cabang tidak bisa dibaca. Blokir aksi lintas cabang pada operasi tulis dijamin di lapisan API/guard.
>
> Detail lengkap policy SQL: `supabase/migrations/0002_rls_policies.sql`, `0006_fix_insert_rls.sql`, `0007_write_policies_server_guarded.sql`.

---

## 8. Environment & Variabel

| Variabel | Keterangan |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key (publik, aman dgn RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | service role (server-only) |
| `NEXT_PUBLIC_APP_URL` | base URL app (utk link invite, callback) |
| `CRON_SECRET` | proteksi endpoint cron |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (opsional, via Supabase OAuth config) | Google OAuth |

---

## 9. Testing & Tooling Singkat

- Unit test: Vitest (normalisasi, scoring, validasi).
- Integration/E2E: Playwright (setup wizard, login, input penilaian, leaderboard).
- Lint/format: ESLint + Prettier + TypeScript strict.
- Database test: Supabase local (docker) + seed data.

> Detail lengkap di `testing-qa-checklist.md` dan `development-maintenance-plan.md`.

---

## 10. Referensi

- `plan.md` — Spesifikasi Produk
- `prd.md` — Product Requirements Document
- `user-flow-wireframe.md` — User Flow & Wireframe
- `milestone.md` — Tahapan & target
- `testing-qa-checklist.md` — Skenario pengujian
- `development-maintenance-plan.md` — Proses development & maintenance