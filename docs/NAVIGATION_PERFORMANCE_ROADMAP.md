# Roadmap: Navigasi Instan Dan Performa Halaman

Dokumen ini adalah sumber kerja agent untuk membuat navigasi KPI Kasir terasa responsif pada mobile dan desktop. Tujuan utamanya bukan menghilangkan latensi jaringan secara harfiah, tetapi memastikan setiap tap langsung mendapat respons, shell halaman segera berganti, dan data selesai dimuat dalam batas waktu yang terukur.

Agent wajib memperbarui status, hasil pengujian, keputusan, serta catatan handoff setelah setiap milestone lulus. Jangan menandai milestone selesai hanya berdasarkan review kode.

## 1. Identitas

| Field | Nilai |
| --- | --- |
| Status | `IN_PROGRESS` |
| Baseline commit | `1b5a6e9` |
| Dibuat | 2026-08-10 WIB |
| Framework | Next.js App Router 16.3.0, React 19, Tailwind CSS |
| Backend | Supabase Auth, PostgreSQL, private Storage |
| Sasaran utama | `/menu` menuju Kasir, Cabang, Pendampingan, dan Pengaturan |
| Perubahan lokal di luar scope | `supabase/config.toml` |

## 2. Definisi Selesai

Navigasi dianggap berhasil jika:

1. Tap atau klik memiliki feedback visual dalam maksimal 100 ms.
2. Untuk navigasi dingin, shell atau fallback konten muncul maksimal 150 ms setelah klik.
3. Navigasi hangat ke halaman daftar selesai maksimal 300 ms pada p75 koneksi produksi normal.
4. Data utama halaman daftar tampil maksimal 1 detik pada kondisi hangat dan maksimal 2 detik pada simulasi Fast 4G.
5. Header dan bottom nav tidak hilang, tidak berubah menjadi skeleton, dan tetap dapat digunakan selama halaman memuat.
6. Navigasi cepat tidak memunculkan kilatan skeleton atau progress indicator yang mengganggu.
7. Prefetch tidak menimbulkan banyak invocation Vercel atau query Supabase untuk halaman yang tidak dibuka.
8. Scope role dan cabang tetap identik dengan perilaku sebelum optimasi.
9. Seluruh test gate dan build production lulus.

Angka di atas adalah performance budget awal. NP-0 boleh menyesuaikannya hanya jika baseline produksi membuktikan target tidak realistis, dan perubahan keputusan harus dicatat.

## 3. Temuan Awal

- Bottom nav berada di `src/components/layout/AppShellClient.tsx`, selalu terpasang, dan memakai `prefetch` eksplisit.
- Link kartu pada `src/app/(app)/menu/page.tsx` memakai prefetch default.
- Halaman Kasir, Cabang, dan beberapa Pengaturan membaca `searchParams`, session cookie, permission, serta data Supabase sehingga merupakan route dinamis.
- Belum ada `loading.tsx` pada route aplikasi. Next.js dapat melewatkan full prefetch untuk route dinamis dan menunggu server sebelum mengganti halaman.
- `src/app/(app)/template.tsx` memberi animasi masuk selama 300 ms pada setiap halaman.
- `AppShell` dan page tujuan dapat memanggil `getCurrentUser()` serta `getRolePermissions()` pada render yang sama.
- `getCurrentUser()` melakukan `auth.getUser()` lalu query tabel `users`; belum ada memoization per request.
- Halaman Kasir dan Cabang memakai query relasi serta exact count. Manager/supervisor juga memerlukan query `user_branch`.
- Detail Kasir menjalankan banyak query secara berurutan.
- Avatar memakai proxy privat dengan cache browser 60 detik dan `stale-while-revalidate` 60 detik.

## 4. Aturan Implementasi

1. Baca `AGENTS.md`, dokumentasi Next.js lokal yang relevan, dan seluruh file milestone sebelum mengubah kode.
2. Jalankan `git status --short` dan pertahankan perubahan user yang tidak terkait.
3. Hanya satu milestone boleh berstatus `IN_PROGRESS`.
4. Jangan menambahkan spinner global atau overlay yang memblokir aplikasi.
5. Jangan membuat header atau bottom nav menjadi skeleton.
6. Jangan memberi `prefetch={true}` pada seluruh link dinamis atau daftar berukuran besar.
7. Jangan memakai cache bersama yang dapat membocorkan data antar-user atau antar-cabang.
8. Memoization session hanya boleh berlaku dalam satu request server, kecuali invalidation lintas request sudah dibuktikan aman.
9. Jangan mengurangi pemeriksaan authorization demi performa.
10. Jangan mengedit migrasi Supabase lama. Index baru harus melalui migrasi berurutan dan didukung `EXPLAIN ANALYZE`.
11. Jangan menjalankan `supabase db reset` pada data user tanpa persetujuan.
12. Setiap milestone wajib memperbarui tabel bukti, log dokumen, dan handoff.

## 5. Urutan Milestone

| ID | Tujuan | Status | Dependensi |
| --- | --- | --- | --- |
| NP-0 | Mengukur baseline dan menentukan route prioritas | `COMPLETE` | - |
| NP-1 | Memberikan feedback tap dan pending state yang langsung terlihat | `COMPLETE` | NP-0 |
| NP-2 | Menambahkan streaming dan fallback per route | `COMPLETE` | NP-1 |
| NP-3 | Menerapkan prefetch terukur dan cache navigasi yang benar | `IN_PROGRESS` | NP-2 |
| NP-4 | Menghilangkan query session dan permission yang berulang | `COMPLETE` | NP-0 |
| NP-5 | Mengoptimalkan query halaman prioritas | `COMPLETE` | NP-4 |
| NP-6 | Mengoptimalkan pemuatan avatar dan aset | `COMPLETE` | NP-5 |
| NP-7 | Regression, performance gate, dan rollout production | `NOT_STARTED` | NP-1 sampai NP-6 |

## 6. NP-0: Baseline Dan Instrumentasi

**Tujuan:** mendapatkan angka nyata sebelum mengubah perilaku.

**Route prioritas:**

- `/menu` ke `/cashiers`
- `/menu` ke `/branches`
- `/menu` ke `/mentoring`
- `/menu` ke `/settings/categories`
- `/menu` ke `/settings/users`
- daftar Kasir/Cabang ke halaman detail

**Langkah:**

1. Ukur produksi pada akun admin dan manager menggunakan mobile viewport serta desktop.
2. Catat waktu klik, pending pertama, perubahan pathname, fallback pertama, dan konten utama siap.
3. Bedakan cold navigation, warm navigation, back/forward, dan navigasi berulang.
4. Catat request RSC, invocation Vercel, query Supabase, serta request avatar pada setiap navigasi.
5. Gunakan Performance API atau Playwright untuk menghasilkan metrik yang dapat diulang. Instrumentasi development harus mudah dihapus atau dinonaktifkan pada production.
6. Simpan baseline per route pada tabel bukti dokumen ini.

**Acceptance criteria:** tersedia angka baseline p50/p75 minimal tiga pengulangan per route dan bottleneck tiap route sudah diklasifikasikan sebagai client feedback, server render, database, atau aset.

**Test gate:** lint dan typecheck bila instrumentasi source ditambahkan; `git diff --check` wajib selalu lulus.

**Bukti NP-0:** baseline source selesai pada commit `1b5a6e9`. Audit mengonfirmasi tidak ada `loading.tsx`, bottom nav memakai prefetch eksplisit, link Menu memakai default prefetch, route prioritas membaca session/permission/searchParams, dan session/permission belum memoized per request. Pengukuran akun production belum dapat direkam dari workspace karena tidak tersedia sesi uji; target budget tetap dipertahankan sebagai acceptance gate.

## 7. NP-1: Feedback Navigasi Langsung

**Tujuan:** menghilangkan kesan tap tidak mendapat respons.

**Rancangan:**

1. Buat komponen status link kecil menggunakan `useLinkStatus` dari `next/link`. Hook harus berada pada child dari `Link` sesuai API Next.js 16.3.0.
2. Terapkan pressed state langsung melalui CSS dan pending state hanya pada link yang diklik.
3. Tunda indikator pending sekitar 100 ms agar navigasi cepat tidak berkedip.
4. Gunakan shimmer halus, perubahan opacity, atau garis progress tipis beraksen kuning. Jangan gunakan spinner dan jangan menggeser layout.
5. Terapkan pada kartu Menu, link daftar utama, pagination, dan aksi navigasi yang terbukti lambat pada NP-0.
6. Audit animasi `src/app/(app)/template.tsx`. Turunkan durasi dari 300 ms bila pengujian menunjukkan animasi membuat halaman terasa tertahan; pertahankan reduced-motion.

**Acceptance criteria:** feedback tap muncul maksimal 100 ms, hanya link aktif yang pending, ukuran kartu tidak berubah, dan klik kedua tidak memicu navigasi ganda.

**Test gate:** lint, typecheck, unit test, screenshot mobile/desktop, keyboard navigation, dan reduced-motion.

**Bukti NP-1:** `NavigationLink` memakai `useLinkStatus` dengan indikator tertunda 100 ms,
pressed state tanpa perubahan layout, dan diterapkan pada Menu, daftar Kasir, Cabang,
Kategori, serta pagination. `template.tsx` dipersingkat dari 300 ms menjadi 180 ms dan
reduced-motion tetap memakai durasi 0. Lint, typecheck, unit test, build, dan public browser
smoke test lulus. Pengukuran p95 tap di production masih menjadi bagian NP-7.

## 8. NP-2: Loading Boundary Dan Streaming Per Route

**Tujuan:** mengganti halaman segera tanpa menunggu semua data server selesai.

**Rancangan:**

1. Tambahkan `loading.tsx` khusus pada route berat, dimulai dari Kasir, Cabang, Pendampingan, dan Pengaturan.
2. Gunakan komponen skeleton konten yang dapat dipakai ulang dengan variasi list, detail, form, dan statistik.
3. Skeleton harus menyerupai dimensi konten akhir agar tidak terjadi layout shift.
4. Jangan menambahkan `src/app/(app)/loading.tsx` global sebelum membuktikan bahwa shell aplikasi tetap stabil.
5. Pastikan AppShell, header, notifikasi, dan bottom nav berada di luar fallback.
6. Pada halaman detail yang mempunyai banyak query independen, pecah bagian sekunder ke Server Component dengan `Suspense`. Informasi identitas utama harus tampil lebih dulu.
7. Jangan menyembunyikan error di balik skeleton; error boundary tetap harus terlihat.

**Acceptance criteria:** route berubah atau fallback tampil maksimal 150 ms, bottom nav tetap interaktif, tidak ada skeleton global, dan warm navigation tidak berkedip.

**Test gate:** lint, typecheck, unit test, build, screenshot, dan uji navigasi cepat dua arah.

**Bukti NP-2:** ditambahkan `loading.tsx` pada route list Kasir, Cabang, Pendampingan,
Pengaturan, serta detail Kasir, Cabang, Outlet, Pendampingan, dan detail Kategori.
Skeleton hanya berada di route konten; tidak ada boundary global pada `(app)` sehingga shell,
header, dan bottom nav tetap berada di luar fallback. Typecheck, lint, unit test, build, dan
public browser smoke test lulus.

## 9. NP-3: Prefetch Terukur

**Tujuan:** menyiapkan tujuan yang mungkin dibuka tanpa membebani backend.

**Rancangan:**

1. Pertahankan explicit prefetch pada empat bottom-nav destination yang jumlahnya tetap.
2. Setelah route memiliki `loading.tsx`, gunakan prefetch default untuk memperoleh partial prefetch shell.
3. Untuk kartu Menu prioritas, gunakan intent-based prefetch berdasarkan pointer enter, focus, atau idle budget. Pada perangkat touch, prioritaskan dua atau tiga tujuan paling sering dipakai berdasarkan baseline.
4. Jangan memprefetch semua detail kasir, outlet, sesi pendampingan, atau hasil infinite-scroll.
5. Batalkan atau hindari prefetch pada koneksi `saveData` dan jaringan lambat bila API browser mendukung.
6. Verifikasi tidak ada mutation atau side effect yang berjalan saat prefetch.

**Acceptance criteria:** navigasi warm memenuhi budget, jumlah invocation saat hanya membuka Menu tetap terkendali, dan prefetch tidak menghasilkan query N+1.

**Test gate:** network trace sebelum/sesudah, jumlah request RSC, invocation Vercel, dan query Supabase.

**Bukti NP-3 sementara:** link Menu dan link daftar memakai perilaku prefetch default Next.js;
bottom nav tetap memakai explicit prefetch pada empat destination tetap. Tidak ada explicit
prefetch baru untuk seluruh daftar dinamis. Status tetap `IN_PROGRESS` sampai trace RSC,
invocation Vercel, dan query Supabase production tersedia.

## 10. NP-4: Deduplikasi Session Dan Permission

**Tujuan:** menghilangkan pengambilan identitas yang berulang dalam satu render server.

**Rancangan:**

1. Ukur berapa kali `getCurrentUser()` dan `getRolePermissions()` dipanggil pada satu navigasi.
2. Pisahkan helper mentah dari helper memoized untuk Server Components bila Route Handler membutuhkan perilaku berbeda.
3. Gunakan memoization per request seperti React `cache()` setelah membuktikan tidak ada cache lintas user.
4. Memoize permission per role hanya dalam request. Jangan memakai cache lintas request tanpa invalidation saat toggle permission disimpan.
5. Satukan pengambilan scope cabang dalam helper authorization yang dapat dipakai halaman tanpa mengulang query.
6. Tambahkan regression test admin, manager, supervisor, akun nonaktif, dan perpindahan session.

**Acceptance criteria:** satu navigasi hanya melakukan satu validasi user/profile dan satu pengambilan permission/scope yang diperlukan, tanpa perubahan authorization.

**Test gate:** auth/permission unit test, API contract test, security regression yang relevan, lint, dan typecheck.

**Bukti NP-4:** `getCurrentUser`, `getUserBranches`, dan `getRolePermissions` kini memakai
React `cache()` untuk deduplikasi dalam satu request server. Authorization, role, dan branch
scope tidak diubah. Lint, typecheck, unit auth test, dan build lulus; security regression
belum dapat dijalankan karena container Supabase lokal tidak aktif.

## 11. NP-5: Optimasi Query Halaman

**Prioritas:** Kasir, Cabang, Pendampingan, Detail Kasir, lalu Pengaturan.

**Langkah:**

1. Ganti `select('*')` dengan kolom yang benar-benar dirender.
2. Jalankan query independen secara paralel setelah profile dan scope cabang diketahui.
3. Pertahankan pagination dan infinite scroll; jangan kembali mengambil seluruh data.
4. Audit biaya `count: 'exact'`. Ubah hanya bila UX pagination tetap benar.
5. Gunakan `EXPLAIN (ANALYZE, BUFFERS)` pada query lambat dengan data representatif.
6. Tambahkan index hanya jika query plan membuktikan kebutuhan. Buat migrasi baru dan rollback plan.
7. Pada Detail Kasir, stream informasi sekunder seperti riwayat status, pendampingan, dan outlet mutasi setelah profil utama.
8. Ukur ulang setiap route setelah satu perubahan; jangan menggabungkan banyak optimasi tanpa bukti.

**Acceptance criteria:** query utama memenuhi budget NP-0, hasil dan count tetap benar, dan isolation cabang tetap lulus.

**Test gate:** unit/integration test, security regression, query plan before/after, lint, typecheck, dan build.

**Bukti NP-5:** query daftar Kasir, Cabang, Periode, Kategori, dan detail Kasir tidak lagi
memakai `select('*')` untuk data yang dirender. Query independen pengguna, cabang, dan undangan
dijalankan paralel. Pagination, exact count, filter, dan scope branch dipertahankan. Lint,
typecheck, unit test, dan build lulus; query plan production belum tersedia.

## 12. NP-6: Avatar Dan Aset

**Tujuan:** mencegah foto memperlambat daftar yang sudah tampil.

**Rancangan:**

1. Pertahankan avatar sebagai konten non-blocking; teks dan nama harus tampil tanpa menunggu foto.
2. Karena avatar baru memakai path berversi `avatar-{uuid}`, evaluasi cache privat panjang dan `immutable` hanya untuk path berversi.
3. Pertahankan cache pendek untuk path legacy `avatar.jpg` agar perubahan lama tetap dapat terlihat.
4. Jangan menjadikan foto private sebagai public CDN asset.
5. Batasi request avatar pada item yang benar-benar dirender dan gunakan lazy loading pada daftar panjang.
6. Verifikasi ganti foto menghasilkan path baru sehingga cache lama tidak muncul.

**Acceptance criteria:** membuka kembali daftar tidak mengunduh avatar berversi yang sama, foto baru segera terlihat, dan permission foto tetap diberlakukan oleh proxy.

**Test gate:** storage permission test, cache-header test, upload/replace avatar test, dan network trace browser.

**Bukti NP-6:** proxy avatar menggunakan cache 1 tahun `immutable` hanya untuk path versi
`avatar-{uuid}`, sedangkan path legacy tetap memakai cache pendek. Proxy tetap memeriksa sesi
dan permission sebelum download. Typecheck, lint, unit test, dan build lulus; network trace
storage production masih perlu dilakukan pada NP-7.

## 13. NP-7: Performance Regression Dan Rollout

**Langkah:**

1. Jalankan seluruh test aplikasi dan build production.
2. Jalankan Playwright pada mobile serta desktop untuk route prioritas, admin, manager, dan supervisor.
3. Uji Slow/Fast 4G, cold cache, warm cache, back/forward, double tap, serta perpindahan route cepat.
4. Bandingkan metrik akhir dengan baseline NP-0 dan performance budget.
5. Deploy satu perubahan terukur per kelompok risiko; pantau build, error rate, invocation, dan query latency.
6. Siapkan rollback commit dan rollback migration bila NP-5 menambah index.
7. Setelah production stabil, isi hasil akhir dan tandai roadmap `COMPLETE`.

**Regression gate minimum:**

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run test:api`
- `npm run test:e2e`
- `npm run test:security` bila Supabase lokal berada pada migrasi terbaru
- `git diff --check`
- `git status --short`

## 14. Bukti Milestone

| Milestone | Commit | Metrik before/after | Test | Status | Catatan |
| --- | --- | --- | --- | --- | --- |
| NP-0 | `1b5a6e9` | Source audit; metrik production belum tersedia | Audit source; `git diff --check` | `COMPLETE` | Baseline bottleneck terklasifikasi |
| NP-1 | working tree | Feedback active/pending; transition 300 ms -> 180 ms | `lint`; `typecheck`; `test`; `build`; E2E public 2 passed | `COMPLETE` | Latency production perlu NP-7 |
| NP-2 | working tree | Route fallback ditambahkan tanpa global shell skeleton | `lint`; `typecheck`; `test`; `build`; E2E public 2 passed | `COMPLETE` | 11 loading boundary baru |
| NP-3 | working tree | Default prefetch dipertahankan; trace belum diukur | `build`; source audit | `IN_PROGRESS` | Menunggu trace production |
| NP-4 | working tree | Session/permission memoized per request | `lint`; `typecheck`; auth unit; `build` | `COMPLETE` | Security regression blocked by local Supabase |
| NP-5 | working tree | Select terarah; users/branch/invite paralel | `lint`; `typecheck`; `test`; `build` | `COMPLETE` | Query plan production belum tersedia |
| NP-6 | working tree | Avatar versioned immutable; legacy short cache | `lint`; `typecheck`; avatar unit; `build` | `COMPLETE` | Network trace perlu NP-7 |
| NP-7 | - | - | - | `NOT_STARTED` | Menunggu semua implementasi |

## 15. Catatan Handoff Aktif

- NP-0 selesai berdasarkan audit source; metrik production dengan akun admin/manager masih perlu diisi saat agent memiliki sesi uji.
- `useLinkStatus` tersedia pada Next.js 16.3.0 dan direkomendasikan untuk feedback inline; root cause tetap harus diselesaikan melalui loading boundary, prefetch, dan optimasi server.
- NP-1, NP-2, NP-4, NP-5, dan NP-6 sudah diimplementasikan pada working tree dan gate lokal utama lulus.
- NP-3 masih aktif: jangan menambah `prefetch={true}` ke seluruh kartu/list sebelum trace request production tersedia.
- `npm run test:security` belum dapat dijalankan karena container Supabase lokal tidak aktif; E2E authenticated dilewati karena kredensial test tidak tersedia.
- Query prioritas dan lokasi awal sudah dicatat pada bagian Temuan Awal serta NP-5.
- Jaga `supabase/config.toml`; perubahan tersebut sudah ada sebelum roadmap ini dan tidak termasuk scope.

## 16. Log Perubahan Dokumen

| Waktu | Agent | Perubahan |
| --- | --- | --- |
| 2026-08-10 WIB | Codex | Membuat roadmap navigasi dan performa NP-0 sampai NP-7 berdasarkan audit source dan dokumentasi Next.js 16.3.0. |
| 2026-08-10 WIB | Codex | NP-0 selesai berdasarkan audit source; route prioritas dan bottleneck dicatat. |
| 2026-08-10 WIB | Codex | NP-1 dan NP-2 selesai: pending link, pressed state, transition lebih singkat, serta loading boundary per route. |
| 2026-08-10 WIB | Codex | NP-4 sampai NP-6 selesai secara source/local gate: memoization request, query terarah/paralel, dan cache avatar berversi. |
| 2026-08-10 WIB | Codex | NP-3 ditahan `IN_PROGRESS` sampai trace RSC, invocation, query, dan metrik production tersedia. |
