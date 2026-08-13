# Audit Menyeluruh — UI/UX, Data Fetching, Caching, dan Security

- **Tanggal audit**: 2026-08-13
- **Cakupan**: source code TypeScript (Next.js 16.3.0 App Router, React 19, TanStack Query v5),
  migrasi Supabase (0001–0058), `next.config.mjs`, `public/sw.js`, vercel config, dan script
  verifikasi.
- **Sifat**: audit statis berbasis source code dan hasil pencarian lokal. Bukan pengganti
  penetration test pada environment staging/production.

Dokumen ini melengkapi `docs/TECHNICAL_AUDIT.md` (audit security historis) dengan fokus yang lebih
dalam pada empat dimensi: **UI/UX**, **data fetching**, **caching**, dan **security**.

Roadmap perbaikan untuk seluruh temuan di dokumen ini tersedia di
`docs/AUDIT_REMEDIATION_ROADMAP.md`.

---

## 1. Ringkasan Eksekutif

Aplikasi sudah berada pada tingkat kedewasaan yang tinggi. Boundary keamanan database yang dulu
menjadi P0 (role escalation via RLS, policy write permisif, RPC state-changing exposed) **sudah
ditutup** oleh migrasi `0026`–`0056`, dan temuan lama P2 (zoom terblokir, secret via query string,
OAuth callback origin, validasi foto) **sudah diperbaiki**.

Tidak ada temuan **P0 (blocker)** baru yang teridentifikasi dari audit statis ini. Temuan yang
tersisa dominan **P1/P2** dan berkisar pada:

1. **Rate limiter bersifat in-memory** (tidak efektif di deployment multi-instance/serverless).
2. **CSRF** belum ada lapisan proteksi eksplisit (origin check / token) pada route mutasi yang
   mengandalkan cookie session.
3. **Pagination offset vs cursor tidak konsisten** antar resource.
4. **Invalidasi query pada mutasi** memakai `refetchType: 'none'` dan sering mengandalkan
   `router.refresh()`, sehingga ada potensi tampilan stale bila refresh gagal.
5. **CSP mengizinkan `'unsafe-inline'`** untuk script, dan `next/image` mengizinkan hostname `**`.

UI/UX relatif kuat: focus trap modal, penanganan `prefers-reduced-motion`, izin zoom browser, dan
perbaikan zoom input iOS sudah ada. Data fetching konsisten memakai TanStack Query dengan URL
sebagai single source of truth. Caching dibatasi ketat (satu cache referensi global + PWA publik).

---

## 2. Metodologi

- **Pembacaan langsung** file kunci: `src/lib/auth/*`, `src/lib/security/*`,
  `src/lib/supabase/*.ts`, `src/lib/api/route.ts`, `src/lib/cache/reference.ts`,
  `src/proxy.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `next.config.mjs`,
  `public/sw.js`, `.env.example`, `.gitignore`, dan sejumlah route handler.
- **Pencarian regex selektif** pada `supabase/migrations` (policy/grant/security definer),
  `src` (createAdminClient, service key, zod, rateLimit, invalidateQueries, dangerouslySetInnerHTML,
  sharp, magic bytes).
- **Graphify knowledge graph** (`god_nodes`) untuk memetakan abstraksi inti
  (`createClient`, `requireRole`, `requirePermission`, `createAdminClient`, helper UI).

Temuan diberi label severity: **P0** blocker, **P1** tinggi, **P2** menengah.

---

## 3. Temuan: UI/UX

### 3.1 Yang Sudah Baik

- **Modal aksesibel** — `src/components/ui/Modal.tsx:7-87` menerapkan focus trap penuh
  (simpan `previousFocus`, fokus elemen ber-`data-autofocus`, trap Tab/Shift+Tab, restore saat
  unmount, kunci scroll `body`, tutup saat Escape), plus `role="dialog"`, `aria-modal="true"`,
  dan `aria-labelledby`/`aria-label`.
- **Zoom browser diizinkan** — `src/app/layout.tsx:26-30` hanya menetapkan
  `width: 'device-width'` dan `initialScale: 1`; tidak ada `maximumScale`/`userScalable: false`.
  (Temuan lama P2-7 sudah diperbaiki.)
- **Zoom input iOS ditangani** — `src/app/globals.css:178-183` menaikkan font input ke 16px khusus
  perangkat `coarse`/`hover:none`, mencegah Safari melakukan auto-zoom.
- **`prefers-reduced-motion` dihormati** — `src/app/globals.css:160-169` menonaktifkan animasi
  toast/rank/spinner bagi pengguna yang meminta reduksi gerak.
- **`lang="id"`** ditetapkan pada `<html>` (`src/app/layout.tsx:34`).
- **Atribut ARIA dinamis** dipakai di beberapa komponen, mis.
  `aria-busy`/`aria-labelledby` pada `InviteList.tsx`, `CashierDetailTabs.tsx`.

### 3.2 Temuan

| # | Severity | Temuan | Evidence |
|---|---|---|---|
| U1 | P2 | **Token desain dark mode via override `!important`** — `.bg-white` dipaksa menjadi `#11161d !important` untuk "API dark" yang memakai `bg-white`. Ini rentan retak saat Tailwind menambah shade baru dan mengaburkan intent semantic token. | `src/app/globals.css:171-176` |
| U2 | P2 | **Indikator loading tidak seragam** — sebagian komponen memakai `isPending`, sebagian `isFetching` (`use-url-list.ts:140` mengembalikan `isPending: query.isFetching`). Untuk data background refetch, `isFetching` membuat UI berkedip loading padahal data lama masih valid. | `src/lib/client/use-url-list.ts:140`; `src/components/leaderboard/LeaderboardView.tsx` |
| U3 | P2 | **Belum ada komponen `Toast` terpusat** — umpan balik sukses/gagal tersebar sebagai state lokal per form (`setToast`, `setMessage`, `setActionError`). Konsistensi pesan dan penempatan belum terstandardisasi. | `BranchEditForm.tsx`, `OutletEditForm.tsx`, `NotificationList.tsx`, `AssessmentForm.tsx` |

> Tidak ditemukan penggunaan `dangerouslySetInnerHTML`/`innerHTML` di sisi render; output pengguna
> dirender oleh React secara escaped (lihat pula §6).

---

## 4. Temuan: Data Fetching

### 4.1 Arsitektur Klien Supabase

| Klien | File | Kegunaan |
|---|---|---|
| Browser (anon) | `src/lib/supabase/client.ts:4-9` | Hanya `auth.onAuthStateChange` di `QueryProvider`; tidak ada query DB dari komponen client langsung. |
| Server (session) | `src/lib/supabase/server.ts:7-30` | RLS-bound read/write untuk RSC dan route handler. |
| Admin (service-role) | `src/lib/supabase/server.ts:32-58` | Operasi bypass-RLS via RPC; menangani kunci `sb_secret_` baru (hapus header `Authorization` duplikat). |

Pemisahan file browser/server/admin ini **baik** dan mengurangi risiko pemakaian service key dari
client.

### 4.2 Yang Sudah Baik

- **URL sebagai single source of truth** — `use-url-list.ts` memetakan state list (pencarian,
  halaman, filter) ke query string; mendukung deep-link, back/forward, dan server-render awal
  (`initialData` + `keepPreviousData`).
- **Query keys terpusat** — `src/lib/client/query-keys.ts` mendefinisikan key terstruktur dan
  `invalidateAppQueries`.
- **Guard server-side konsisten** — semua Route Handler dibungkus `withApiRoute` yang memvalidasi
  session aktif; guard `requireUser`/`requireRole`/`requireAdmin`/`requirePermission`/
  `requireBranchAccess` dipakai pada endpoint sensitif.
- **Validasi input Zod** — mayoritas route mutasi memakai `zod` (`branchSchema`,
  `setupSchema`, `listQuerySchema`, dll.).
- **Kontrak error tersanitasi** — `src/lib/api/route.ts:51-58` (`safeMessage`) menyembunyikan
  pesan teknis (PostgREST, constraint, JWT) dari klien dan mengembalikan `requestId`.

### 4.3 Temuan

| # | Severity | Temuan | Evidence |
|---|---|---|---|
| F1 | P1 | **Pagination tidak konsisten** — `branch`/`cashier`/`outlet`/`users` memakai offset `page`+`limit`, sementara `leaderboard`, `mentoring`, `notifications`, `invites` sudah memakai cursor/infinite scroll. List panjang dengan offset akan menurun performa. | `src/lib/server/list-queries.ts` (`getPageRange`) vs `src/lib/leaderboard/cursor.ts`, `src/lib/notifications/cursor.ts` |
| F2 | P2 | **Invalidasi memakai `refetchType: 'none'`** — `invalidateAppQueries` hanya menandai query stale tanpa refetch otomatis. Komponen mengandalkan `router.refresh()` (server components) untuk memuat data baru; jika tidak dipanggil, daftar bisa tetap stale sampai user navigasi. | `src/lib/client/query-keys.ts:23-29`; pemanggil `PeriodForm.tsx`, `ClosePeriodButton.tsx` |
| F3 | P2 | **Query user terpusat, tapi tanpa pagination di beberapa endpoint** — `queryUsers` masih offset; daftar user/notifikasi dapat tumbuh besar. | `src/lib/server/list-queries.ts:123-137` |
| F4 | P2 | **`N+1` kecil pada beberapa guard/query** — `requireBranchAccess` dan `getRolePermissions` memanggil DB terpisah setelah `getCurrentUser` (masing-masing di-`cache()` per request via React `cache`, jadi dampak dibatasi). | `src/lib/auth/guards.ts:60-74`, `src/lib/auth/permissions-server.ts:18-24` |

---

## 5. Temuan: Caching

### 5.1 Yang Sudah Baik

- **Satu cache referensi global, dibatasi ketat** —
  `src/lib/cache/reference.ts:22-44` memakai `unstable_cache` (TTL 60s, tag
  `reference:period-options:v1`) hanya untuk `period` options dengan kolom allowlist
  (`id, label, status, start_date, end_date`). Tidak ada data user/branch/session dalam cache
  lintas-user — sesuai kontrak `docs/CACHE_REGISTRY.md`.
- **Invalidasi eksplisit** — `revalidatePeriodOptions()` (`revalidateTag(..., 'max')`) dipanggil pada
  mutasi periode/kategori terkait.
- **TanStack Query default sehat** — `staleTime` 30s, `gcTime` 5m, `refetchOnWindowFocus: false`,
  `retry: false` (`QueryProvider.tsx:7-23`).
- **Clear cache saat auth berubah** — `QueryProvider.tsx:29-32` memanggil `queryClient.clear()`
  pada `SIGNED_IN`/`SIGNED_OUT`, mencegah kebocoran data antar-akun.
- **PWA publik-saja** — `public/sw.js` hanya meng-cache aset public (manifest + ikon), menolak
  `navigate` dan non-GET, dan tidak menyentuh API. Registrasi hanya pada `production`
  (`ServiceWorkerRegistration.tsx:7-10`). Boundari ini mencegah cache halaman privat.

### 5.2 Temuan

| # | Severity | Temuan | Evidence |
|---|---|---|---|
| C1 | P2 | **SW tidak meng-invalidasi cache API/halaman** — design-nya memang publik-saja, tetapi versi aset dikunci pada `CACHE_NAME` konstan (`kpi-kasir-public-v3`); saat ikon/manifest berubah, bump versi harus manual. | `public/sw.js:1-10` |
| C2 | P2 | **Tidak ada `prefetchQuery`/`hydrationBoundary` server→client** — data awal dikirim sebagai `initialData` komponen, bukan via dehydrate/rehydrate global. Ini sederhana dan aman, tetapi duplikasi data bisa terjadi untuk daftar yang sama dibuka dari tempat berbeda. | `use-url-list.ts:63-72` |

> Tidak ditemukan `staleTime: Infinity` / cache query yang menyimpan data user/role lintas akun
> yang berisiko kebocoran.

---

## 6. Temuan: Security

### 6.1 Status Temuan Historis (telah diperbaiki)

Temuan P0/P1 pada `docs/TECHNICAL_AUDIT.md` sudah ditangani, dibuktikan dari migrasi:

- **P0-1 role escalation** — `users_update_own`/`users_update_admin` di-drop dan
  `revoke insert, update, delete on users from authenticated` (`0027_lockdown_user_access.sql`); mutasi
  profil/admin lewat RPC service-role (`admin_update_user`) yang sudah di-revoke dari
  `anon, authenticated`.
- **P0-2 policy write permisif** — policy `*_write_server_guarded` (`0007`) di-drop/diganti policy
  operation-level (`0028_operation_level_write_policies.sql`, `0043_period_snapshot_source.sql`) dan
  `active_user_guard` restrictive (`0027`).
- **P0-3 RPC state-changing exposed** — `recalculate_cashier_period_score`, `close_period`,
  `open_period` di-`revoke all ... from public, anon, authenticated` dan tetap `service_role` saja
  (`0026`, `0044`, `0046`, `0047`, `0048`).
- **P0-4 leaderboard lintas cabang** — `le_select_auth` di-drop, diganti scope branch
  (`0029_leaderboard_and_column_scope.sql`) plus upsert snapshot.
- **P1-5 `Database = any`** — diganti generated types + `verify-database-types.mjs`.

### 6.2 Yang Sudah Baik

- **Service-role client tersegregasi** — `createAdminClient` hanya dipakai dari modul server
  (`src/lib/invites.ts`, `src/app/api/**`, `src/lib/cache/reference.ts`, `src/lib/dashboard/snapshot.ts`).
  Tidak ada client component (`"use client"`) yang mengimpornya. Browser client (`client.ts`) hanya
  memakai anon key.
- **Cron secret via header + timing-safe comparison** —
  `src/lib/cron/auth.ts:3-28` menerima secret dari header (`x-cron-secret`/`Authorization: Bearer`)
  dengan `timingSafeEqual`; secret kosong ditolak. (P2-6 lama diperbaiki.)
- **OAuth callback origin allowlist** — `src/app/auth/callback/route.ts:11-21` +
  `src/lib/auth/redirect.ts` memvalidasi `x-forwarded-host` terhadap `APP_ORIGIN_ALLOWLIST`.
- **Setup race-safe + kompensasi** — `reserve_setup`/`finalize_setup`/`release_setup` RPC service-role
  (`0032`, `0033`, `0054`), dengan `deleteUser` kompensasi bila finalisasi gagal
  (`src/app/api/setup/route.ts:121-130`), plus rate limit.
- **Validasi gambar via magic bytes** — `src/lib/storage/avatar-validation.ts` dan
  `mentoring-evidence-validation.ts` memakai `sharp` (`failOn: 'error'`), re-encode, strip metadata,
  batasi dimensi/ukuran. (P2-5 lama diperbaiki.)
- **Security headers lengkap** — `next.config.mjs:47-58` menetapkan CSP, `X-Content-Type-Options`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`,
  `X-Permitted-Cross-Domain-Policies`.
- **Penanganan error tidak bocor** — `safeMessage` menyaring istilah teknis; setup route hanya mencatat
  *diagnostics* kunci (jenis + fingerprint SHA256 16-hex + panjang), bukan nilai key
  (`src/app/api/setup/route.ts:18-36`).
- **`x-request-id` divalidasi** terhadap regex ketat sebelum dipercaya
  (`src/lib/api/route.ts:10-13`).
- **`.env.local` / `.env` di-gitignore** (`# env files` di `.gitignore:30-35`); `.env.example` hanya
  placeholder. Tidak ditemukan secret ter-hardcode di source (regex `sk-`, `sb_secret_`, `eyJ`,
  `BEGIN PRIVATE KEY` → tidak ada match literal).

### 6.3 Temuan Baru

| # | Severity | Temuan | Evidence / Dampak |
|---|---|---|---|
| S1 | P1 | **Rate limiter in-memory (per-instance)** — bucket tersimpan di `Map` dalam proses. Pada deployment serverless/multi-instance (Vercel), penyimpanan tidak dibagi sehingga limit dapat di-bypass dengan banyak instance atau restart. | `src/lib/security/rate-limit.ts:12` `const buckets = new Map()`. (Sama dengan residual risk lama, belum diatasi.) |
| S2 | P1 | **Tidak ada proteksi CSRF eksplisit** — route mutasi mengautentikasi via cookie session Supabase SSR, tetapi tidak ada validasi `Origin`/`Referer` atau token CSRF. Jika cookie session ber-`SameSite=Lax`/`None`, mutasi authenticated berpotensi dipicu lintas-situs. | Tidak ditemukan `origin`/`referer` check atau token CSRF di `withApiRoute` (`src/lib/api/route.ts`) maupun guard. |
| S3 | P2 | **Rate limit hanya pada 6 endpoint** — mayoritas mutasi authenticated (`cashiers`, `assessments`, `branches`, `outlets`, `periods`, `users`, `categories`, `role-permissions`) tidak memakai opsi `rateLimit`. | Hanya `setup`, `invite-create`, `invite-accept`, `cashier-avatar`, `mentoring-evidence-upload`, `web-vitals` yang mengaktifkan `rateLimit` (hasil pencarian `rateLimit:`). |
| S4 | P2 | **CSP mengizinkan `'unsafe-inline'` untuk script** — melemahkan mitigasi XSS; inline script (walaupun tidak dipakai) diizinkan. | `next.config.mjs:34` `script-src 'self' 'unsafe-inline'...`. |
| S5 | P2 | **`next/image` mengizinkan hostname wildcard `https://**`** — optimizer gambar dapat diminta memuat host arbitrer. Risiko terbatas (hanya proses gambar), tetapi memperluas permukaan SSRF. | `next.config.mjs:11-15` `remotePatterns` `hostname: '**'`. |
| S6 | P2 | **Beberapa `console.error` mencatat `error.details`/`error.hint` mentah** — bisa memuat detail PostgREST/internal ke log server. Tidak diekspos ke klien (aman untuk pengguna), tetapi perlu disaring untuk kebersihan log. | `src/app/api/branches/route.ts:68-73`. |

> Catatan S2: perlu verifikasi konfigurasi cookie Supabase (`SameSite`). Supabase SSR umumnya
> menetapkan cookie dengan `SameSite=Lax`; bila demikian, risiko CSRF menurun tetapi tetap ada untuk
> request `GET` yang mengubah state (tidak ada di codebase ini — semua mutasi memakai `POST`/`PATCH`)
> dan perlu tetap dikonfirmasi pada environment staging.

---

## 7. Matriks Risiko Ringkas

| Area | P0 | P1 | P2 |
|---|---|---|---|
| UI/UX | 0 | 0 | 3 (U1–U3) |
| Data fetching | 0 | 1 (F1) | 3 (F2–F4) |
| Caching | 0 | 0 | 2 (C1–C2) |
| Security | 0 | 2 (S1, S2) | 4 (S3–S6) |

---

## 8. Rekomendasi & Roadmap

### Sprint 0 — Security hardening (prioritas)

1. **S1**: ganti rate limiter in-memory dengan store terpusat (mis. Redis/Upstash) atau batas di
   edge/API gateway, agar limit konsisten multi-instance.
2. **S2**: tambahkan validasi `Origin`/`Referer` allowlist di `withApiRoute` untuk semua mutasi, dan
   pastikan cookie session `SameSite=Lax/Strict` + `Secure` di production. Pertimbangkan token
   double-submit untuk endpoint paling sensitif.
3. **S3**: terapkan `rateLimit` pada mutasi authenticated sensitif (`cashiers`, `users`, `periods`,
   `role-permissions`, `categories`).
4. **S4/S5**: perkecil CSP `script-src` (hapus `'unsafe-inline'` bila memungkinkan) dan batasi
   `remotePatterns` ke domain Supabase storage eksplisit, bukan `**`.

### Sprint 1 — Konsistensi data & UX

1. **F1**: standarkan cursor pagination (keyset) untuk `cashiers`, `branches`, `outlets`, `users`
   agar konsisten dengan resource lain; tambahkan index sesuai query nyata.
2. **F2**: ubah strategi invalidasi agar `invalidateQueries` memicu refetch (`refetchType` aktif)
   atau pastikan `router.refresh()` selalu dipanggil setelah tiap mutasi yang mengubah daftar.
3. **U1**: pindahkan override `!important` `.bg-white` ke token semantic (mis. `surface` variable),
   hindari override global.
4. **U2**: standarkan indikator loading (`isPending` untuk first-load, `isFetching` untuk background).
5. **U3**: perkenalkan store toast/banner terpusat untuk konsistensi umpan balik.
6. **S6**: saring `console.error` agar tidak mencatat `details`/`hint` mentah.

### Sprint 2 — Observability & hardening lanjutan

1. **C1**: buat proses bump versi cache SW otomatis (hash asset) daripada konstan manual.
2. **C2**: evaluasi `HydrationBoundary` bila ingin menghindari duplikasi data awal.
3. Tambahkan Lighthouse baseline + distributed rate-limit test pada staging.

---

## 9. Kesimpulan

Aplikasi telah menutup hampir seluruh risiko keamanan kritis yang pernah teridentifikasi dan
memiliki fondasi UI, data-fetching, serta caching yang disiplin. Audit statis ini **tidak menemukan
P0 baru**. Fokus remediasi berikutnya adalah dua P1 yang tersisa — **rate limiter terdistribusi**
dan **CSRF/origin hardening** — diikuti penyelarasan pagination, invalidasi query, dan token
desain. Semua rekomendasi bersifat non-breaking dan dapat dieksekusi secara bertahap.