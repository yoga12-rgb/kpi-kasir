# Roadmap Perbaikan & Milestone — Hasil Audit UI/UX, Fetching, Caching, dan Security

Dokumen ini menjadi kontrak implementasi perbaikan atas temuan pada
`docs/AUDIT_FINDINGS_UIUX_FETCH_CACHE_SECURITY.md` (audit 2026-08-13). Roadmap ini disusun
mengikuti konvensi `milestone.md` dan dokumen `docs/*_ROADMAP.md` yang sudah ada.

- **Versi target**: `0.3.0` (minor; mengandung perbaikan keamanan yang terlihat oleh pengguna
  maupun operator).
- **Sumber temuan**: `docs/AUDIT_FINDINGS_UIUX_FETCH_CACHE_SECURITY.md`.

---

## 1. Ringkasan Temuan yang Ditangani

| ID | Severity | Area | Temuan singkat |
|---|---|---|---|
| S1 | P1 | Security | Rate limiter in-memory tidak efektif multi-instance/serverless |
| S2 | P1 | Security | Belum ada proteksi CSRF/origin check pada route mutasi cookie session |
| S3 | P2 | Security | Rate limit hanya pada 6 endpoint |
| S4 | P2 | Security | CSP mengizinkan `'unsafe-inline'` untuk script |
| S5 | P2 | Security | `next/image` mengizinkan hostname wildcard `https://**` |
| S6 | P2 | Security | `console.error` mencatat `details`/`hint` mentah |
| F1 | P1 | Fetching | Pagination offset vs cursor tidak konsisten antar resource |
| F2 | P2 | Fetching | Invalidasi memakai `refetchType: 'none'` + bergantung `router.refresh()` |
| F3 | P2 | Fetching | `queryUsers` offset tanpa batas aman untuk skala besar |
| F4 | P2 | Fetching | `N+1` kecil pada guard (sudah dibatasi React `cache()`) |
| C1 | P2 | Caching | Versi cache service worker di-bump manual (`kpi-kasir-public-v3`) |
| C2 | P2 | Caching | Belum pakai `HydrationBoundary`/prefetch server→client |
| U1 | P2 | UI/UX | Override `.bg-white` via `!important` untuk dark mode |
| U2 | P2 | UI/UX | Indikator loading tidak seragam (`isPending` vs `isFetching`) |
| U3 | P2 | UI/UX | Belum ada komponen toast/banner terpusat |

---

## 2. Urutan Milestone dan Dependensi

| Milestone | Nama | Fokus | Temuan | Estimasi |
|---|---|---|---|---|
| M0 | Security hardening — P1 | Rate limit terdistribusi + CSRF/origin + perluasan rate limit | S1, S2, S3 | 3–4 hari |
| M1 | Security hardening — P2 | CSP, remotePatterns, sanitasi log | S4, S5, S6 | 1–2 hari |
| M2 | Data fetching & caching | Pagination konsisten + invalidasi + SW + hydration | F1, F2, F3, C1, C2 | 4–6 hari |
| M3 | UI/UX polish | Token desain, indikator loading, toast terpusat | U1, U2, U3 | 2–3 hari |
| M4 | Verifikasi & produksi | Regression gate, Lighthouse, update docs | (semua) | 2–3 hari |

**Aturan urutan:**

- M0 wajib sebelum rilis produksi (menutup seluruh P1 yang tersisa).
- M1 independen terhadap M0 tetapi sebaiknya digabung dalam satu siklus security.
- M2 dapat dimulai setelah M0 (tidak diblokir secara teknis, tetapi jangan mengubah strategi
  invalidasi sebelum rate limit/CSRF stabil agar acceptance test security tidak berubah).
- M3 independen; dapat dikerjakan paralel dengan M0–M2.
- F4 bersifat opsional dan didokumentasikan terpisah (lihat §7 Backlog).

---

## 3. Detail Tiap Milestone

### M0 — Security hardening (P1)

**Tujuan:** Menutup seluruh temuan **P1** keamanan yang tersisa agar aman di deployment
serverless/multi-instance dan terhadap CSRF.

**Temuan:** S1, S2, S3.

#### 3.0.1 — Rate limiter terdistribusi (S1)

1. Ganti `Map` in-memory pada `src/lib/security/rate-limit.ts` dengan store terpusat.
   - Opsi A (disarankan untuk Vercel): Upstash Redis (`@upstash/redis`) dengan token bucket atau
     fixed window berbasis key `rate:{name}:{identity}` dan TTL window.
   - Opsi B: pindahkan rate limit ke edge/gateway (Vercel `vercel.json` + middleware) bila semua
     traffic melewati satu titik.
2. Pertahankan kontrak fungsi `checkRateLimit(request, config, identity)` agar pemanggil tidak
   berubah; tambahkan versi async bila store Redis mengharuskan `await`.
3. Buat fallback in-memory hanya untuk development/test (bukan production).
4. Tambahkan test deterministik yang memverifikasi limit konsisten antar "instance" (dua klien
   berbagi store yang sama).

**Acceptance criteria:**

- Dua request dari key identik melewati limit yang sama meski diproses instance berbeda.
- `resetRateLimitForTests()` tetap membersihkan state saat test.
- Tidak ada regresi pada endpoint yang sudah memakai `rateLimit`.

#### 3.0.2 — Proteksi CSRF / origin allowlist (S2)

1. Di `withApiRoute` (`src/lib/api/route.ts`), tambahkan validasi origin untuk mutasi
   (`POST`/`PATCH`/`DELETE`) non-public:
   - Baca `Origin` (atau fallback `Referer`).
   - Cocokkan terhadap allowlist dari `APP_ORIGIN_ALLOWLIST`/`NEXT_PUBLIC_APP_URL`
     (seperti `src/lib/auth/redirect.ts`).
   - Tolak dengan `403 FORBIDDEN` bila origin tidak dikenal (kecuali development).
2. Pastikan cookie session Supabase ber-`SameSite=Lax`/`Strict` + `Secure` di production; jangan
   turunkan ke `None` tanpa keperluan lintas-situs.
3. Dokumentasikan keputusan di runbook.

**Acceptance criteria:**

- Request `POST` dengan `Origin` asing ditolak `403` tanpa mengeksekusi handler.
- Request dari origin yang diizinkan dan request tanpa `Origin` (tool non-browser) tetap dapat
  diproses dalam kondisi yang aman dan terdokumentasi.
- `npm run test:api` (API contract smoke) tetap lulus.

#### 3.0.3 — Perluasan rate limit pada mutasi authenticated (S3)

1. Terapkan opsi `rateLimit` pada mutasi sensitif yang belum dilindungi:
   - `cashiers` (create/update/status/transfer), `assessments`, `branches`, `outlets`,
     `periods` (open/close/roster), `users`, `categories`, `role-permissions`.
2. Tentukan limit per endpoint yang wajar untuk volume operasional (mis. create 20/10m,
   assessment 60/10m, transfer 10/10m) tanpa menghambat penggunaan normal.
3. Pastikan key memakai `identity` (user id) untuk endpoint authenticated agar tidak saling
   memblokir antar user.

**Acceptance criteria:**

- Seluruh mutasi ke domain data sensitif memiliki `rateLimit` terkonfigurasi.
- Endpoint tidak mengembalikan `429` pada pemakaian normal (diverifikasi via smoke test).

---

### M1 — Security hardening (P2)

**Tujuan:** Memperketat permukaan serangan yang lebih rendah (CSP, gambar, log).

**Temuan:** S4, S5, S6.

#### 3.1.1 — Perketat CSP (S4)

> **Catatan penting (2026-08-13):** menghapus `'unsafe-inline'` dari `script-src` pada produksi
> memutus render klien Next.js App Router (flight/hydration script memerlukan inline). Halaman
> hanya menampilkan skeleton `loading.tsx` sampai mekanisme nonce/hash diterapkan. Perbaikan ini
> **ditunda** sampai `proxy.ts`/`next.config.mjs` menyediakan CSP nonce.

1. Jangan hapus `'unsafe-inline'` dari `script-src` dahulu.
2. Terapkan CSP nonce via `proxy.ts`: set nonce per request + inject ke `next.config.mjs` headers.
3. Setelah nonce stabil, hapus `'unsafe-inline'` dari `script-src` dan verifikasi hydrate di Chrome & Safari.

**Acceptance criteria:**

- `script-src` memakai nonce per request, tanpa `'unsafe-inline'` di produksi.
- Build production dan smoke test tetap jalan di Chrome dan Safari (dashboard tidak stuck skeleton).

#### 3.1.2 — Batasi `remotePatterns` gambar (S5)

1. Ganti `hostname: '**'` pada `next.config.mjs` dengan domain eksplisit Supabase storage
   (`{supabaseUrl}`) dan, bila perlu, domain avatar pihak ketiga yang diizinkan.
2. Pertahankan entri localhost untuk development.

**Acceptance criteria:**

- Tidak ada pola hostname wildcard `**` pada `images.remotePatterns`.
- Semua signed URL Supabase (avatar/evidence) tetap termuat.

#### 3.1.3 — Sanitasi log server (S6)

1. Hapus atau saring `error.details`/`error.hint`/`error.message` mentah dari `console.error`,
   ganti dengan `safeMessage` atau field yang sudah diringkas (`code`, `status`).
2. Terapkan audit ke seluruh `console.error` di `src/app/api/**`.

**Acceptance criteria:**

- Tidak ada log yang mencetak detail internal PostgREST/Supabase mentah.
- Kontrak error ke klien tidak berubah; log tetap cukup untuk debugging (memakai `requestId`).

---

### M2 — Data fetching & caching

**Tujuan:** Menyamakan pagination, menstabilkan invalidasi, dan merapikan cache.

**Temuan:** F1, F2, F3, C1, C2.

#### 3.2.1 — Cursor pagination konsisten (F1, F3)

1. Refactor `src/lib/server/list-queries.ts` untuk `cashiers`, `branches`, `outlets`, `users` dari
   offset `page`+`range` menjadi keyset cursor (sort stabil + kolom tie-breaker unik).
2. Pertahankan backward compatibility: return `nextCursor` + `hasMore`, dan gunakan index dari
   `0053_list_pagination_indexes.sql` sesuai query nyata.
3. Migrasikan consumer `use-url-list` / komponen list untuk memakai cursor sebagai pengganti
   `page` bila menguntungkan; pastikan deep-link tetap didukung.

**Acceptance criteria:**

- Keempat resource memakai cursor pagination yang stabil tanpa duplicate/skip saat data berubah.
- List besar tidak memuat seluruh data sekaligus; `hasMore`/`nextCursor` benar.
- Unit test cursor untuk tiap resource lulus.

#### 3.2.2 — Stabilkan invalidasi mutation (F2)

1. Ubah `invalidateAppQueries` agar memunculkan refetch aktif (`refetchType` default/`'active'`)
   untuk daftar yang perlu segera konsisten, atau eksplisitkan pemanggilan `router.refresh()`.
2. Pastikan setiap mutasi yang mengubah daftar memicu refetch tanpa bergantung penuh pada navigasi.
3. Dokumentasikan kebijakan: query yang di-refetch aktif vs query yang cukup stale.

**Acceptance criteria:**

- Setelah mutasi berhasil, data tampil konsisten tanpa perlu refresh manual/navigasi.
- Tidak ada fetch berlebih pada query yang tidak terdampak.

#### 3.2.3 — Versi cache service worker otomatis (C1)

1. Ganti `CACHE_NAME` konstan dengan hash konten aset (mis. digest dari `PUBLIC_ASSETS`) atau
   bump otomatis saat build, bukan manual.
2. Pastikan activate menghapus cache lama seperti saat ini.

**Acceptance criteria:**

- Perubahan pada ikon/manifest memicu versi cache baru tanpa edit manual.
- Cache lama dibersihkan saat aktivasi.

#### 3.2.4 — Prefetch/Hydration (C2, opsional)

1. Evaluasi `HydrationBoundary` + `dehydrate` di server untuk daftar yang sering dibuka ulang.
2. Bila diterapkan, pastikan tidak mengekspos data lintas akun (tetap pakai `initialData` per user).

**Acceptance criteria (jika diimplementasikan):**

- Tidak ada fetch ganda saat hydration untuk list yang sudah dirender server.
- Tidak ada kebocoran data antar-akun.

---

### M3 — UI/UX polish

**Tujuan:** Merapikan konsistensi visual dan umpan balik.

**Temuan:** U1, U2, U3.

#### 3.3.1 — Token desain semantic (U1)

1. Ganti override `.bg-white { background-color: #11161d !important }` dengan token semantic
   (mis. `--color-surface` / utility `bg-surface` di `tailwind.config.ts`).
2. Refactor komponen yang memakai `bg-white` agar memakai token yang benar.
3. Pastikan tidak ada `!important` tersisa pada override global.

**Acceptance criteria:**

- Warna dark mode ditentukan oleh token, bukan override manual.
- Tidak ada blok `.bg-white` dengan `!important` di `globals.css`.

#### 3.3.2 — Standarisasi indikator loading (U2)

1. Konsistenkan: `isPending` untuk first load (belum ada data), `isFetching` untuk refresh data
   yang sudah ada.
2. Perbaiki `use-url-list.ts:140` agar tidak memetakan `isPending` ke `isFetching`.

**Acceptance criteria:**

- Tidak ada kedipan loading saat background refetch dengan data lama tersedia.
- Skeleton/placeholder konsisten di seluruh list.

#### 3.3.3 — Toast/banner terpusat (U3)

1. Buat store/context toast global (mis. di `QueryProvider` level) untuk pesan sukses/gagal.
2. Refactor `setToast`/`setMessage`/`setActionError` per-form menjadi pemakaian toast terpusat.

**Acceptance criteria:**

- Pesan umpan balik tampil konsisten dari satu komponen.
- `.toast-enter`/`.toast-exit` tetap dipakai dengan `prefers-reduced-motion` dihormati.

---

### M4 — Verifikasi & produksi

**Tujuan:** Memastikan seluruh perbaikan tervalidasi dan terdokumentasi.

1. Tambah/update regression test:
   - Security: origin/CSRF, rate limit terdistribusi, CSP/remotePatterns.
   - Fetching: cursor pagination, invalidasi mutation.
2. Jalankan seluruh gate: `npm run test:changelog`, `npm run lint`, `npm run typecheck`,
   `npm run test`, `npm run build`, `npm run test:api`, `npm run test:security`,
   `npm run test:ops`, `npm run test:types`.
3. Jalankan Playwright `test:e2e` (desktop + mobile) dan smoke test production build.
4. Ukur Lighthouse mobile (target ≥ 90) sebelum dan sesudah untuk memvalidasi tidak ada regresi.
5. Update `docs/CHANGELOG.md`, `src/content/updates.ts`, `docs/OPERATIONS_RUNBOOK.md`, dan
   `docs/TECHNICAL_AUDIT.md` (bagian residual risk) sesuai perubahan.
6. Bump versi ke `0.3.0`.

**Acceptance criteria:**

- Semua gate CI lokal lulus.
- E2E kritikal lulus (Chromium, mobile, WebKit mobile).
- Tidak ada temuan P0/P1 yang tersisa; seluruh P2 yang ditangani lolos acceptance criteria.
- Dokumentasi rilis konsisten (disahkan `npm run test:changelog`).

---

## 4. Release Gates (Tambahan dari `milestone.md` §3)

| Gate | Kondisi | Status |
|---|---|---|
| R1 | M0 selesai: rate limit terdistribusi + CSRF/origin aktif | Wajib sebelum produksi |
| R2 | M1 selesai: CSP tanpa `'unsafe-inline'` script + remotePatterns terbatas | Wajib |
| R3 | Pagination cursor untuk 4 resource selesai (F1) | Wajib |
| R4 | Invalidasi mutation stabil (F2) | Wajib |
| R5 | Seluruh gate otomatis lulus (test/typecheck/lint/build) | Wajib |
| R6 | Tidak ada secret/secret-state yang masuk changelog/log | Wajib |

---

## 5. Prosedur Agent

Setiap milestone:

1. Baca ulang diff dan pastikan file di luar scope tidak berubah.
2. Jalankan acceptance criteria milestone dan catat hasilnya di dokumen ini.
3. Hanya tandai **Selesai** bila semua acceptance criteria lulus.
4. Jika gagal, kembalikan status menjadi **Terblokir** dengan error yang dapat direproduksi dan
   jangan lanjut ke milestone berikutnya.
5. Perbarui changelog (`src/content/updates.ts`, `docs/CHANGELOG.md`) untuk perubahan yang
   berdampak pengguna sesuai `AGENTS.md`.

---

## 6. Estimasi Total

- M0: 3–4 hari
- M1: 1–2 hari
- M2: 4–6 hari
- M3: 2–3 hari
- M4: 2–3 hari

**Total:** ± 12–18 hari kerja (dapat berubah sesuai hasil verifikasi staging).

---

## 7. Backlog Opsional

- **F4 (N+1 guard)** — optimasi query gabungan (`getCurrentUser` + permission/branch dalam satu
  round-trip). Dampak saat ini dibatasi oleh React `cache()`, sehingga dapat ditunda.
- **C2 (HydrationBoundary)** — nilai tambah terbatas, tergantung kebutuhan performa lanjutan.
- **Observability** — central error tracking, structured logs, cron health check, metrics
  (dari `docs/TECHNICAL_AUDIT.md` Sprint 3).

---

## 8. Referensi

- `docs/AUDIT_FINDINGS_UIUX_FETCH_CACHE_SECURITY.md` — temuan yang menjadi dasar roadmap ini.
- `docs/TECHNICAL_AUDIT.md` — audit historis (residual risk & status remediasi).
- `docs/TANSTACK_QUERY_PERFORMANCE_ROADMAP.md` — konvensi roadmap cache/query.
- `milestone.md` — milestone produk keseluruhan dan release gates.
- `docs/OPERATIONS_RUNBOOK.md` — prosedur deployment/verifikasi produksi.