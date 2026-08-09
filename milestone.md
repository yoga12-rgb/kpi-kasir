# Milestone — Aplikasi KPI & Ranking Kasir Rajaklana

> Dokumen ini adalah **Milestone** yang disusun mengacu pada `plan.md`, `prd.md`, `technical-spec.md`, dan `user-flow-wireframe.md`.
> Berisi pembagian tahapan pengerjaan beserta target, deliverable, dan kriteria selesai (Definition of Done) tiap tahap.
> Status: ✅ **M0–M9 selesai diimplementasikan** (build produksi sukses, 16 unit test lulus). Status detail per milestone di bawah.

---

## 1. Ringkasan Tahapan

| Milestone | Nama | Fokus Utama | Estimasi |
| --- | --- | --- | --- |
| M0 | Foundation & Setup | Inisialisasi proyek, environment, PWA shell | 3–4 hari |
| M1 | Database & Auth | Skema DB, migrasi, RLS, auth, setup wizard, invite | 6–8 hari |
| M2 | Master Data | Cabang, Outlet, Kasir, mutasi, soft delete | 5–7 hari |
| M3 | Konfigurasi Penilaian | Kategori, Detail, bobot, history non-retroaktif | 4–6 hari |
| M4 | Penilaian & Skor | Input penilaian, deduksi, perhitungan skor, periode | 8–10 hari |
| M5 | Pendampingan | Sesi pendampingan, catatan per kasir, riwayat | 3–4 hari |
| M6 | Leaderboard & Laporan | Ranking, filter level, export, akumulatif | 4–5 hari |
| M7 | Notifikasi | Reminder, low-score alert, pusat notifikasi | 3–4 hari |
| M8 | UI Polish & PWA | App Shell, pull-to-refresh, infinite scroll, on-boarding, installable | 4–6 hari |
| M9 | Testing & QA | Skenario QA checklist, bugfix, performa, security review | 5–7 hari |
| M10 | Deploy & Rilis | Vercel + Supabase produksi, dokumentasi final, Go-Live | 2–3 hari |

**Total estimasi awal:** ± 7–8 minggu kerja (dapat disesuaikan).

---

## 2. Detail Tiap Milestone

### M0 — Foundation & Setup

**Tujuan:** Proyek bisa dijalankan di lokal + Docker, struktur folder sesuai `technical-spec.md`, PWA shell dasar.

**Deliverable:**
- Scaffold Next.js (App Router) + TypeScript strict + Tailwind CSS + ESLint + Prettier
- Setup Supabase lokal via Docker (`docker-compose.yml`, `supabase/config.toml`, `supabase/migrations`)
- Setup PWA (manifest, service worker via serwist/next-pwa, App Shell layout, bottom navigation)
- Komponen UI dasar: AppBar, BottomSheet, Toast, Toggle, Modal, Skeleton
- Middleware auth guard (awal: placeholder)

**Definition of Done:**
- `npm run dev` jalan di lokal; `docker compose up` menjalankan Supabase lokal.
- Halaman kosong (dashboard placeholder, login placeholder, setup placeholder) bisa diakses.
- PWA bisa di-install di browser mobile (manifest valid, SW ter-register).

---

### M1 — Database & Auth

**Tujuan:** Skema DB lengkap + RLS + autentikasi (email/password, Google OAuth) + setup wizard + link invite.

**Deliverable:**
- Migrasi `0001_init.sql` (semua tabel sesuai `technical-spec.md` §3) + `0002_rls_policies.sql` + `0003_functions_cron.sql` (persiapan)
- `supabase/gen types` → `src/types/database.ts`
- Halaman `/setup` + API `POST /api/setup` (buat admin pertama, set `app_setup`)
- Login email+password + Google OAuth (Supabase Auth)
- Invite: `POST /api/invites`, `GET /api/invites/[token]`, `POST /api/invites/accept`; halaman `/invite/[token]`
- Session & guard: `requireRole`, `requireBranchAccess`

**Definition of Done:**
- Setup wizard: sekali sukses, tidak muncul lagi.
- User undangan bisa daftar via link (sekali pakai, expired ditolak).
- Google OAuth login berhasil.
- RLS aktif; akses lintas cabang tertolak (uji dasar).

---

### M2 — Master Data

**Tujuan:** CRUD Cabang, Outlet, Kasir; mutasi kasir; soft delete.

**Deliverable:**
- API: branches, outlets, cashiers, transfer (`technical-spec.md` §5.2)
- Halaman: daftar & form cabang/outlet/kasir, detail kasir (info, penempatan, riwayat)
- Riwayat penempatan: `cashier_outlet_history` terisi saat kasir dibuat/dimutasi
- UI: form modal/bottom sheet, konfirmasi nonaktifkan

**Definition of Done:**
- Cabang/Outlet dibuat, diedit, dinonaktifkan (tidak terhapus permanen).
- Kasir dibuat di outlet; mutasi pindah outlet; riwayat penilaian tetap terkait kasir.
- Kasir nonaktif tidak muncul di list aktif tetapi riwayat tetap bisa dilihat.
- Uji langsung peran: Manager/Supervisor hanya bisa akses cabang ditugaskan.

---

### M3 — Konfigurasi Penilaian

**Tujuan:** Kategori + Detail (Skala/Deduksi), bobot, dan mekanisme non-retroaktif.

**Deliverable:**
- API: categories, details, `GET /api/periods/current/config`
- Validasi total bobot = 100%
- Snapshot `category_weight_history` & `detail_config_history` saat periode baru dibuka/perubahan config
- UI: list & form kategori/detail, indikator total bobot, info "berlaku periode berikutnya"
- Soft delete kategori/detail

**Definition of Done:**
- Bobot ≠ 100% → simpan kategori ditolak.
- Perubahan bobot/poin tidak mengubah skor periode berjalan (uji dengan data lama).
- Kategori/detail nonaktif tidak muncul di form penilaian periode baru, riwayat tetap ada.

---

### M4 — Penilaian & Skor

**Tujuan:** Input penilaian (per kategori & per detail), deduksi per kejadian, perhitungan skor, periode otomatis.

**Deliverable:**
- API: assessments (upsert/delete), deduction events (create/delete), scores, cumulative
- `lib/scoring/*`: normalize, category, recalc
- UI: halaman penilaian kasir (mode kategori & mode detail), form deduksi per kejadian
- Scheduler periode: close/open otomatis (pg_cron/cron Vercel), snapshot `cashier_period_score` & `leaderboard_entry`, update `cashier_cumulative_score`
- Override manual buka/tutup periode (admin) + `period_log`

**Definition of Done:**
- Input skala: nilai di luar rentang ditolak; normalisasi benar.
- Deduksi: tiap kejadian tersimpan; skor detail floor 0; poin diambil dari konfigurasi.
- Kategori belum dinilai = 100.
- Skor akhir sesuai rumus (uji contoh kasus di bawah).
- Periode close/open otomatis berjalan; skor periode terkunci; akumulatif ter-update.

**Contoh kasus uji (scoring):**
- Kategori A bobot 40%, kategori B bobot 60%.
- A: 2 detail skala. Detail A1 (skala 5, input 4 → 80). A2 belum dinilai → (80 + 100)/2 = 90.
- B: 1 detail deduksi -5/kejadian, 2 kejadian → 100 − 10 = 90.
- Skor akhir = (90 × 0.40) + (90 × 0.60) = 90.

---

### M5 — Pendampingan

**Tujuan:** Modul pendampingan terpisah (kualitatif, tidak memengaruhi skor).

**Deliverable:**
- API: mentoring sessions (CRUD), catatan per kasir, riwayat outlet & kasir
- UI: list sesi, form sesi (outlet, tanggal, catatan umum, multi kasir + catatan tiap kasir), detail sesi
- Riwayat dari sisi outlet & kasir

**Definition of Done:**
- Satu sesi bisa berisi banyak kasir.
- Pendampingan tidak mengubah skor (verifikasi).
- Riwayat tampil dari sisi outlet maupun kasir.
- Manager/Supervisor hanya bisa akses outlet di cabang ditugaskan.

---

### M6 — Leaderboard & Laporan

**Tujuan:** Ranking semua level + export.

**Deliverable:**
- API: leaderboard (period/cumulative, level outlet/branch/global, filter), export CSV
- UI: halaman leaderboard (tab periode & akumulatif), filter level, badge rank, infinite scroll
- Snapshot `leaderboard_entry` tampil untuk periode tertutup

**Definition of Done:**
- Filter per outlet/cabang/lintas cabang berfungsi.
- Skor periode berjalan & akumulatif tampil benar.
- Periode tertutup → data terkunci (snapshot), tidak berubah walau input lama diekspos/hapus.
- Export CSV sesuai format (FR-LB-05).

---

### M7 — Notifikasi

**Tujuan:** Reminder & low-score alert + pusat notifikasi.

**Deliverable:**
- API: notifications (list, mark read), cron reminder & low-score alert
- Scheduler: `GET /api/cron/notifications` (proteksi `CRON_SECRET`)
- UI: ikon notifikasi di AppBar, halaman pusat notifikasi, badge unread

**Definition of Done:**
- Reminder terkirim untuk kasir belum dinilai (min 1× per periode/berkala).
- Alert skor rendah berturut-turut (≥ N periode, ambang skor dari config).
- Notifikasi hanya terlihat oleh user pemilik; tanda baca tersimpan.

---

### M8 — UI Polish & PWA

**Tujuan:** Pengalaman mobile-first final, reusable list, onboarding, performa.

**Deliverable:**
- Komponen `DataList` reusable (lazy load, infinite scroll, filter, pull-to-refresh) dipakai semua halaman list
- Bottom Sheet, Toast, Modal konsisten di seluruh alur
- Pull-to-refresh di halaman utama & list
- Onboarding wizard polish (`/setup`)
- UI generik/netral; token desain (warna, spacing, tipografi) terpusat di Tailwind config
- Audit performa (Lighthouse mobile) & aksesibilitas dasar

**Definition of Done:**
- Semua list panjang memakai DataList (fetch bertahap, scroll).
- Pull-to-refresh berfungsi.
- Lighthouse mobile ≥ 90 (Performance, PWA, Best Practices, Accessibility target).
- UI konsisten & netral (siap disesuaikan branding).

---

### M9 — Testing & QA

**Tujuan:** Menjalankan `testing-qa-checklist.md`, perbaikan bug, validasi keamanan.

**Deliverable:**
- Unit test: Vitest (normalisasi, scoring, validasi zod, util periode)
- E2E: Playwright (setup wizard, login+invite, input penilaian skala/deduksi, leaderboard, mentoring)
- Uji RLS/keamanan: lintas cabang, nonaktif akun, akses endpoint cron tanpa secret
- Uji PWA offline & install
- Perbaikan bug & regresi

**Definition of Done:**
- Semua skenario checklist QA lulus (hasil dicatat).
- Coverage unit: normalisasi & scoring ≥ 90%.
- E2E kritikal lulus (flow utama stabil).
- Hasil audit keamanan ringkas terdokumentasi.

---

### M10 — Deploy & Rilis

**Tujuan:** Rilis ke produksi (Vercel + Supabase) + dokumentasi final.

**Deliverable:**
- Setup Supabase project produksi + migrasi + RLS + cron
- Deploy Vercel: environment variables, domain, PWA headers, cron config
- Data seed awal (contoh) hanya di staging, bukan produksi
- Dokumentasi final: update semua dokumen mengikuti implementasi aktual
- Uji smoke produksi (setup wizard, login, satu siklus penilaian, close periode)

**Definition of Done:**
- Aplikasi live di produksi, HTTPS, PWA installable.
- Satu siklus periode penuh berhasil di produksi (uji dengan data uji lalu dibersihkan/hanya pada cabang uji).
- Semua dokumen merefleksikan implementasi akhir.

---

## 3. Kriteria Penolakan Rilis (Release Gates)

| Gate | Kondisi | Status |
| --- | --- | --- |
| G1 | Setup wizard & auth (email/OAuth/invite) berfungsi | Wajib |
| G2 | Semua CRUD master data + RLS aman | Wajib |
| G3 | Perhitungan skor sesuai rumus & non-retroaktif | Wajib |
| G4 | Periode otomatis + leaderboard snapshot benar | Wajib |
| G5 | QA checklist kritis lulus | Wajib |
| G6 | PWA ter-install, app shell cepat, pull-to-refresh jalan | Wajib |
| G7 | Halaman About memuat credit Yoga Sptriana | Wajib |
| G8 | Tidak ada data produksi palsu (kecuali cabang uji eksplisit) | Wajib |

---

## 4. Backlog Opsional (Pasca-MVP)

- FR-AUTH-08: reset password & profil
- FR-ORG-05: UI riwayat penempatan lebih kaya
- FR-CALC-06: tombol recalculate manual
- FR-LB-05: export CSV (jika belum di M6)
- FR-PRD-04: override manual periode (jika belum di M4)
- FR-NTF-03: pusat notifikasi (jika belum di M7)
- Statistik tren skor per kasir/outlet/cabang (grafik)
- Dark mode
- Multi-bahasa (i18n)

---

## 5. Referensi

- `plan.md` — Spesifikasi Produk
- `prd.md` — Product Requirements Document
- `technical-spec.md` — Spesifikasi Teknis
- `user-flow-wireframe.md` — User Flow & Wireframe
- `testing-qa-checklist.md` — Skenario pengujian
- `development-maintenance-plan.md` — Proses development & maintenance