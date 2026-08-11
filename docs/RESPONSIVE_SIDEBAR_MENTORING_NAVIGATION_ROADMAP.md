# Roadmap: Sidebar Tetap dan Navigasi Pendampingan

Dokumen ini menjadi sumber kerja agent berikutnya untuk memperbaiki perilaku sidebar desktop dan
memindahkan akses Pendampingan dari halaman `Lainnya` ke navigasi utama. Implementasi harus
mempertahankan authorization, performa first load, scroll restoration, dan perilaku responsive yang
sudah ada.

Agent wajib memperbarui status, bukti pengujian, keputusan, dan handoff di dokumen ini setelah setiap
milestone lulus. Milestone tidak boleh ditandai selesai hanya berdasarkan review kode.

## 1. Identitas

| Field                         | Nilai                                                             |
| ----------------------------- | ----------------------------------------------------------------- |
| Status                        | `IMPLEMENTED_PENDING_VALIDATION`                                  |
| Baseline commit               | `8e811ec`                                                         |
| Dibuat                        | 2026-08-11 WIB                                                    |
| Framework                     | Next.js App Router 16.3.0, React 19, Tailwind CSS 3.4             |
| Area utama                    | `AppShellClient`, halaman Menu, permission, responsive navigation |
| Migrasi database              | Tidak diperlukan                                                  |
| Dependensi baru               | Tidak diperlukan                                                  |
| Perubahan lokal di luar scope | `supabase/config.toml` milik user, jangan diubah atau di-stage    |

## 2. Ringkasan Audit

### 2.1 Mengapa sidebar ikut bergulir

Sidebar desktop di `src/components/layout/AppShellClient.tsx` saat ini merupakan flex child biasa:

```tsx
<aside className="hidden shrink-0 ... md:flex md:w-60 md:flex-col">
```

Container aplikasi hanya memakai `min-h-screen`. Tidak ada `position: sticky`, `position: fixed`,
tinggi viewport, atau area overflow khusus pada sidebar. Scroll tetap dimiliki document/body. Karena
itu seluruh flex row, termasuk sidebar, bergerak saat halaman panjang digulir. Ini perilaku CSS yang
sesuai dengan struktur saat ini, bukan bug browser.

Header tidak mengalami masalah yang sama karena sudah memakai `sticky top-0`. Bottom navigation
mobile juga tetap terlihat karena memakai `fixed bottom-0`.

### 2.2 Posisi Pendampingan saat ini

- `Pendampingan` hanya menjadi kartu pertama pada `src/app/(app)/menu/page.tsx`.
- Sidebar desktop dan bottom navigation mobile dirender dari satu array `navItems` di
  `AppShellClient`.
- Array tersebut saat ini berisi Beranda, Nilai, Ranking, dan Lainnya.
- Visibilitas fitur sudah dikendalikan oleh permission `mentoring`.
- Halaman `/mentoring` tetap memanggil `requirePermission('mentoring')`, sehingga route guard sudah
  menjadi lapisan authorization yang benar.

### 2.3 Risiko yang harus dijaga

1. Menambah link dengan `prefetch` bernilai `true` dapat melakukan full prefetch route dinamis di
   Next.js 16.3.0. Hal ini berpotensi menambah query saat first load.
2. Lima item adalah batas yang masih wajar untuk bottom navigation. Label `Pendampingan` harus diuji
   pada lebar 320 px agar tidak terpotong atau menggeser layout.
3. Mengubah shell menjadi `h-dvh overflow-hidden` dan membuat `<main>` sebagai scroll container baru
   dapat merusak browser scroll restoration, anchor, focus reveal, dan perilaku back/forward.
4. Menyembunyikan menu berdasarkan permission hanya aturan UX. Route dan API tetap wajib memeriksa
   authorization sendiri.

## 3. Keputusan Arsitektur

### D-1: Gunakan sticky sidebar, bukan fixed sidebar

Sidebar desktop memakai `position: sticky`, `top: 0`, tinggi viewport dinamis, dan `self-start`.
Document/body tetap menjadi pemilik scroll halaman. Area daftar menu di dalam sidebar boleh memiliki
scroll sendiri hanya jika tinggi viewport tidak cukup.

Alasan:

- sesuai dengan shell berpusat dan `max-w-7xl` yang sudah ada;
- tidak membutuhkan kalkulasi offset dan lebar seperti `fixed`;
- tidak memindahkan scroll ownership dari browser;
- lebih aman untuk back/forward scroll restoration dan deep link.

### D-2: Gunakan bottom navigation mobile, bukan bottom sheet overlay

Istilah komponen yang sudah ada adalah bottom navigation. Pendampingan menjadi tujuan utama kelima
pada mobile dan item langsung pada sidebar desktop. Jangan membuat bottom sheet modal baru.

Bottom sheet tidak dipilih karena Pendampingan merupakan destination utama, bukan aksi kontekstual.
Overlay juga akan menambah state buka/tutup, focus trap, scroll lock, dan duplikasi dengan halaman
`Lainnya` tanpa manfaat navigasi yang jelas.

### D-3: Pendampingan dipindahkan, bukan diduplikasi

Setelah link langsung tersedia, kartu Pendampingan di `/menu` dihapus. Deep link `/mentoring`, tombol
dashboard, dan link lain yang memang kontekstual tetap dipertahankan.

### D-4: Permission tetap menjadi sumber visibilitas dan akses

Link Pendampingan hanya dirender bila `hasPermission(permissions, 'mentoring')` bernilai benar.
Jangan menambahkan pengecualian berdasarkan nama role di client. `requirePermission('mentoring')`
pada halaman dan pemeriksaan API tidak boleh dihapus atau dilonggarkan.

### D-5: Prefetch Pendampingan menggunakan mode default/auto

Pertahankan strategi link lama agar scope tetap sempit, tetapi jangan menyalin shorthand `prefetch`
yang berarti `true` ke link Pendampingan. Gunakan `prefetch={null}` atau bentuk ekuivalen yang valid
menurut dokumentasi Next.js lokal agar route dinamis hanya memakai prefetch default/partial.

Referensi wajib sebelum implementasi:

- `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`
- `node_modules/next/dist/docs/01-app/02-guides/testing/playwright.md`

## 4. Perilaku Target

| Kondisi                                       | Sidebar desktop                                                 | Bottom navigation mobile                       | Halaman `/menu`                      |
| --------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------ |
| User memiliki `mentoring`                     | Pendampingan terlihat dan aktif pada route turunannya           | Pendampingan terlihat sebagai item kelima      | Kartu Pendampingan tidak ada         |
| User tidak memiliki `mentoring`               | Pendampingan tidak terlihat                                     | Pendampingan tidak terlihat; grid menyesuaikan | Kartu Pendampingan tidak ada         |
| Halaman panjang digulir                       | Sidebar tetap menempel di bagian atas viewport                  | Tidak berlaku                                  | Konten tetap memakai document scroll |
| Viewport desktop pendek                       | Brand tetap terlihat; daftar nav dapat digulir di dalam sidebar | Tidak berlaku                                  | Tidak ada item terpotong permanen    |
| Route `/mentoring/new` atau `/mentoring/[id]` | Item Pendampingan aktif                                         | Item Pendampingan aktif                        | Lainnya tidak aktif                  |
| Permission dimatikan                          | Link hilang setelah permission server terbaru dirender          | Link hilang                                    | Direct route tetap ditolak guard     |

Urutan navigasi utama yang dikunci:

1. Beranda
2. Nilai
3. Ranking
4. Pendampingan
5. Lainnya

Untuk mobile, gunakan label visual pendek `Damping` bila label penuh tidak muat pada lima kolom.
Accessible name tetap `Pendampingan`. Sidebar desktop harus selalu menampilkan label penuh.

## 5. Goals

1. Sidebar desktop tetap berada di viewport ketika konten halaman digulir.
2. Scroll halaman tetap menggunakan document/body dan browser behavior tetap normal.
3. Pendampingan dapat dicapai satu klik dari navigasi utama sesuai permission.
4. Tidak ada duplikasi Pendampingan pada halaman Lainnya.
5. Bottom navigation stabil pada 320 px sampai desktop breakpoint, termasuk safe area.
6. Active state, keyboard focus, screen reader label, dan permission filtering tetap benar.
7. Penambahan link tidak mengembalikan bottleneck first load yang baru selesai diperbaiki.
8. Seluruh regression gate dan build production lulus sebelum sign-off.

## 6. Non-goals

- Mengubah desain seluruh shell, header, kartu Menu, atau halaman Pendampingan.
- Membuat drawer, bottom sheet modal, atau library navigasi baru.
- Mengubah role, daftar permission, RLS, schema database, atau API Pendampingan.
- Memindahkan logout/notifikasi ke sidebar.
- Mengubah seluruh strategi prefetch aplikasi tanpa bukti pengukuran terpisah.
- Menambah animasi, dependency, cache, service worker rule, atau loading global.
- Mengubah `supabase/config.toml` yang sudah dimodifikasi user.

## 7. Invariant Wajib

1. `requirePermission('mentoring')` tetap aktif pada semua halaman Pendampingan yang relevan.
2. API mutation/read Pendampingan tetap memeriksa permission dan scope cabang.
3. Sidebar dan bottom navigation memakai sumber item serta urutan yang sama.
4. Header, sidebar, dan bottom navigation tidak masuk ke loading skeleton route.
5. Tidak ada `overflow: hidden` baru pada `html`, `body`, atau root shell.
6. Tidak ada nested scroll baru pada `<main>`.
7. Safe area mobile `env(safe-area-inset-bottom)` tetap dipertahankan.
8. Link memakai `aria-current="page"` hanya pada destination yang aktif.
9. Hidden navigation pada breakpoint lain tidak boleh dapat difokuskan.
10. Tidak ada data private, token, atau identitas user di log/screenshot bukti.

## 8. Rancangan Implementasi

### 8.1 Sticky sidebar dan scroll ownership

Perubahan minimal yang dituju pada `<aside>`:

```tsx
<aside className="hidden shrink-0 ... md:sticky md:top-0 md:flex md:h-dvh md:w-60 md:self-start md:flex-col md:overflow-hidden">
```

Catatan:

- `h-dvh` mengikuti tinggi viewport dinamis. Dukungan browser target wajib diverifikasi pada RN-3.
- Brand/header sidebar diberi `shrink-0` agar tidak mengecil pada viewport pendek.
- `<nav>` sidebar memakai `min-h-0 flex-1 overflow-y-auto` agar daftar panjang dapat digulir tanpa
  menggerakkan brand.
- Jangan menambahkan `overflow` pada ancestor sticky tanpa menguji dampaknya. Ancestor dengan
  overflow tertentu dapat mengubah containing block dan membuat sticky gagal.
- Jangan memakai `fixed` kecuali hasil spike membuktikan sticky tidak dapat memenuhi acceptance
  criteria. Perubahan keputusan harus dicatat di Log Keputusan.

### 8.2 Registry navigasi

Pertahankan satu registry kecil di `AppShellClient`; jangan membuat abstraction lintas module hanya
untuk lima item. Tambahkan properti hanya bila diperlukan:

```ts
type PrimaryNavItem = {
  href: string;
  label: string;
  mobileLabel?: string;
  icon: LucideIcon;
  permission?: Permission;
  prefetch: true | null;
};
```

Item Pendampingan yang dituju:

```ts
{
  href: '/mentoring',
  label: 'Pendampingan',
  mobileLabel: 'Damping',
  icon: ClipboardCheck,
  permission: 'mentoring',
  prefetch: null,
}
```

Aturan implementasi:

- desktop merender `label`;
- mobile merender `mobileLabel ?? label`;
- accessible name link mobile tetap memakai `label` penuh;
- nilai prefetch diberikan per item agar item lama tidak berubah tanpa sengaja;
- filter tetap memakai `hasPermission` sebelum grid column dihitung;
- `isActive('/mentoring')` yang sudah berbasis `startsWith` dipertahankan.

Jika agent menemukan bahwa label penuh terbukti muat pada 320 px tanpa truncate, agent boleh memakai
`Pendampingan` pada mobile. Bukti screenshot 320 px harus dicatat. Jangan mengecilkan seluruh font
navigation, memakai `break-all`, atau membiarkan label terpotong sebagai solusi.

### 8.3 Landmark dan aksesibilitas

Gunakan nama landmark yang tidak ambigu:

- sidebar: `aria-label="Navigasi utama desktop"`;
- bottom navigation: `aria-label="Navigasi utama mobile"`;
- account action tetap `aria-label="Aksi akun"`.

Setiap link harus memiliki focus ring yang terlihat, target sentuh minimal 44 x 44 px, icon tidak
shrink, dan active state tidak bergantung pada warna saja bila hasil audit aksesibilitas meminta
indikator tambahan. Jangan menambahkan tooltip hover sebagai satu-satunya penjelasan di mobile.

### 8.4 Penghapusan item lama

Pada `src/app/(app)/menu/page.tsx`:

1. Hapus object kartu `/mentoring` dari `items`.
2. Hapus import `ClipboardCheck` bila tidak lagi dipakai.
3. Pertahankan filter permission untuk item lainnya.
4. Jangan mengubah urutan, deskripsi, atau permission item lain.
5. Pastikan halaman Menu tidak memiliki whitespace/layout regression setelah jumlah item berkurang.

## 9. Urutan Milestone

| ID   | Tujuan                                                  | Status                           | Dependensi |
| ---- | ------------------------------------------------------- | -------------------------------- | ---------- |
| RN-0 | Baseline, contract, dan matriks uji                     | `IMPLEMENTED_PENDING_VALIDATION` | -          |
| RN-1 | Membuat sidebar desktop sticky dengan scroll yang benar | `IMPLEMENTED_PENDING_VALIDATION` | RN-0       |
| RN-2 | Memindahkan Pendampingan ke navigasi utama              | `IMPLEMENTED_PENDING_VALIDATION` | RN-0       |
| RN-3 | Regression responsive, permission, dan accessibility    | `IMPLEMENTED_PENDING_VALIDATION` | RN-1, RN-2 |
| RN-4 | Performance gate, dokumentasi, dan rollout              | `IMPLEMENTED_PENDING_VALIDATION` | RN-3       |

Hanya satu milestone boleh berstatus `IN_PROGRESS`. RN-1 dan RN-2 boleh dibuat dalam commit yang sama
karena menyentuh file shell yang sama, tetapi masing-masing tetap harus memiliki bukti acceptance
criteria sendiri.

## 10. RN-0: Baseline, Contract, dan Matriks Uji

**Tujuan:** merekam perilaku sebelum perubahan dan memastikan agent bekerja dari state terbaru.

**Langkah:**

1. Baca `AGENTS.md`, dokumen Next.js lokal pada D-5, roadmap performa first load, dan file pada File
   Map.
2. Jalankan `git status --short` dan catat semua perubahan user. Jangan menyentuh
   `supabase/config.toml`.
3. Catat commit baseline aktual. Bila berbeda dari `8e811ec`, jelaskan perubahan yang relevan sebelum
   melanjutkan.
4. Ambil screenshot desktop halaman panjang sebelum scroll dan setelah scroll.
5. Catat nilai `window.scrollY`, posisi bounding box sidebar, tinggi viewport, dan tinggi document.
6. Ambil screenshot bottom navigation pada 320 x 568 dan 390 x 844.
7. Catat item navigasi untuk admin, manager, supervisor, dan role dengan permission `mentoring`
   dimatikan.
8. Rekam request RSC/query yang muncul saat membuka dashboard production build sebelum interaksi.

**Acceptance criteria:** akar masalah sticky, baseline responsive, role matrix, dan baseline request
telah dicatat pada Bukti Milestone.

**Test gate:** tidak ada source code yang berubah; `git diff --check` lulus untuk dokumen yang
diperbarui.

## 11. RN-1: Sticky Sidebar Desktop

**Tujuan:** menjaga sidebar terlihat tanpa mengubah scroll owner halaman.

**Langkah:**

1. Tambahkan sticky positioning, viewport height, dan self alignment pada sidebar mulai breakpoint
   `md`.
2. Kunci brand sebagai flex item `shrink-0`.
3. Jadikan hanya daftar nav sidebar yang `overflow-y-auto` saat viewport pendek.
4. Pertahankan content column, sticky header, max width, border, dan mobile bottom navigation.
5. Uji halaman pendek dan panjang. Gunakan halaman Pendampingan/daftar panjang yang realistis, bukan
   dummy DOM production.
6. Uji scroll mouse, trackpad, keyboard PageDown, dan fokus link yang berada di bagian bawah sidebar.
7. Pastikan browser back/forward memulihkan posisi content scroll sebagaimana baseline.

**Acceptance criteria:**

- setelah document digulir, posisi atas sidebar tetap 0 sampai toleransi 1 px;
- `window.scrollY` berubah dan `<main>` bukan scroll container baru;
- header content tetap sticky dan tidak menimpa sidebar;
- brand tetap terlihat pada desktop dengan tinggi 600 px;
- nav sidebar dapat digulir bila kontennya melebihi tinggi yang tersedia;
- tidak ada horizontal scrollbar atau content shift.

**Test gate:** typecheck, lint, build, Playwright desktop scroll test, screenshot 768 x 1024,
1024 x 600, dan 1440 x 900.

## 12. RN-2: Navigasi Utama Pendampingan

**Tujuan:** membuat Pendampingan dapat dicapai langsung dan menghapus duplikasi dari Lainnya.

**Langkah:**

1. Tambahkan icon `ClipboardCheck` dari `lucide-react` ke registry nav.
2. Tambahkan item `/mentoring` setelah Ranking dan sebelum Lainnya.
3. Terapkan permission `mentoring`, active state yang ada, label desktop penuh, dan label mobile yang
   sudah diputuskan.
4. Terapkan prefetch default/auto khusus Pendampingan; jangan full-prefetch data route dinamis tanpa
   pengukuran.
5. Hapus kartu Pendampingan dan import yang tidak terpakai dari halaman `/menu`.
6. Beri landmark desktop/mobile nama yang berbeda.
7. Jangan mengubah route, query, form, API, atau authorization Pendampingan.

**Acceptance criteria:**

- user berizin melihat Pendampingan pada sidebar dan bottom navigation;
- user tanpa izin tidak melihat link pada kedua breakpoint;
- `/mentoring`, `/mentoring/new`, dan `/mentoring/[id]` mengaktifkan item Pendampingan;
- `/menu` tidak lagi menampilkan kartu Pendampingan;
- bottom navigation memiliki maksimal lima item dan grid menyesuaikan setelah permission filter;
- semua label terlihat utuh pada 320 px tanpa overlap atau truncate;
- klik/tap tetap memakai client navigation dan feedback muncul sebagaimana baseline performa.

**Test gate:** typecheck, lint, unit test permission yang ada, Playwright navigation test, keyboard
smoke, dan screenshot mobile.

## 13. RN-3: Regression Responsive, Permission, dan Accessibility

**Tujuan:** membuktikan implementasi benar pada breakpoint, role, dan metode input utama.

### 13.1 Matriks viewport

| Viewport   | Mode yang diharapkan | Pemeriksaan utama                                         |
| ---------- | -------------------- | --------------------------------------------------------- |
| 320 x 568  | Mobile               | 5 item muat, label utuh, safe area, tidak overlap content |
| 390 x 844  | Mobile               | touch target, active state, navigasi Pendampingan         |
| 767 x 900  | Mobile               | hanya bottom navigation terlihat                          |
| 768 x 1024 | Desktop `md`         | hanya sidebar terlihat dan sticky                         |
| 1024 x 600 | Desktop pendek       | brand tetap terlihat, nav internal scroll                 |
| 1440 x 900 | Desktop lebar        | sidebar sticky, content tetap terpusat                    |

Uji 200% browser zoom pada desktop. Perubahan effective CSS viewport boleh mengaktifkan layout
mobile, tetapi sidebar dan bottom navigation tidak boleh tampil bersamaan atau menghilang bersamaan.

### 13.2 Matriks permission

| Profil                        | Permission `mentoring` | Link terlihat                     | Direct route                |
| ----------------------------- | ---------------------- | --------------------------------- | --------------------------- |
| Admin aktif                   | Ya                     | Ya                                | Diizinkan                   |
| Manager aktif                 | Ya                     | Ya                                | Diizinkan dan branch scoped |
| Supervisor aktif              | Ya                     | Ya                                | Diizinkan dan branch scoped |
| Manager/supervisor toggle off | Tidak                  | Tidak                             | Ditolak guard               |
| User nonaktif                 | Tidak relevan          | Tidak boleh mencapai shell privat | Ditolak                     |

### 13.3 Automation yang disarankan

Tambahkan `e2e/responsive-navigation.spec.ts` atau perluas suite yang paling dekat. Gunakan semantic
locator dan test account non-production. Minimum assertion:

```ts
const desktopNav = page.getByRole('navigation', { name: 'Navigasi utama desktop' });
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await expect
  .poll(async () => (await desktopNav.boundingBox())?.y ?? Number.POSITIVE_INFINITY)
  .toBeLessThanOrEqual(1);
```

Tambahkan assertion berikut:

- desktop nav terlihat dan mobile nav hidden pada `md` ke atas;
- mobile nav terlihat dan desktop nav hidden di bawah `md`;
- link accessible name `Pendampingan` tersedia bagi user berizin;
- klik link menuju `/mentoring` dan `aria-current` berpindah;
- halaman `/menu` tidak memiliki link `/mentoring`;
- tidak ada horizontal overflow: `scrollWidth <= clientWidth`;
- focus keyboard terlihat dan urutan tab logis;
- reduced motion tidak mengubah layout.

Jika fixture multi-role belum tersedia, jangan memalsukan bukti. Tandai role gate
`BLOCKED_EXTERNAL_VALIDATION`, jelaskan credential/fixture yang kurang, dan pertahankan milestone
`IN_PROGRESS` sampai pengujian staging selesai.

**Acceptance criteria:** seluruh matriks viewport dan role lulus tanpa overlap, permission leak,
focus trap, atau layout shift.

**Test gate:** `npm.cmd run test:e2e` pada project Chromium dan mobile, screenshot comparison manual,
keyboard audit, 200% zoom, typecheck, lint, unit test, dan build.

## 14. RN-4: Performance Gate, Dokumentasi, dan Rollout

**Tujuan:** memastikan perubahan navigasi tidak menurunkan first-load performance atau merusak
deployment.

**Langkah:**

1. Jalankan production build dan ulangi baseline network RN-0.
2. Pastikan render shell tidak memicu full query halaman Pendampingan sebelum user menunjukkan intent
   atau menavigasi.
3. Bandingkan request RSC, invocation, dan query Supabase sebelum/sesudah pada dashboard mobile serta
   desktop. Partial shell prefetch boleh terjadi; query data utama Pendampingan tidak boleh bertambah
   hanya karena link dirender.
4. Uji cold navigation, warm navigation, back/forward, dan klik berulang.
5. Perbarui `docs/DEVELOPER_GUIDE.md` hanya bila deskripsi navigasi di sana menjadi tidak akurat.
6. Isi seluruh Bukti Milestone, Log Keputusan, Risiko Tersisa, dan Handoff.
7. Deploy ke staging/preview lebih dahulu. Push atau production rollout hanya dilakukan bila diminta
   user dan semua gate yang tersedia sudah lulus.

**Acceptance criteria:** tidak ada tambahan full data fetch saat shell pertama dirender, target
feedback navigasi <= 100 ms tetap terpenuhi, tidak ada error console/hydration, dan smoke test staging
lulus pada mobile serta desktop.

**Regression gate minimum:**

- `npm.cmd run lint`
- `npm.cmd run typecheck`
- `npm.cmd test`
- `npm.cmd run test:e2e`
- `npm.cmd run build`
- `git diff --check`

`test:api`, `test:security`, dan `test:types` tidak wajib untuk perubahan CSS/navigation murni, tetapi
wajib dijalankan bila agent menyentuh guard, permission helper, API, database type, atau migrasi.

## 15. File Map

**Wajib dibaca dan kemungkinan diedit:**

- `src/components/layout/AppShellClient.tsx`
- `src/app/(app)/menu/page.tsx`
- `e2e/critical-path.spec.ts`
- `playwright.config.ts`

**Wajib dibaca, jangan diubah tanpa kebutuhan yang terbukti:**

- `src/components/layout/AppShell.tsx`
- `src/app/(app)/layout.tsx`
- `src/app/(app)/mentoring/page.tsx`
- `src/app/(app)/mentoring/new/page.tsx`
- `src/lib/auth/permissions.ts`
- `src/lib/auth/permissions-server.ts`
- `src/lib/auth/guards.ts`
- `src/app/api/mentoring-sessions/route.ts`
- `src/app/globals.css`
- `docs/NAVIGATION_PERFORMANCE_ROADMAP.md`
- `docs/FIRST_LOAD_PERFORMANCE_CACHE_ROADMAP.md`

**File test yang disarankan:**

- `e2e/responsive-navigation.spec.ts`

## 16. Risiko dan Mitigasi

| Risiko                                   | Dampak                        | Mitigasi                                                               |
| ---------------------------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| Ancestor overflow membuat sticky gagal   | Sidebar tetap ikut scroll     | Pertahankan document scroll; inspect computed style setiap ancestor    |
| `h-dvh` bermasalah pada viewport dinamis | Sidebar terlalu tinggi/pendek | Uji browser target pada mobile/desktop dan catat hasil kompatibilitas  |
| Lima label tidak muat                    | Truncate/overlap bottom nav   | Gunakan `Damping` pada mobile, label aksesibel tetap penuh, uji 320 px |
| Full prefetch Pendampingan               | First load kembali lambat     | Gunakan default/auto dan bandingkan network production build           |
| Permission hanya disembunyikan di UI     | Unauthorized deep-link access | Pertahankan route/API guard dan jalankan role matrix                   |
| Main diubah menjadi nested scroller      | Back/forward dan focus rusak  | Larang perubahan scroll owner pada scope ini                           |
| Dua landmark bernama sama                | Navigasi screen reader ambigu | Gunakan label desktop/mobile yang berbeda                              |
| Breakpoint 768 menampilkan dua nav       | Duplicate controls            | Uji 767 dan 768 px serta computed display                              |
| Perubahan user tertimpa                  | Kehilangan konfigurasi lokal  | Audit status sebelum/sesudah; jangan sentuh `supabase/config.toml`     |

## 17. Definition of Done

Pekerjaan baru dianggap selesai bila seluruh kondisi berikut terpenuhi:

1. RN-0 sampai RN-4 memiliki status final dan bukti aktual.
2. Sidebar tetap di viewport pada semua desktop viewport yang diuji.
3. Document/body tetap menjadi scroll owner konten utama.
4. Pendampingan tersedia langsung di desktop/mobile hanya bagi user berizin.
5. Pendampingan tidak lagi muncul pada `/menu`.
6. Active state benar untuk seluruh route Pendampingan.
7. Bottom navigation tidak truncate, overlap, atau bergeser pada 320 px.
8. Role guard dan branch scope tidak berubah.
9. Tidak ada regresi first load akibat full prefetch baru.
10. Semua regression gate yang berlaku lulus.
11. Working tree hanya berisi perubahan scope ini dan perubahan user yang sudah dicatat.
12. Dokumen ini sudah diperbarui dengan hasil akhir, risiko tersisa, dan instruksi rollback.

## 18. Protokol Pembaruan Agent

Sebelum memulai milestone:

1. Ubah hanya milestone target menjadi `IN_PROGRESS`.
2. Isi nama agent, waktu mulai, baseline commit, dan kondisi working tree.
3. Baca ulang keputusan D-1 sampai D-5 serta invariant.

Setelah implementasi:

1. Jalankan seluruh test gate milestone.
2. Catat command dan hasil nyata, termasuk test yang skip atau blocked.
3. Catat file yang berubah dan ringkasan perilaku.
4. Tambahkan screenshot/trace locator yang dapat ditemukan agent berikutnya.
5. Ubah status ke `COMPLETE` hanya bila acceptance criteria dan test gate lulus.
6. Bila validasi eksternal belum tersedia, gunakan `IMPLEMENTED_PENDING_VALIDATION`, bukan `COMPLETE`.
7. Perbarui Handoff sebelum berhenti.

Jangan menulis `PASS` untuk pengujian yang tidak dijalankan. Jangan menghapus catatan agent
sebelumnya; tambahkan koreksi baru dengan alasan bila bukti lama tidak lagi berlaku.

## 19. Bukti Milestone

| Milestone | Commit       | Deployment   | Test dan metrik                                                                              | Status                           | Catatan                                                                             |
| --------- | ------------ | ------------ | -------------------------------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------- |
| RN-0      | working tree | belum deploy | Audit source, working tree, dan kontrak selesai; screenshot/metric production belum tersedia | `IMPLEMENTED_PENDING_VALIDATION` | Baseline `8e811ec`; validasi authenticated browser membutuhkan fixture E2E          |
| RN-1      | working tree | belum deploy | Typecheck, lint, build, dan formatting lulus; browser scroll test belum berjalan             | `IMPLEMENTED_PENDING_VALIDATION` | Sticky `aside`, `h-dvh`, internal nav overflow, document tetap scroll owner         |
| RN-2      | working tree | belum deploy | Typecheck, lint, unit, build, dan formatting lulus; role browser test belum berjalan         | `IMPLEMENTED_PENDING_VALIDATION` | Pendampingan masuk primary nav; kartu Menu dihapus; `prefetch={null}`               |
| RN-3      | working tree | belum deploy | Responsive suite terdeteksi 4 test dan seluruhnya skip karena credential E2E tidak tersedia  | `IMPLEMENTED_PENDING_VALIDATION` | Role matrix, screenshot, zoom, dan browser accessibility masih wajib                |
| RN-4      | working tree | belum deploy | Production build lulus; network/staging validation belum tersedia                            | `IMPLEMENTED_PENDING_VALIDATION` | Server lokal sempat bind, tetapi request `/login` timeout pada dependency eksternal |

## 20. Log Keputusan

| Tanggal    | Keputusan                                          | Alasan                                                                       |
| ---------- | -------------------------------------------------- | ---------------------------------------------------------------------------- |
| 2026-08-11 | Sidebar memakai sticky dan tinggi viewport         | Mempertahankan document scroll dan shell desktop yang sudah ada              |
| 2026-08-11 | Pendampingan masuk sidebar serta bottom navigation | Destination utama harus dapat dicapai satu klik pada kedua breakpoint        |
| 2026-08-11 | Tidak membuat bottom sheet overlay                 | Menghindari state modal, scroll lock, dan duplikasi navigasi                 |
| 2026-08-11 | Kartu Pendampingan di `/menu` dihapus              | Permintaan adalah memindahkan, bukan menduplikasi                            |
| 2026-08-11 | Prefetch Pendampingan memakai default/auto         | Mencegah full dynamic-route prefetch merusak first load                      |
| 2026-08-11 | Tidak ada perubahan database/authorization         | Masalah berada pada presentation dan information architecture                |
| 2026-08-11 | Label mobile Pendampingan memakai `Damping`        | Lima kolom pada 320 px membutuhkan label pendek; accessible name tetap penuh |
| 2026-08-11 | Landmark desktop/mobile diberi nama berbeda        | Menghindari ambiguity pada screen reader dan Playwright locator              |

## 21. Handoff

### Status saat dokumen dibuat

- Audit source selesai pada baseline `8e811ec`.
- Sidebar sudah diubah menjadi sticky dengan `h-dvh`; daftar nav memiliki scroll internal pada
  viewport desktop pendek.
- Pendampingan sudah masuk primary navigation desktop/mobile dan kartu duplikatnya sudah dihapus dari
  `/menu`.
- Link Pendampingan mempertahankan permission `mentoring`, active state route turunannya, dan
  `prefetch={null}` untuk menghindari full prefetch route dinamis.
- Route dan API Pendampingan sudah memiliki permission guard.
- `supabase/config.toml` memiliki perubahan lokal milik user dan berada di luar scope.
- Source yang berubah: `AppShellClient.tsx`, `menu/page.tsx`, dan `e2e/responsive-navigation.spec.ts`.
- Typecheck, lint, unit test 37/37, Prettier check, dan production build lulus.
- Browser authenticated validation belum lulus karena credential E2E tidak tersedia dan runtime lokal
  tidak dapat menyelesaikan request `/login` ke dependency eksternal.

### Langkah agent berikutnya

1. Sediakan akun test non-production melalui `E2E_USER_EMAIL` dan `E2E_USER_PASSWORD`, atau session
   fixture melalui `E2E_ACCESS_TOKEN`, `E2E_USER_ID`, dan email.
2. Jalankan `npx.cmd playwright test e2e/responsive-navigation.spec.ts` dengan server production
   lokal yang dapat mengakses Supabase.
3. Verifikasi RN-1 sampai RN-3 pada viewport 320, 390, 767, 768, 1024x600, dan 1440x900.
4. Bandingkan request prefetch dashboard sebelum dan sesudah; pastikan tidak ada full data fetch
   Pendampingan hanya karena shell dirender.
5. Selesaikan RN-4 dan jangan menyatakan production-ready sebelum bukti network dan staging ada.

### Rollback

Perubahan ini tidak memerlukan rollback database. Bila regresi terjadi, rollback hanya perubahan
shell/navigation dan test terkait ke commit sebelum implementasi. Jangan me-reset atau menghapus
perubahan `supabase/config.toml` milik user.
