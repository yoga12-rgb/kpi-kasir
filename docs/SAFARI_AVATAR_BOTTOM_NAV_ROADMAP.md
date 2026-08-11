# Safari Avatar And Bottom Navigation Roadmap

Dokumen ini adalah sumber kebenaran untuk memperbaiki pengalaman avatar kasir pada Safari iPhone
dan memperbarui bottom navigation mobile. Agent pelaksana wajib membaca dokumen ini sebelum mengubah
kode dan wajib memperbaruinya setelah setiap milestone lulus.

Roadmap ini sengaja memisahkan pengukuran cache, implementasi skeleton, perubahan kontrak HTTP, dan
perubahan visual navigasi. Jangan menggabungkan seluruh pekerjaan dalam satu patch tanpa bukti per
milestone karena perubahan cache avatar menyentuh batas keamanan data privat.

## 1. Identitas

| Field                        | Nilai                                                     |
| ---------------------------- | --------------------------------------------------------- |
| Status                       | `IMPLEMENTATION_COMPLETE_PENDING_DEVICE_VALIDATION`       |
| Versi dokumen                | `1.1.0`                                                   |
| Dibuat                       | 2026-08-12 WIB                                            |
| Branch target                | `staging`                                                 |
| Baseline commit              | `a2f2a78`                                                 |
| Milestone aktif              | `AVN-5`                                                   |
| Perangkat laporan            | iPhone XR, Safari; versi iOS belum dicatat                |
| Target backend               | Supabase staging `fkanacflupmyuohkjque`                   |
| Target deploy                | Vercel Preview branch `staging`                           |
| Production                   | Jangan diubah selama roadmap ini                          |
| Perubahan user di luar scope | `supabase/config.toml`; jangan diubah, stage, atau revert |
| Migrasi database             | Tidak direncanakan                                        |
| Dependency baru              | Tidak diperlukan                                          |

## 2. Laporan Pengguna

Pada Safari iPhone XR, avatar kasir terlihat memuat ulang ketika pengguna berpindah dari halaman
Ranking ke Penilaian. Desktop terasa instan. Pengguna juga meminta:

1. skeleton hanya pada frame avatar yang belum selesai dimuat;
2. bottom navigation dibuat sedikit lebih tinggi;
3. ikon bottom navigation sedikit lebih besar;
4. ikon aktif dibuat lebih menonjol dan sedikit keluar dari garis atas bar;
5. perubahan warna ikon diberi animasi ringan.

Uji fisik sebelumnya menyatakan alur utama aplikasi aman pada iPhone XR. Temuan avatar ini belum
memiliki rekaman Network Inspector, versi iOS, metrik transfer, atau klasifikasi cache hit/decode.
Karena itu akar masalah cache masih hipotesis sampai AVN-0 selesai.

## 3. Tujuan

1. Avatar yang sama tidak mengirim body gambar kembali pada navigasi berulang selama cache masih
   valid.
2. Setiap avatar memiliki frame berukuran stabil, skeleton lingkaran saat benar-benar loading, dan
   fallback inisial saat gambar gagal.
3. Tidak ada broken-image icon, flash transparan, layout shift, atau skeleton seluruh halaman.
4. Cache privat tidak dipindahkan ke Service Worker/Cache Storage dan tidak melemahkan pemeriksaan
   session, role, permission, atau scope cabang.
5. Bottom navigation lebih mudah disentuh, lebih jelas menunjukkan lokasi aktif, menghormati safe
   area iPhone, dan tidak menutupi konten.
6. Animasi hanya memberi feedback perubahan state, bukan animasi dekoratif terus-menerus.
7. Perilaku desktop sidebar dan daftar menu berbasis permission tidak berubah.

## 4. Bukan Scope

- Mengubah crop, validasi, kompresi, atau alur upload avatar.
- Membuat bucket avatar publik.
- Menaruh response `/api/storage/cashier-avatar` di Service Worker Cache Storage.
- Mengganti proxy privat dengan signed URL yang dibuat ulang pada setiap halaman.
- Mengubah role, RLS, permission toggle, atau scope cabang.
- Mengubah page transition, header desktop, atau sidebar desktop.
- Memaksa skeleton tampil dengan delay buatan ketika gambar sudah tersedia.
- Menambah Framer Motion/Motion untuk transisi warna sederhana.
- Menerapkan migration Supabase.
- Mempromosikan branch ke production.

## 5. Source Yang Diaudit

| Area                        | File utama                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------- |
| Komponen avatar             | `src/components/cashiers/CashierAvatar.tsx`                                        |
| URL/path thumbnail          | `src/lib/storage/cashier-avatar.ts`                                                |
| Proxy avatar privat         | `src/app/api/storage/cashier-avatar/route.ts`                                      |
| Upload/versioning avatar    | `src/app/api/cashiers/[id]/avatar/route.ts`                                        |
| Ranking                     | `src/lib/leaderboard/initial.ts`, `src/components/leaderboard/LeaderboardView.tsx` |
| Penilaian                   | `src/app/(app)/assessment/page.tsx`                                                |
| Shell dan bottom navigation | `src/components/layout/AppShellClient.tsx`                                         |
| Viewport dan safe area      | `src/app/layout.tsx`, `src/app/globals.css`                                        |
| PWA cache boundary          | `public/sw.js`, `e2e/pwa-cache.spec.ts`                                            |
| Navigation E2E              | `e2e/responsive-navigation.spec.ts`, `playwright.config.ts`                        |
| Avatar unit coverage        | `src/lib/storage/__tests__/cashier-avatar.test.ts`                                 |
| CI browser                  | `.github/workflows/quality-gate.yml`                                               |

## 6. Kondisi Aktual

### 6.1 Alur Avatar

1. Database menyimpan path versioned, misalnya `cashier/<id>/avatar-<uuid>.webp`.
2. Halaman Ranking dan Penilaian sama-sama mengubah path tersebut menjadi URL proxy thumbnail:
   `/api/storage/cashier-avatar?path=...&variant=thumbnail`.
3. `CashierAvatar` memakai `next/image` dengan `unoptimized`, ukuran eksplisit, dan loading native
   default yang bersifat lazy.
4. Komponen tidak memiliki state `loading`, `loaded`, atau `error`.
5. Ketika `src` tersedia, tidak ada placeholder. Ketika request/decode lambat, frame dapat terlihat
   kosong atau seperti memuat ulang.
6. Jika request gagal setelah `src` diberikan, komponen tidak kembali ke inisial.
7. Proxy melakukan autentikasi user aktif, permission foto, validasi path, lalu download dari
   Supabase Storage pada setiap cache miss.
8. Avatar versioned mengirim `Cache-Control: private, max-age=31536000, immutable` dan
   `Vary: Cookie`.
9. Proxy belum mengirim `ETag` dan belum menangani `If-None-Match`, sehingga cache miss/revalidation
   selalu mengunduh body Storage lagi.
10. Service Worker hanya menyimpan asset publik. Avatar privat tidak masuk Cache Storage. Ini benar
    dan tidak boleh diubah.

### 6.2 Alur Navigasi

1. Ranking dan Penilaian menggunakan URL avatar thumbnail yang secara logis sama.
2. Perpindahan route melepas dan memasang ulang elemen `<Image>` karena daftar berada di page
   content, bukan persistent layout.
3. Link Penilaian dan Ranking memiliki `prefetch={true}`, tetapi prefetch route tidak menjamin file
   image sudah dimuat atau sudah didecode.
4. Desktop lebih mungkin mempertahankan memory/decoded image cache. Safari iPhone dapat melakukan
   decode ulang, eviction, atau cache miss yang belum terukur.

### 6.3 Bottom Navigation

1. Bar mobile memakai `position: fixed`, `bottom: 0`, `min-height: 4rem`, dan padding
   `env(safe-area-inset-bottom)`.
2. Ikon berukuran 20 x 20 CSS px.
3. State aktif hanya dibedakan dengan warna kuning dan font label lebih tebal.
4. Tidak ada icon container, elevation, lift/offside, atau shadow aktif.
5. Main content memakai bottom padding `5rem + safe-area`, sesuai bar lama tetapi belum sesuai bar
   yang akan ditinggikan.
6. `viewportFit: 'cover'` belum disetel. Jangan menambahkannya tanpa menguji header, landscape,
   Safari tab, dan mode PWA karena perubahan tersebut memengaruhi seluruh viewport.
7. Playwright hanya memiliki Chromium desktop dan emulasi Pixel. WebKit/iPhone belum menjadi project
   permanen dalam konfigurasi repository.

## 7. Temuan Audit

| ID     | Prioritas | Temuan                                                               | Dampak                                                       | Keputusan awal                                              |
| ------ | --------- | -------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| AV-1   | P1        | `CashierAvatar` tidak punya lifecycle loading/error                  | Blank flash dan broken image tidak tertangani                | Tambahkan state machine dan skeleton lokal                  |
| AV-2   | P1        | Belum ada bukti cache/network/decode Safari fisik                    | Perbaikan cache berisiko hanya menebak akar masalah          | Rekam baseline sebelum mengubah header                      |
| AV-3   | P1        | Proxy versioned belum mendukung `ETag/304`                           | Cache miss mengunduh ulang body dari Storage                 | Tambahkan conditional response setelah auth                 |
| AV-4   | P1        | `Vary: Cookie` dapat membuat varian cache baru saat cookie berubah   | Safari mungkin tidak memakai entry sebelumnya                | Ukur dulu; jangan hapus tanpa security approval             |
| AV-5   | P2        | Semua avatar memakai lazy loading default                            | Avatar above-the-fold baru mulai terlambat setelah remount   | Tambahkan prop loading; eager hanya untuk jumlah terbatas   |
| AV-6   | P2        | Tidak ada fallback saat URL 401/403/404/error decode                 | Broken image dan frame kosong                                | Tampilkan inisial tanpa retry loop                          |
| AV-7   | P2        | Tidak ada test skeleton/cache avatar lintas route                    | Regresi Safari tidak tertangkap                              | Tambahkan delayed-response dan warm-navigation test         |
| NAV-1  | P2        | Bar 64 px dan ikon 20 px lebih kecil dari target visual pengguna     | Navigasi terasa kurang menonjol                              | Bar 72-76 px, ikon 24 px                                    |
| NAV-2  | P2        | Active state tidak memiliki bentuk/lift                              | Lokasi aktif kurang cepat dipindai                           | Active icon wrapper 44-48 px dan lift 10-12 px              |
| NAV-3  | P2        | Padding konten terikat pada tinggi bar lama                          | Konten dapat tertutup setelah redesign                       | Gunakan satu kontrak tinggi/lift untuk bar dan main padding |
| NAV-4  | P2        | Safe-area belum diuji pada Safari tab, landscape, dan PWA standalone | Bar dapat terlalu rendah/tinggi atau mengenai home indicator | Tambahkan matrix safe-area fisik dan emulasi                |
| NAV-5  | P3        | Animasi baru berpotensi berlebihan atau menggeser layout             | UX tidak stabil dan aksesibilitas menurun                    | CSS transition singkat, no loop, reduced-motion             |
| TEST-1 | P2        | CI tidak menginstal/menjalankan WebKit                               | Perbedaan engine tidak menjadi regression gate               | Tambahkan project/job WebKit terarah setelah test stabil    |

## 8. Hipotesis Yang Harus Dibuktikan

| Hipotesis | Cara membuktikan                                                           | Tindakan jika benar                                              |
| --------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| H-1       | Request kedua tidak mentransfer body, tetapi paint terlambat               | Fokus pada skeleton dan decode lifecycle                         |
| H-2       | Request kedua kembali `200` dengan transferred bytes penuh                 | Audit cache key, cookie refresh, dan header response             |
| H-3       | Cookie berubah di antara Ranking dan Penilaian sehingga `Vary` tidak cocok | Rancang cache partition yang aman; jangan langsung hapus `Vary`  |
| H-4       | Request tidak mulai sampai avatar masuk lazy-load threshold                | Eager-kan hanya avatar above-the-fold                            |
| H-5       | Route/RSC Penilaian terlambat, bukan image request                         | Tangani prefetch/data route terpisah; jangan menyalahkan avatar  |
| H-6       | Thumbnail payload terlalu besar atau fallback memakai original             | Audit ukuran/object; perbaiki thumbnail/fallback secara terpisah |

## 9. Keputusan Desain Wajib

### 9.1 Avatar

- `CashierAvatar` tetap menjadi satu-satunya komponen avatar untuk Ranking, Penilaian, daftar kasir,
  form Pendampingan, dan profil.
- Frame harus memiliki width/height tetap dari prop `size`; loading tidak boleh mengubah layout.
- Skeleton berbentuk lingkaran dan hanya muncul ketika ada `src` yang belum selesai load/decode.
- Tidak ada delay minimum buatan. Jika cache/decode selesai sebelum paint, skeleton boleh tidak
  terlihat.
- `onLoad` harus menunggu kondisi image siap ditampilkan. Gunakan `HTMLImageElement.decode()` dengan
  fallback aman bila Promise ditolak/tidak tersedia.
- Saat mount, periksa `complete` dan `naturalWidth` agar image cache yang selesai sebelum handler
  terpasang tidak tertahan pada skeleton.
- Saat `src` berubah setelah upload avatar, status wajib kembali ke `loading` dan gambar lama tidak
  boleh dianggap loaded.
- `onError` menampilkan inisial dalam frame yang sama. Jangan retry otomatis tanpa batas.
- Skeleton harus `aria-hidden`; wrapper boleh memakai `aria-busy`. Alt image tetap nama kasir.
- Tambahkan opsi `loading="eager" | "lazy"` atau prop setara. Default tetap lazy. Eager hanya untuk
  avatar di viewport awal yang dibuktikan AVN-0.

### 9.2 Cache Privat

- URL harus tetap versioned dan stabil lintas halaman.
- Conditional request harus tetap melakukan autentikasi, pengecekan user aktif, dan permission
  sebelum mengembalikan `304`.
- Tambahkan `ETag` deterministik hanya untuk representasi versioned yang immutable. Variant
  thumbnail/original harus menghasilkan validator berbeda.
- Response `200` dan `304` untuk URL yang sama harus konsisten pada `ETag`, `Cache-Control`, dan
  `Vary`.
- Response `401`, `403`, `404`, dan `5xx` harus `private, no-store` dan tidak boleh memiliki cache
  lifetime panjang.
- Pertahankan `Vary: Cookie` pada implementasi pertama. Menghapusnya memerlukan bukti bahwa cookie
  fragmentation adalah penyebab, threat model logout/shared-device, dan persetujuan reviewer.
- Jangan cache avatar privat di Service Worker, Cache Storage, localStorage, IndexedDB, atau state
  global yang bertahan setelah logout.
- Jangan mengubah bucket menjadi publik untuk mengejar performa.

### 9.3 Bottom Navigation

- Bar tetap fixed pada bottom dan selalu terlihat pada route top-level mobile.
- Tinggi visual target 72-76 px di luar safe-area. Nilai final dipilih setelah screenshot 320 px dan
  iPhone XR.
- Ikon visual target 24 px di dalam hit target minimal 44 x 44 px.
- Hanya ikon aktif yang naik 10-12 px. Semua link mempertahankan box grid yang sama agar label dan
  bar tidak bergeser.
- Wrapper ikon aktif memakai aksen kuning, foreground gelap, border/ring surface, dan shadow ringan.
- Ikon nonaktif tetap netral dengan kontras yang cukup.
- Animasi state memakai CSS `transition` sekitar 180-220 ms untuk color, background, transform, dan
  shadow. Jangan memakai animasi pulse/infinite.
- `prefers-reduced-motion: reduce` harus menghilangkan transform animation atau membuat perubahan
  instan tanpa menghilangkan state aktif.
- Label tetap tampil, satu kata bila memungkinkan, dan tidak terpotong pada 320 px.
- Pertahankan `aria-current="page"`, `aria-label`, focus-visible ring, dan urutan menu berbasis
  permission yang ada.
- Main bottom padding harus dihitung dari tinggi bar, safe-area, dan lift icon. Konten terakhir tidak
  boleh tertutup.
- Jangan menjadikan setiap tab sebagai card. Bar adalah satu surface navigasi.

### 9.4 Safe Area

- Jangan otomatis menambah `viewportFit: 'cover'` hanya karena tersedia pada type Next.js.
- Ukur `env(safe-area-inset-bottom)` di Safari tab dan PWA standalone terlebih dahulu.
- Jika `viewportFit: 'cover'` memang diperlukan, audit dan sesuaikan safe-area top/header serta
  inset horizontal landscape dalam milestone yang sama.
- Setiap perubahan viewport membutuhkan screenshot portrait dan landscape pada perangkat fisik.

## 10. Milestone

| Milestone | Tujuan                                              | Status                           | Dependency   |
| --------- | --------------------------------------------------- | -------------------------------- | ------------ |
| AVN-0     | Baseline Safari, network, cache, decode, dan layout | `IMPLEMENTED_PENDING_VALIDATION` | -            |
| AVN-1     | Skeleton dan lifecycle avatar reusable              | `COMPLETE`                       | AVN-0        |
| AVN-2     | Conditional cache dan repeat-navigation efficiency  | `IMPLEMENTED_PENDING_VALIDATION` | AVN-0, AVN-1 |
| AVN-3     | Redesign bottom navigation                          | `IMPLEMENTED_PENDING_VALIDATION` | AVN-0        |
| AVN-4     | Automated regression dan accessibility gate         | `IMPLEMENTED_PENDING_CI`         | AVN-1..AVN-3 |
| AVN-5     | Staging rollout dan iPhone XR validation            | `READY`                          | AVN-4        |

## 11. AVN-0: Baseline Safari Dan Kontrak

**Tujuan:** membedakan network refetch, HTTP revalidation, lazy-load delay, dan decode repaint.

### Langkah

1. Catat model iPhone, versi iOS, versi Safari, mode Safari tab/PWA, URL Preview, waktu, dan operator.
2. Gunakan akun staging dan data non-PII. Jangan memakai production untuk profiling.
3. Buka Safari Web Inspector dari macOS bila tersedia. Jika tidak tersedia, gunakan WebKit
   Playwright sebagai baseline tambahan dan tandai keterbatasannya.
4. Rekam cold load halaman Ranking setelah cache website dibersihkan.
5. Tunggu seluruh avatar terlihat, lalu pindah melalui bottom nav ke Penilaian.
6. Kembali ke Ranking dan ulangi minimal tiga siklus tanpa reload penuh.
7. Untuk setiap URL avatar yang sama, catat status, initiator, transferred bytes, resource size,
   waktu response, dan indikasi memory/disk cache. Jangan mencatat Cookie atau token mentah.
8. Catat apakah image request mulai terlambat karena lazy loading.
9. Catat apakah request selesai tetapi frame masih kosong, yang menunjukkan decode/paint delay.
10. Ukur bounding box bar, link, icon, label, dan jarak terhadap home indicator pada portrait serta
    landscape.
11. Catat nilai computed `safe-area-inset-bottom` secara tidak sensitif bila tooling memungkinkan.
12. Isi bagian Bukti Milestone dan pilih hipotesis H-1..H-6 yang terbukti.

### Acceptance Criteria

- Akar keterlambatan diklasifikasikan sebagai network, validation, lazy load, decode, atau gabungan.
- Terdapat metrik cold dan minimal tiga repeat navigation.
- Tidak ada secret, cookie, token, nama kasir, atau foto nyata di artefak yang di-commit.
- Ukuran target bottom nav dan kondisi safe-area iPhone XR tercatat.

### Test Gate

- `git status --short` dicatat.
- Baseline desktop Chromium, WebKit emulasi, dan iPhone XR dibandingkan.
- Tidak ada perubahan production atau database.

## 12. AVN-1: Skeleton Dan Lifecycle Avatar

**Tujuan:** menghilangkan blank flash dan broken image tanpa menunda cache hit.

### File Kandidat

- `src/components/cashiers/CashierAvatar.tsx`
- `e2e/avatar-navigation.spec.ts` atau test terarah setara
- utility test baru hanya bila state/cache helper dipisahkan

### Langkah

1. Jadikan boundary avatar client-side sekecil mungkin. Jangan mengubah semua page menjadi Client
   Component.
2. Definisikan state `loading | loaded | error` dan reset berdasarkan `src`.
3. Bungkus image, skeleton, dan fallback dalam frame relative dengan ukuran stabil.
4. Render skeleton lingkaran lokal pada status loading.
5. Sembunyikan image secara opacity sampai siap tanpa mengubah width/height.
6. Tangani cached-complete image dengan ref plus `complete/naturalWidth` setelah mount.
7. Pada load, tunggu decode secara aman sebelum status loaded.
8. Pada error, tampilkan inisial dan hentikan skeleton.
9. Pastikan ring/border dari prop `className` tetap kompatibel dengan profil kasir dan rank frame.
10. Tambahkan prop loading/fetch priority hanya jika diperlukan oleh hasil AVN-0.
11. Jangan menambahkan minimum skeleton duration.

### Acceptance Criteria

- Frame tidak berubah ukuran pada loading, loaded, error, atau perubahan `src`.
- Skeleton hanya berada di lingkaran avatar.
- Cache hit dapat langsung menampilkan image tanpa flash skeleton yang dipaksakan.
- Response tertunda menampilkan skeleton sampai decode selesai.
- 401/403/404/error image menampilkan inisial, bukan broken image.
- Semua penggunaan avatar existing tetap memiliki ukuran dan ring yang sama.

### Test Gate

- Delayed avatar request: skeleton visible, image hidden, lalu skeleton hilang setelah load.
- Immediate/cached request: image tampil tanpa artificial delay.
- Error response: fallback inisial dan skeleton berhenti.
- Avatar path berubah: image baru dimuat dan image lama tidak tertahan.
- Typecheck, lint, unit test, dan build lulus.

## 13. AVN-2: Cache Dan Repeat Navigation

**Tujuan:** menghindari retransmission body avatar pada navigasi berulang tanpa melemahkan auth.

### File Kandidat

- `src/app/api/storage/cashier-avatar/route.ts`
- `src/lib/storage/avatar-cache.ts` bila helper benar-benar mengurangi kompleksitas
- `src/lib/storage/__tests__/cashier-avatar-cache.test.ts`
- `e2e/avatar-navigation.spec.ts`

### Langkah

1. Pertahankan validasi session, user aktif, permission, dan path sebelum conditional response.
2. Buat ETag deterministik untuk path avatar versioned plus variant response.
3. Parse `If-None-Match` dengan benar, termasuk daftar validator dan weak prefix bila didukung.
4. Untuk validator cocok, kembalikan `304` tanpa download object Storage.
5. Gunakan header cache/ETag/Vary yang sama pada response `200` dan `304`.
6. Pastikan response error memakai `private, no-store`.
7. Tambahkan test bahwa legacy unversioned avatar tidak menerima validator immutable palsu.
8. Ulangi baseline AVN-0 dan bandingkan transferred bytes serta jumlah Storage download.
9. Jika request kedua sudah cache hit tetapi paint tetap lambat, jangan mengubah `Vary`.
10. Jika bukti menunjukkan cookie fragmentation, buat decision record terpisah. Evaluasi opsi
    partition URL per session/user atau cache lifetime lebih pendek plus auth revalidation. Jangan
    menghapus `Vary: Cookie` diam-diam.
11. Pertahankan exclusion `/api/*` pada Service Worker dan test PWA.
12. Gunakan eager loading hanya untuk jumlah avatar above-the-fold yang kecil dan terukur. Jangan
    eager-load seluruh daftar 25 item.

### Acceptance Criteria

- Cold request versioned yang authorized menghasilkan `200`, ETag, dan body valid.
- Conditional request authorized menghasilkan `304` dan tidak mengambil object Storage lagi.
- Unauthorized/inactive/no-permission tetap `401/403` walau mengirim ETag yang valid.
- Repeat Ranking -> Penilaian tidak mengirim body avatar yang sama kembali selama cache valid.
- Avatar baru memakai URL baru dan tidak menampilkan bytes versi lama.
- PWA Cache Storage tetap tidak memiliki `/api/storage/cashier-avatar`.

### Test Gate

- Unit test ETag generation/matching.
- API contract `200/304/401/403/404` dan header cache.
- Auth revocation dan logout smoke.
- Browser cold/warm navigation pada Chromium dan WebKit.
- `e2e/pwa-cache.spec.ts` tetap lulus.
- Typecheck, lint, unit test, API smoke, E2E, dan build lulus.

## 14. AVN-3: Bottom Navigation Visual Dan Ergonomi

**Tujuan:** membuat bottom navigation lebih tinggi, ikon lebih jelas, dan state aktif lebih menonjol
tanpa overlap atau animasi berlebihan.

### File Kandidat

- `src/components/layout/AppShellClient.tsx`
- `src/app/globals.css` bila shared CSS variable/reduced-motion rule dibutuhkan
- `src/app/layout.tsx` hanya jika AVN-0 membuktikan `viewportFit` perlu diubah
- `e2e/responsive-navigation.spec.ts`

### Langkah

1. Tetapkan satu token/kontrak untuk tinggi bar, icon lift, dan main bottom padding agar nilainya
   tidak drift.
2. Naikkan tinggi visual bar dari 64 px menjadi nilai hasil review dalam rentang 72-76 px.
3. Pertahankan padding safe-area di bawah item.
4. Naikkan ikon dari 20 px menjadi 24 px.
5. Tambahkan wrapper ikon 44-48 px sebagai visual anchor dan target sentuh.
6. Pada state aktif, naikkan wrapper sekitar 10-12 px tanpa mengubah tinggi grid/link.
7. Berikan background kuning, foreground gelap, border surface, dan shadow ringan pada wrapper aktif.
8. Gunakan CSS transition 180-220 ms untuk perubahan warna, background, transform, dan shadow.
9. Tambahkan reduced-motion override agar lift/color state tetap benar tanpa animasi gerak.
10. Pastikan label tidak ikut meloncat dan tetap muat pada viewport 320 px.
11. Sesuaikan main bottom padding agar elemen terakhir dapat discroll di atas bar plus icon lift.
12. Pertahankan focus ring, `aria-current`, `aria-label`, prefetch, permission filtering, dan semantic
    `<nav>`.
13. Uji 3, 4, dan 5 item visible karena permission dapat mengubah jumlah kolom.
14. Jangan memakai Motion untuk transisi sederhana ini. CSS menghindari runtime/bundle tambahan.
15. Hanya bila AVN-0 membuktikan perlu, tambahkan `viewportFit: 'cover'` dan selesaikan seluruh audit
    top/bottom/horizontal safe-area dalam patch yang sama.

### Acceptance Criteria

- Ikon 24 px dan setiap tab memiliki hit target minimal 44 x 44 px.
- Ikon aktif terlihat sedikit keluar di atas bar, tetapi tidak terpotong.
- Label, icon, badge/pending indicator, dan content tidak overlap.
- Bar tetap stabil ketika route berubah; tidak ada height/layout shift.
- Konten terakhir tidak tertutup pada 320 x 568, iPhone XR portrait, dan landscape.
- Home indicator memiliki jarak aman pada Safari tab dan PWA standalone.
- Reduced Motion menghasilkan perubahan state instan atau hampir instan tanpa lift animation.
- Desktop sidebar tidak berubah.

### Test Gate

- DOM bounding-box assertions untuk nav, tab, icon wrapper, label, dan main content.
- `aria-current="page"` berpindah tepat satu item.
- Tidak ada horizontal overflow pada 320 px.
- Screenshot portrait/landscape normal dan reduced-motion.
- Typecheck, lint, responsive navigation E2E, dan build lulus.

## 15. AVN-4: Regression Dan CI

**Tujuan:** menjadikan bug Safari dan layout bottom nav sebagai regression gate permanen.

### Langkah

1. Tambahkan test avatar terarah dengan route delay yang deterministik.
2. Tambahkan test warm repeat navigation Ranking -> Penilaian -> Ranking.
3. Catat URL unik dan jumlah response `200/304`; jangan mengandalkan screenshot saja.
4. Tambahkan test error fallback serta avatar version replacement.
5. Perluas `responsive-navigation.spec.ts` untuk tinggi bar, icon lift, target size, content padding,
   active state, dan reduced motion.
6. Tambahkan project WebKit mobile yang memakai device profile iPhone. WebKit Linux adalah sinyal
   engine, bukan pengganti Safari iOS fisik.
7. Perbarui workflow browser untuk menginstal WebKit hanya setelah suite stabil dan waktu CI diukur.
8. Pertahankan Chromium desktop/mobile serta PWA boundary test.
9. Pastikan test memakai akun non-production/session harness dan fixture tanpa PII.

### Matrix Minimum

| Kasus                                | Chromium | WebKit  | iPhone XR fisik |
| ------------------------------------ | -------- | ------- | --------------- |
| Cold avatar                          | Wajib    | Wajib   | Wajib           |
| Warm Ranking -> Penilaian -> Ranking | Wajib    | Wajib   | Wajib           |
| Delayed image + skeleton             | Wajib    | Wajib   | Observasi       |
| 401/403/404 fallback                 | Wajib    | Wajib   | Opsional        |
| Avatar diganti/version URL berubah   | Wajib    | Wajib   | Wajib           |
| Bottom nav 320 px                    | Wajib    | Wajib   | -               |
| iPhone XR portrait/landscape         | Emulasi  | Emulasi | Wajib           |
| Safe-area Safari tab                 | -        | Emulasi | Wajib           |
| PWA standalone/home indicator        | -        | -       | Wajib           |
| Reduced Motion                       | Wajib    | Wajib   | Wajib           |
| VoiceOver label/current tab          | DOM      | DOM     | Wajib           |

### Full Quality Gate

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:types
npm.cmd run test:ops
npm.cmd run build
npm.cmd run test:api
npm.cmd run test:e2e -- --workers=1
git diff --check
```

Jalankan security regression bila route auth/cache atau helper permission berubah. Tidak perlu
menjalankan migration push karena roadmap ini tidak memiliki perubahan schema.

## 16. AVN-5: Staging Rollout Dan Device Gate

**Tujuan:** membuktikan hasil pada environment dan perangkat yang melaporkan masalah.

### Langkah

1. Commit perubahan dalam unit review yang jelas. Disarankan memisahkan avatar/cache dan bottom nav.
2. Push hanya ke branch `staging`.
3. Tunggu seluruh CI dan Vercel Preview `Ready`.
4. Jalankan API cache/security smoke pada Preview dengan fixture sintetis.
5. Jalankan Chromium dan WebKit terhadap Preview.
6. Ulangi checklist AVN-0 pada iPhone XR yang sama.
7. Catat versi iOS, Safari/PWA mode, tiga repeat navigation, status cache, dan transferred bytes.
8. Verifikasi skeleton hanya muncul saat response/decode benar-benar tertunda.
9. Verifikasi bottom nav portrait/landscape, keyboard saat input terbuka, safe-area, home indicator,
   scroll ke konten terakhir, dan Reduced Motion.
10. Perbarui dokumen ini, `docs/OPERATIONS_RUNBOOK.md`, dan roadmap induk dengan bukti numerik.
11. Jangan promote production sampai backup/restore gate production pada roadmap induk selesai.

### Acceptance Criteria

- Pengguna tidak melihat frame avatar kosong pada repeat navigation.
- Repeat avatar tidak mengirim body yang sama kembali, atau menghasilkan conditional `304` tanpa
  Storage body bila Safari memilih revalidation.
- Skeleton dan fallback bekerja tanpa layout shift.
- Bottom nav memenuhi seluruh matrix viewport dan aksesibilitas.
- Tidak ada regresi role, scope, logout, PWA cache boundary, desktop sidebar, atau upload avatar.
- iPhone XR fisik dinyatakan lulus dengan versi iOS dan operator tercatat.

## 17. Security Gate

Agent dilarang menutup milestone cache sebelum membuktikan:

1. request tanpa session tetap ditolak;
2. user nonaktif tetap ditolak;
3. role tanpa `cashier_photos.view` tetap ditolak;
4. cache validator tidak dapat melewati auth;
5. error auth tidak dicache lama;
6. logout tidak menggunakan Service Worker/Cache Storage untuk menampilkan avatar privat;
7. path traversal dan path non-avatar tetap ditolak;
8. original dan thumbnail tidak berbagi ETag yang salah;
9. avatar baru tidak tertukar dengan versi lama;
10. nilai Cookie, token, service-role key, dan URL bertanda tangan tidak masuk log/test artifact.

## 18. Performance Budget

Nilai berikut adalah gate awal. Agent boleh memperketat setelah AVN-0, tetapi tidak boleh
melonggarkan tanpa decision record.

| Metrik                                         | Target                                               |
| ---------------------------------------------- | ---------------------------------------------------- |
| Layout shift avatar                            | `0` akibat loading/error                             |
| Duplicate body pada repeat navigation          | `0` untuk URL versioned yang sama selama cache valid |
| Conditional repeat                             | `304`, body `0`, auth tetap dijalankan               |
| Storage download pada matching `If-None-Match` | `0`                                                  |
| Skeleton scope                                 | Hanya frame avatar unresolved                        |
| Forced skeleton delay                          | `0 ms`                                               |
| Icon visible size                              | 24 x 24 CSS px                                       |
| Bottom-nav hit target                          | Minimal 44 x 44 CSS px                               |
| Icon state transition                          | 180-220 ms, satu kali                                |
| Reduced Motion                                 | Tanpa animated lift/scale                            |
| Horizontal overflow                            | `0` pada viewport minimum 320 px                     |
| Private API dalam Service Worker Cache         | `0`                                                  |

## 19. Risiko Dan Mitigasi

| Risiko                                            | Mitigasi                                                               |
| ------------------------------------------------- | ---------------------------------------------------------------------- |
| Menghapus `Vary: Cookie` membocorkan cache lokal  | Pertahankan default; ubah hanya dengan threat model dan approval       |
| Skeleton dipaksa sehingga cache hit terasa lambat | Tidak ada minimum duration; cached complete path harus langsung loaded |
| Semua avatar dibuat eager                         | Batasi above-the-fold berdasarkan baseline                             |
| ETag diberikan sebelum auth                       | Auth/permission/path validation harus selalu lebih dulu                |
| `304` masih download Storage                      | Hitung validator sebelum download untuk path versioned                 |
| Error response tersimpan lama                     | `private, no-store` untuk seluruh error                                |
| Active icon offside terpotong                     | Nav overflow visible dan bounding-box test                             |
| Bar baru menutupi konten                          | Shared height/lift contract dan scroll-end assertion                   |
| `viewport-fit=cover` merusak header               | Jangan aktifkan tanpa full safe-area audit                             |
| Animasi mengganggu pengguna                       | CSS transition singkat dan reduced-motion                              |
| WebKit CI dianggap sama dengan iOS Safari         | Tetap wajibkan physical iPhone gate                                    |
| Screenshot berisi PII                             | Gunakan fixture sintetis atau blur/crop sebelum commit                 |

## 20. Rollback

### Avatar

1. Revert visual state component bila skeleton/fallback menyebabkan regresi.
2. ETag/304 dapat direvert terpisah karena tidak membutuhkan schema rollback.
3. Kembalikan header cache sebelumnya bila conditional response bermasalah.
4. Jangan menghapus file avatar atau mengubah database saat rollback UI/cache.

### Bottom Navigation

1. Kembalikan class bar/icon/main padding ke baseline commit.
2. Jika `viewportFit` sempat ditambah, revert bersama seluruh safe-area adjustment terkait.
3. Pastikan desktop sidebar tidak ikut direvert atau berubah.

Rollback wajib diikuti typecheck, lint, build, targeted E2E, dan retest viewport mobile.

## 21. Aturan Kerja Agent

### Sebelum Milestone

1. Baca dokumen ini sampai akhir.
2. Baca `AGENTS.md`, `docs/DEVELOPER_GUIDE.md`, dan `docs/OPERATIONS_RUNBOOK.md`.
3. Baca dokumentasi Next.js lokal di `node_modules/next/dist/docs/` untuk API yang akan diubah.
4. Jalankan `git status --short`.
5. Jangan mengubah atau men-stage `supabase/config.toml` milik user.
6. Catat baseline commit, branch, waktu mulai, dan agent pada Bukti Milestone.
7. Ubah hanya satu status milestone menjadi `IN_PROGRESS`.

### Setelah Milestone

1. Jalankan test gate milestone.
2. Catat command dan hasil numerik, bukan hanya kata `tested`.
3. Catat file yang berubah dan alasan setiap perubahan.
4. Catat metrik cold/warm, status HTTP, transferred bytes, dan viewport bila relevan.
5. Perbarui Temuan, Decision Log, Bukti Milestone, dan Handoff.
6. Ubah status menjadi `COMPLETE` hanya jika acceptance criteria lulus.
7. Jika device/credential tidak tersedia, gunakan `IMPLEMENTED_PENDING_VALIDATION`, bukan
   `COMPLETE`.
8. Commit perubahan dokumen bersama milestone atau segera setelah bukti remote tersedia.

### Kondisi Blocked

Gunakan `BLOCKED` hanya bila agent tidak dapat membuat kemajuan setelah mencoba jalur aman yang
tersedia. Catat blocker yang konkret, upaya yang sudah dilakukan, dan satu tindakan yang diperlukan
dari user/operator.

## 22. Bukti Milestone

| Milestone | Agent/waktu       | Commit/deployment  | Test dan metrik                                              | Status                           | Catatan/artefak                                      |
| --------- | ----------------- | ------------------ | ------------------------------------------------------------ | -------------------------------- | ---------------------------------------------------- |
| AVN-0     | Codex, 2026-08-12 | `a2f2a78` baseline | Audit source selesai; device/network evidence belum tersedia | `IMPLEMENTED_PENDING_VALIDATION` | Supabase lokal tidak tersedia untuk network capture  |
| AVN-1     | Codex, 2026-08-12 | Worktree           | Typecheck, lint, unit test, dan build lulus                  | `COMPLETE`                       | Skeleton, decode lifecycle, dan initials fallback    |
| AVN-2     | Codex, 2026-08-12 | Worktree           | Unit validator lulus; API integration belum dapat dijalankan | `IMPLEMENTED_PENDING_VALIDATION` | ETag/304 auth-gated; `Vary: Cookie` dipertahankan    |
| AVN-3     | Codex, 2026-08-12 | Worktree           | Typecheck, lint, build lulus; physical safe-area belum diuji | `IMPLEMENTED_PENDING_VALIDATION` | Tinggi 76 px, icon 24 px, active lift 12 px          |
| AVN-4     | Codex, 2026-08-12 | Worktree           | 36 test terdaftar; WebKit project + CI install ditambahkan   | `IMPLEMENTED_PENDING_CI`         | Authenticated E2E menunggu credential non-production |
| AVN-5     | Belum             | -                  | -                                                            | `READY`                          | -                                                    |

## 23. Decision Log

| Tanggal    | Keputusan                                                          | Alasan                                                            | Status                   |
| ---------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------ |
| 2026-08-12 | Ukur Safari sebelum mengubah cache header                          | Network refetch dan decode remount memerlukan solusi berbeda      | `ACCEPTED`               |
| 2026-08-12 | Skeleton tidak memiliki minimum display duration                   | Cache hit tidak boleh diperlambat demi menampilkan skeleton       | `ACCEPTED`               |
| 2026-08-12 | Pertahankan private proxy dan Service Worker public-only           | Auth revocation lebih penting daripada cache lintas session       | `ACCEPTED`               |
| 2026-08-12 | Pertahankan `Vary: Cookie` sampai ada bukti dan security review    | Menghindari pelemahan cache partition tanpa threat model          | `ACCEPTED`               |
| 2026-08-12 | Gunakan CSS transition untuk bottom nav                            | Perubahan sederhana tidak membutuhkan runtime animasi             | `ACCEPTED`               |
| 2026-08-12 | Hanya ikon aktif yang offside                                      | Hierarki jelas tanpa membuat lima elemen saling bersaing          | `ACCEPTED`               |
| 2026-08-12 | `viewportFit: cover` bersifat conditional                          | Dapat mengubah safe-area seluruh aplikasi                         | `ACCEPTED`               |
| 2026-08-12 | Skeleton avatar memakai lifecycle lokal dan tanpa artificial delay | Cache hit tidak boleh diperlambat dan layout tidak boleh bergeser | `IMPLEMENTED`            |
| 2026-08-12 | Error API diberi `private, no-store`                               | Error auth/path tidak boleh disimpan oleh cache browser/proxy     | `IMPLEMENTED`            |
| 2026-08-12 | Playwright memakai project WebKit mobile                           | Engine WebKit perlu masuk regression matrix CI                    | `IMPLEMENTED_PENDING_CI` |

## 24. Handoff Awal

Agent berikutnya harus memulai dari AVN-0. Jangan langsung mengubah `Cache-Control`, `Vary`, atau
Service Worker. Baseline yang harus dikumpulkan pertama adalah:

1. versi iOS pada iPhone XR;
2. apakah repeat avatar adalah memory cache, disk cache, `304`, atau full `200`;
3. transferred bytes untuk URL yang sama;
4. urutan route timing dibanding image timing;
5. apakah blank terjadi sebelum request selesai atau setelah response selesai;
6. ukuran aktual bottom bar/icon dan safe-area portrait/landscape.

AVN-1, AVN-2, AVN-3, dan AVN-4 sudah diimplementasikan sebagai perubahan terpisah secara logis.
AVN-2 masih membutuhkan API integration test pada environment Supabase yang aktif. AVN-5 harus
menjalankan staging smoke dan validasi iPhone XR sebelum status production dinyatakan lulus. Push ke
production tidak boleh dianggap sebagai bukti bahwa physical device gate sudah lulus.

## 25. Referensi Resmi

- [Next.js Image component](https://nextjs.org/docs/app/api-reference/components/image)
- [Next.js Link component dan prefetch](https://nextjs.org/docs/app/api-reference/components/link)
- [Next.js viewport API](https://nextjs.org/docs/app/api-reference/functions/generate-viewport)
- [MDN HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching)
- [MDN Vary header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Vary)
- [MDN HTMLImageElement dan decode](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement)
- [WebKit safe-area dan viewport-fit](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)
- [Apple Human Interface Guidelines: Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)
- [WCAG 2.2 target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)
- [WCAG target size enhanced 44 px](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced)
- [MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion)

## 26. Log Perubahan Dokumen

| Versi | Tanggal    | Agent | Perubahan                                                                           |
| ----- | ---------- | ----- | ----------------------------------------------------------------------------------- |
| 1.0.0 | 2026-08-12 | Codex | Audit avatar Safari, private cache, bottom nav, dan roadmap awal                    |
| 1.1.0 | 2026-08-12 | Codex | Implementasi skeleton, ETag/304, bottom nav, WebKit test project, dan evidence awal |
