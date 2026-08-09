# Development & Maintenance Plan — Aplikasi KPI & Ranking Kasir Rajaklana

> Dokumen ini adalah **Development & Maintenance Plan** yang disusun mengacu pada `plan.md`, `prd.md`, `technical-spec.md`, dan `milestone.md`.
> Berisi rencana proses development (termasuk penggunaan environment lokal & Docker) serta rencana pemeliharaan aplikasi setelah rilis.
> Status: Draft awal — diperbarui seiring implementasi.

---

## 1. Strategi Development

### 1.1 Prinsip Kerja

1. **Disiplin alur kerja** (sesuai `.clinerules`): Brainstorm & Spec → Plan First → Test-Driven Development (TDD) → Code Review.
2. **Dokumen sebagai acuan tunggal**: seluruh implementasi mengacu pada `plan.md` + enam dokumen turunannya (tidak bergantung pada pengetahuan histori proyek lain).
3. **Iterasi per milestone** mengikuti `milestone.md` (M0 → M10).
4. **TDD**: tulis test gagal (Red) → implementasi minimal (Green) → refactor, untuk modul logika (scoring, validasi, periode).
5. **Code review** sebelum menyelesaikan tugas: periksa kualitas, keamanan (RLS, validasi server), dan konsistensi dengan spesifikasi.

### 1.2 Alur Kerja Harian Agent

```
1. Ambil task dari milestone aktif (tulis di task_progress)
2. Brainstorm/spec singkat & identifikasi file terkait
3. Tulis/update test (Red) → jalankan → pastikan gagal sesuai alasan
4. Implementasi (Green) → jalankan test → pastikan lulus
5. Refactor & code review (keamanan, performa, konsistensi)
6. Update dokumentasi bila perilaku/struktur berubah
7. Update task_progress & lapor hasil
```

---

## 2. Environment Lokal & Docker

### 2.1 Arsitektur Environment Lokal

```
┌─────────────────────────────────────────────────┐
│  Local Machine (Windows 11)                     │
│                                                 │
│  ┌──────────────┐      ┌────────────────────┐  │
│  │ Next.js Dev  │◄────►│ Supabase Lokal     │  │
│  │ Server       │ HTTP │ (Docker Compose)   │  │
│  │ :3000        │      │  - Postgres        │  │
│  │              │      │  - Auth (GoTrue)   │  │
│  │  pnpm dev    │      │  - Studio (UI)     │  │
│  └──────────────┘      │  - pg_cron (ops)   │  │
│                        └────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### 2.2 Prasyarat

| Tool | Versi Minimal (rekomendasi) | Catatan |
| --- | --- | --- |
| Node.js | 20 LTS | Runtime Next.js |
| pnpm | 9.x | Package manager (bisa juga npm/yarn, tetapkan 1) |
| Docker Desktop | latest stable | Menjalankan Supabase lokal |
| Supabase CLI | latest | Migrasi, seed, type generation, studio |
| Git | latest | Version control |

### 2.3 Setup Awal

```bash
# 1. Clone & install dependencies
git clone <repo-url> kpi-kasir-v2
cd kpi-kasir-v2
pnpm install

# 2. Salin env
cp .env.example .env.local
# isi: NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
#      NEXT_PUBLIC_SUPABASE_ANON_KEY=<dari supabase status>
#      SUPABASE_SERVICE_ROLE_KEY=<dari supabase status> (server-only)

# 3. Jalankan Supabase lokal (Docker)
supabase start          # atau: docker compose up -d
supabase status         # tampilkan URL & keys

# 4. Jalankan migrasi + seed
supabase db reset       # apply migrations + seed (development)

# 5. Jalankan Next.js dev
pnpm dev                # http://localhost:3000
```

### 2.4 Perintah Berguna

| Perintah | Fungsi |
| --- | --- |
| `supabase start` / `supabase stop` | Nyalakan/hentikan stack lokal |
| `supabase db reset` | Reset DB lokal + apply migrasi & seed |
| `supabase migration new <nama>` | Buat file migrasi baru |
| `supabase db push` | Apply migrasi ke remote (hati-hati, prefer `db reset` di lokal) |
| `supabase gen types typescript --local > src/types/database.ts` | Generate tipe DB |
| `supabase seed` | Isi data contoh development |
| `docker compose ps` | Cek status container |
| `pnpm test` | Unit test (Vitest) |
| `pnpm test:e2e` | E2E (Playwright) |
| `pnpm lint` / `pnpm format` | Lint & format |
| `pnpm build` | Build produksi lokal |

### 2.5 `docker-compose.yml` (Ringkas)

```yaml
# Namun untuk Supabase lebih direkomendasikan pakai `supabase start`
# (Supabase CLI mengelola image & config dari supabase/config.toml).
# docker-compose.yml cukup digunakan untuk service pendukung tambahan:
version: "3.9"
services:
  # (contoh placeholder — service pendukung bila ada: redis, mailpit, dsb.)
  mailpit:
    image: axllent/mailpit:latest
    ports:
      - "1025:1025"   # SMTP
      - "8025:8025"   # UI
```

> **Catatan**: Supabase lokal dikelola via `supabase start` (config di `supabase/config.toml`). `docker-compose.yml` disediakan opsional untuk service tambahan development (mis. mailpit untuk test email invite via SMTP lokal).

---

## 3. Workflow Perubahan Database

1. **Buat migrasi**: `supabase migration new <nama>`.
2. **Tulis SQL migrasi** (up) + kebiasaan menulis rollback di komentar (Opsional: Supabase tidak menjalankan rollback otomatis; dokumentasikan cara revert manual).
3. **Generate types**: `supabase gen types typescript --local > src/types/database.ts`.
4. **Test di lokal**: `supabase db reset` → pastikan migrasi + seed jalan.
5. **RLS**: setiap tabel baru wajib punya policy; tulis di `0002_rls_policies.sql` atau migrasi baru.
6. **Review**: pastikan constraint, index, dan naming konsisten dgn `technical-spec.md`.
7. Setelah disetujui, migrasi di-apply ke produksi saat rilis (M10) via `supabase db push` (dengan backup).

---

## 4. Workflow Perubahan Kode (Git)

```
Branch model: trunk-based ringan
├─ main            → selalu deployable
├─ feat/<id-slug>  → fitur / bugfix (mis. feat/m4-scoring-bugfix)
└─ dikerjakan langsung setelah task dari milestone

Commit convention (conventional):
  feat(assessment): tambah input skala per detail
  fix(scoring): floor 0 untuk deduksi
  test(scoring): kasus kategori belum dinilai = 100
  docs(prd): update kriteria penerimaan
  chore(deps): bump next
```

Alur:
1. Branch dari `main` (nama mengikuti konvensi di atas).
2. Commit kecil + jelas (unit logic terpisah dari UI).
3. Jalankan `pnpm lint && pnpm test` sebelum push.
4. PR (jika ada reviewer), atau merge setelah code review internal (agent) & checklist QA lulus untuk cakupan task.
5. Update `milestone.md` status & dokumen terkait bila spesifikasi berubah.

---

## 5. Strategi Testing dalam Development

| Layer | Tools | Kapan |
| --- | --- | --- |
| Unit (scoring, validasi, util) | Vitest | Tiap modul logika (Red→Green) |
| Integration (DB logic, RLS) | Vitest + Supabase local / SQL test | Saat perubahan schema/policy |
| E2E kritis | Playwright | Sebelum merge fitur besar / M9 |
| PWA & performa | Lighthouse, DevTools | M8, M9 |
| QA checklist | `testing-qa-checklist.md` | M9 (regresi) & M10 (smoke) |

Aturan:
- Test harus **deterministik** (pakai seed/teardown).
- Tidak menulis test hanya untuk menaikkan coverage; fokus pada logika kritis: normalisasi, deduksi floor, non-retroaktif, periode.
- Setiap bug yang ditemukan di QA → tambahkan test regresi.

---

## 6. Strategi Branching & Lingkungan (Environments)

| Environment | Tujuan | Kriteria |
| --- | --- | --- |
| **Local** | Development harian | Docker + Supabase lokal |
| **Staging** (Vercel Preview + Supabase project staging) | Uji integrasi sebelum produksi; seed data uji | Deploy otomatis dari PR/branch `develop`/preview |
| **Production** (Vercel prod + Supabase project prod) | Live untuk Rajaklana | Hanya dari `main`; setelah release gates lulus |

Aturan data:
- Seed contoh (contoh cabang/kasir) **hanya di local & staging**, tidak pernah di produksi.
- Perubahan RLS/migrasi diuji di staging dulu.

---

## 7. Rencana Pemeliharaan (Pasca-Rilis)

### 7.1 Pemantauan Rutin

| Frekuensi | Aktivitas | PIC |
| --- | --- | --- |
| Harian (otomatis) | Cron periode & notifikasi berjalan (cek log `period_log`, cron status) | Sistem + Admin |
| Mingguan | Review log error (Vercel Logs), database usage, backup status | Admin/dev |
| Bulanan | Peninjauan hasil periode (leaderboard close), evaluasi bobot & poin deduksi, ekspor laporan | Administrator + Manager |
| Per rilis fitur | QA checklist & smoke test sebelum deploy | Agent/dev |

### 7.2 Backup & Recovery

- **Supabase**: aktifkan **PITR (Point-in-Time Recovery)** atau backup harian otomatis (sesuai plan Supabase project).
- Simpan **backup manual** sebelum menjalankan migrasi destruktif.
- Uji **restore** ke project staging minimal sekali sebelum go-live dan tiap 3 bulan.
- Dokumentasi prosedur restore di `docs/ops/restore.md` (dibuat saat M10).

### 7.3 Keamanan Berkala

| Aktivitas | Frekuensi |
| --- | --- |
| Review RLS policies (tabel baru/policy baru) | Setiap perubahan schema |
| Rotasi `SUPABASE_SERVICE_ROLE_KEY` & `CRON_SECRET` | Setiap 6 bulan / saat dicurigai bocor |
| Audit invite token (used/expired cleanup) | Bulanan |
| Review user aktif (akun nonaktif?) | Bulanan |
| Dependency vulnerability scan (`pnpm audit`) | Mingguan / sebelum rilis |

### 7.4 Perawatan Data

- **Arsip periode lama**: jaga performa query leaderboard → pertimbangkan partition/archive untuk `assessment`, `deduction_event`, `leaderboard_entry` saat volume besar (diputuskan saat monitoring).
- **Pembersihan**: hapus/expire invite terkunci otomatis; nonaktifkan akun yang tidak dipakai (manual admin).
- **Soft delete**: data nonaktif tidak dihapus; jaga konsistensi riwayat.

### 7.5 Update Dependensi & Platform

- `pnpm up` terjadwal bulanan + `pnpm audit` sebelum rilis.
- Ikuti rilis Next.js LTS; hindari upgrade major tanpa uji regresi (QA checklist).
- Pantau perubahan Supabase (deprecation, pricing, RLS behavior) via changelog.

---

## 8. Prosedur Rilis

```
[Fitur selesai & QA lokal]
        │
        ▼
[Deploy ke Staging (Vercel Preview)]
  ├─ Jalankan migrasi ke staging (supabase db push / migrasi via CI)
  ├─ Smoke test di staging (QA-SMK-*)
  └─ Verifikasi RLS & data uji
        │
        ▼
[Release Gates (milestone.md §3) semua lulus]
        │
        ▼
[Merge ke main → Deploy produksi (Vercel)]
  ├─ Jalankan migrasi produksi (setelah backup)
  ├─ Set env variables produksi
  ├─ Aktifkan cron produksi
  └─ Smoke test produksi (QA-SMK-*)
        │
        ▼
[Tag version (v1.0.0) + update changelog & dokumentasi]
```

**Rollback plan**: jika terjadi regresi produksi — deploy ulang commit `main` sebelumnya (Vercel instant rollback) + restore DB dari backup bila migrasi menyebabkan masalah data (documented di `docs/ops/restore.md`).

---

## 9. Dokumentasi yang Harus Selalu Diupdate

| Dokumen | Kapan Diupdate |
| --- | --- |
| `plan.md` | Hanya jika kebutuhan inti berubah (otentikasi sumber tunggal) |
| `prd.md` | Saat scope/kebutuhan berubah |
| `technical-spec.md` | Saat arsitektur/skema/API berubah |
| `user-flow-wireframe.md` | Saat alur/desain UI berubah |
| `milestone.md` | Status progress & pergeseran estimasi |
| `testing-qa-checklist.md` | Tambah skenario baru / update hasil QA |
| `development-maintenance-plan.md` | Proses baru / prosedur ops baru |
| `docs/ops/*` | Prosedur operasional (restore, runbook) |

Aturan: setiap PR yang mengubah perilaku aplikasi wajib menyertakan/update dokumen terkait.

---

## 10. Kontak & Referensi

- Pembuat aplikasi: **Yoga Sptriana** — https://www.instagram.com/mang.agooy/ (ditampilkan di halaman About).
- Referensi dokumen: `plan.md`, `prd.md`, `technical-spec.md`, `user-flow-wireframe.md`, `milestone.md`, `testing-qa-checklist.md`.

---

## 11. Checklist Implementasi (Status Aktual)

- [x] Enam dokumen wajib selesai (prd, technical-spec, user-flow-wireframe, milestone, testing-qa-checklist, development-maintenance-plan)
- [x] M0 — Scaffold Next.js + Tailwind + struktur folder + PWA shell + komponen UI dasar
- [x] M0 — Setup Supabase (migrasi 0001–0004 + config + seed + docker-compose)
- [x] M1 — Auth lengkap: setup wizard, login email/password, Google OAuth flow, invite (API + halaman), guards
- [x] M2 — Master data lengkap: Cabang, Outlet, Kasir, mutasi outlet, soft delete, riwayat penempatan
- [x] M3 — Konfigurasi penilaian: Kategori (bobot validasi 100%), Detail (Skala/Deduksi), snapshot non-retroaktif
- [x] M4 — Penilaian & skor: input skala, kejadian deduksi per kejadian, trigger hitung ulang PostgreSQL, periode open/close (RPC + cron API), leaderboard snapshot & akumulatif
- [x] M5 — Pendampingan: sesi multi-kasir, riwayat dari sisi outlet & kasir (tidak memengaruhi skor)
- [x] M6 — Leaderboard: filter level (global/per cabang/per outlet), mode periode & akumulatif, ranking
- [x] M7 — Notifikasi: reminder belum dinilai + alert skor rendah (cron), pusat notifikasi & mark read
- [x] M8 — UI polish: AppShell mobile-first, DataList reusable (infinite scroll), halaman About (credit Yoga Sptriana), error/loading/not-found
- [x] M9 — Unit test Vitest: 16 test lulus (normalisasi & skor kategori, termasuk contoh kasus milestone M4)
- [x] M10 — Typecheck lulus (`tsc --noEmit`), build produksi sukses (`next build` — 52 route)
- [ ] M10 — Deploy produksi (Vercel + Supabase) & smoke test produksi — menunggu kredensial/akun

---

## 12. Referensi

- `plan.md` — Spesifikasi Produk
- `prd.md` — Product Requirements Document
- `technical-spec.md` — Spesifikasi Teknis
- `user-flow-wireframe.md` — User Flow & Wireframe
- `milestone.md` — Tahapan pengerjaan
- `testing-qa-checklist.md` — Skenario pengujian