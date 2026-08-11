# Roadmap: Dokumentasi Bukti Foto Sesi Pendampingan

Dokumen ini adalah sumber kerja utama untuk menambahkan bukti foto pada sesi Pendampingan tanpa
merusak alur pencatatan yang sudah berjalan, tanpa membuka akses foto lintas cabang, dan tanpa
menyimpan file yang lebih besar atau lebih banyak dari kebutuhan. Agent wajib memperbarui status,
bukti pengujian, keputusan, risiko, dan handoff setelah setiap milestone lulus.

Roadmap ini dibuat dari audit source code dan migrasi aktual. Source implementation, validasi
database disposable lokal, migrasi database staging, dan deploy awal Vercel Preview sudah selesai.
Smoke runtime authenticated serta matriks device/role belum lengkap sehingga fitur belum boleh
dianggap siap production.

## 1. Identitas

| Field                         | Nilai                                                   |
| ----------------------------- | ------------------------------------------------------- |
| Status                        | `IMPLEMENTED_PENDING_EXTERNAL_VALIDATION`               |
| Baseline commit               | `365c671`                                               |
| Dibuat                        | 2026-08-11 WIB                                          |
| Milestone aktif               | `ME-7`                                                  |
| Framework                     | Next.js App Router 16.3.0, React 19, Tailwind CSS 3.4   |
| Backend                       | Supabase Auth, PostgreSQL, RLS, Storage, Route Handlers |
| Runtime production            | Vercel Functions, region repository `syd1`              |
| Migration terbaru saat audit  | `0057_dashboard_snapshot.sql`                           |
| Migration target pertama      | `0058_mentoring_evidence.sql`                           |
| Supabase staging              | `fkanacflupmyuohkjque`, migrasi `0001..0058`            |
| Supabase production           | `gxnlhtqnfgcbkfqoxpoa`, terakhir diverifikasi `0057`    |
| Perubahan lokal di luar scope | `supabase/config.toml` milik user, jangan diubah/revert |

## 2. Ringkasan Eksekutif

Arsitektur yang direkomendasikan adalah:

1. Bukti foto bersifat opsional agar sesi lama dan jaringan buruk tidak memblokir Pendampingan.
2. Maksimal tiga foto aktif untuk satu sesi.
3. Foto asli tidak disimpan. Hanya satu file kanonik WebP per bukti.
4. Dimensi maksimum file kanonik adalah 1280 x 1280 tanpa crop dan tanpa upscaling.
5. Target file adalah 300 KiB dan batas keras 350 KiB per foto.
6. Client mengecilkan file sebelum request; server tetap memvalidasi dan mengubah ulang dengan
   `sharp`. Kompresi client adalah optimasi transport, bukan boundary keamanan.
7. Bucket baru `mentoring-evidence` bersifat private, hanya menerima `image/webp`, dan memiliki
   batas 358400 byte per object.
8. Metadata berada di tabel `mentoring_evidence` dengan status `pending` atau `ready`.
9. Upload memakai reservation RPC agar kuota, scope cabang, permission, checksum, dan race condition
   ditangani atomik di PostgreSQL.
10. File dikirim satu per request setelah sesi teks berhasil dibuat. Kegagalan foto tidak membuat
    sesi kedua dan tidak membatalkan catatan Pendampingan yang sudah valid.
11. File `pending` yang gagal dibersihkan secara idempotent melalui Storage API dan cron harian.
12. File `ready` tidak pernah dihapus otomatis hanya untuk menghemat kapasitas.
13. Daftar Pendampingan tidak memuat gambar. Foto hanya dimuat lazy pada halaman detail.
14. Akses gambar melalui proxy privat yang memeriksa session, permission, status user, dan scope
    cabang pada setiap revalidasi browser.

Dengan batas keras tersebut, satu sesi memakai maksimum 1,075,200 byte atau sekitar 1.03 MiB.
Seribu sesi penuh memakai maksimum sekitar 1.00 GiB; sepuluh ribu sesi penuh sekitar 10.01 GiB.
Angka aktual seharusnya lebih rendah karena target kompresi 300 KiB dan tidak semua sesi akan berisi
tiga foto. Agent wajib mengukur angka aktual, bukan menganggap estimasi ini sebagai pemakaian nyata.

## 3. Hasil Audit Aplikasi Saat Ini

### 3.1 Alur Pendampingan

| Area          | Kondisi saat audit                                                                                                   | Implikasi untuk fitur baru                                                       |
| ------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Form          | `src/components/mentoring/MentoringForm.tsx` mengirim JSON berisi outlet, tanggal, catatan outlet, dan catatan kasir | Picker foto harus ditambahkan tanpa mengubah kontrak JSON sesi yang sudah stabil |
| API create    | `POST /api/mentoring-sessions` memakai `requirePermission('mentoring')`, Zod, admin client, dan RPC                  | Pembuatan sesi dan upload foto harus tetap menjadi dua tahap yang eksplisit      |
| Transaksi     | `create_mentoring_session_atomic` membuat sesi dan catatan kasir dalam satu transaksi DB                             | Jangan memindahkan insert sesi ke multipart upload atau query client terpisah    |
| Authorization | RPC memvalidasi user aktif, permission, outlet aktif, cabang, kasir, dan tanggal                                     | Reservation bukti harus mengulang invariant relevan di server/RPC                |
| Detail        | `src/app/(app)/mentoring/[id]/page.tsx` menampilkan sesi dan catatan kasir                                           | Gallery dan retry upload ditempatkan di halaman ini                              |
| List          | `MentoringList.tsx` memakai pagination/infinite scroll                                                               | Jangan menambahkan object URL atau fetch foto ke list v1                         |
| Data lama     | Sesi yang ada tidak memiliki bukti foto                                                                              | Relasi bukti wajib zero-to-many dan empty state harus valid                      |

### 3.2 Fondasi Foto Yang Dapat Dipakai Ulang

1. Dependency produksi `sharp` sudah tersedia.
2. Flow avatar sudah memiliki validasi MIME/signature, batas byte, batas pixel, transformasi server,
   upload bucket private, rollback partial failure, dan proxy download privat.
3. `CashierAvatarForm` sudah memiliki pola object preview dan transformasi canvas di client.
4. `CashierAvatar` sudah membuktikan protected proxy dapat dipakai melalui `next/image` dengan
   `unoptimized`.
5. API wrapper sudah menormalkan error dan mendukung rate limit best-effort.
6. Test unit storage, API contract smoke, security regression, database type verification, dan
   Playwright sudah tersedia.

Pola avatar harus dijadikan referensi, bukan disalin mentah. Foto Pendampingan tidak perlu crop,
tidak perlu thumbnail tersimpan, memiliki kuota per sesi, dan membutuhkan transaksi lintas database
serta Storage yang berbeda dari satu avatar per kasir.

### 3.3 Celah Yang Harus Ditutup

| ID   | Temuan                                            | Risiko bila diabaikan                                                      | Prioritas |
| ---- | ------------------------------------------------- | -------------------------------------------------------------------------- | --------- |
| A-1  | Belum ada tabel metadata bukti                    | File tidak dapat diotorisasi atau diaudit secara konsisten                 | P0        |
| A-2  | Database dan Storage tidak berbagi satu transaksi | File yatim atau row tanpa object saat salah satu operasi gagal             | P0        |
| A-3  | Belum ada kuota foto per sesi                     | Storage dan CPU kompresi dapat disalahgunakan                              | P0        |
| A-4  | Belum ada bucket khusus dan policy                | Bukti dapat tercampur dengan avatar atau salah akses                       | P0        |
| A-5  | Belum ada validasi server untuk bukti             | Fake extension, decompression bomb, metadata GPS, atau animasi dapat masuk | P0        |
| A-6  | Retry form saat ini dapat membuat sesi baru       | Sesi Pendampingan duplikat setelah upload parsial gagal                    | P0        |
| A-7  | Belum ada cleanup upload `pending`                | Storage terus bertambah akibat crash atau timeout                          | P0        |
| A-8  | Cron helper hanya membaca `x-cron-secret`         | Vercel Cron yang memakai Bearer secret akan ditolak                        | P1        |
| A-9  | Belum ada kebijakan retensi bukti valid           | Kapasitas tumbuh tanpa keputusan bisnis atau bukti terhapus diam-diam      | P1        |
| A-10 | Belum ada observability byte/count                | Penggunaan storage tidak dapat diproyeksikan atau diberi alert             | P1        |
| A-11 | Foto berpotensi memuat wajah, dokumen, atau GPS   | Kebocoran data pribadi dan akses setelah role berubah                      | P0        |
| A-12 | Payload Function Vercel dibatasi platform         | Upload asli dari kamera dapat gagal sebelum handler berjalan               | P0        |

### 3.4 Constraint Platform Yang Relevan

1. Vercel Functions membatasi request dan response body pada 4.5 MB. Karena itu setiap foto harus
   dikompres di client dan dikirim sebagai satu request terpisah dengan batas input server 1 MiB.
2. Bucket Supabase dapat mengunci ukuran object dan allowed MIME type; batas aplikasi tetap harus
   divalidasi lagi di server.
3. Bucket private tetap membutuhkan authorization untuk download. Service role hanya boleh berada
   di server dan tidak boleh dikirim ke browser.
4. Metadata `storage.objects` tidak boleh dihapus langsung dengan SQL. Cleanup object wajib memakai
   Supabase Storage API agar file fisik juga hilang dari billing.
5. `sharp` membuang metadata secara default bila agent tidak memanggil `keepMetadata()` atau
   `withMetadata()`. Auto-orientation harus dilakukan sebelum resize.

## 4. Keputusan Produk dan Scope V1

### 4.1 Keputusan Yang Dikunci

| ID   | Keputusan                                                        | Alasan                                                                             |
| ---- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| D-1  | Bukti opsional, 0 sampai 3 foto per sesi                         | Menjaga kompatibilitas sesi lama dan tidak memblokir pekerjaan saat jaringan buruk |
| D-2  | Foto dipilih sebelum submit, tetapi diupload setelah sesi dibuat | Session ID diperlukan untuk ownership dan path object                              |
| D-3  | Satu request hanya membawa satu foto                             | Membatasi memory, payload, retry blast radius, dan kegagalan parsial               |
| D-4  | Tidak menyimpan original                                         | Penghematan storage terbesar dan menghilangkan EXIF/GPS                            |
| D-5  | Tidak menyimpan thumbnail                                        | Foto tidak tampil pada list; satu salinan cukup untuk detail                       |
| D-6  | Tidak melakukan crop                                             | Bukti perlu mempertahankan konteks kejadian, bukan hanya wajah                     |
| D-7  | Reuse permission `mentoring`                                     | Foto adalah bagian dari domain Pendampingan, bukan permission terpisah             |
| D-8  | Viewer mengikuti branch scope sesi                               | Mencegah manager melihat bukti cabang lain                                         |
| D-9  | Uploader hanya conductor sesi atau admin                         | Mencegah user satu cabang menambah bukti ke sesi orang lain                        |
| D-10 | Tidak ada delete/replace bukti `ready` pada v1                   | Menghindari penghilangan bukti tanpa audit trail dan storage race baru             |
| D-11 | Evidence `ready` mengikuti umur sesi                             | Tidak ada auto-delete valid evidence sampai owner menetapkan retensi tertulis      |
| D-12 | Dedup hanya di dalam satu sesi                                   | Global dedup memperumit ownership, lifecycle, dan dapat membuka side channel       |
| D-13 | Upload baru dilindungi feature flag server                       | Rollout dan rollback tidak memerlukan migrasi destruktif                           |
| D-14 | Gallery tetap read-only saat flag upload off                     | Bukti yang sudah ada tidak hilang dari UI ketika upload dihentikan                 |

Sebelum production, owner harus menyetujui D-10 dan D-11 atau menggantinya dengan kebijakan admin
removal/retention yang mempunyai alasan, audit log, dan cleanup object. Agent tidak boleh diam-diam
menambahkan auto-delete untuk mengejar target storage.

### 4.2 Di Luar Scope V1

- Video, audio, PDF, GIF, SVG, dan animated WebP.
- HEIC/HEIF. Camera capture iPhone wajib diuji; bila browser mengirim HEIC, dukungan format menjadi
  milestone terpisah dan tidak boleh diakali dengan menyimpan original sementara tanpa desain baru.
- OCR, face recognition, watermark, annotation, dan AI image analysis.
- Foto pada list Pendampingan, dashboard, notification, atau export.
- Public bucket, public URL, dan signed URL berumur panjang.
- Cross-session physical deduplication.
- Bulk upload lebih dari tiga foto.
- Post-save delete/replace tanpa audit trail.

## 5. Goals dan Non-Goals

### G-1: Storage Terkendali

Maksimum satu object WebP 350 KiB per bukti dan tiga object per sesi. Tidak ada original, thumbnail,
atau object duplikat dalam sesi yang sama.

### G-2: Security Setara Dengan Data Pendampingan

User nonaktif, user tanpa permission, manager cabang lain, dan request langsung ke Storage tidak
dapat membaca atau menulis bukti.

### G-3: Kegagalan Tidak Merusak Sesi

Session dan catatan kasir tetap atomik. Upload parsial dapat diulang tanpa membuat sesi baru, tanpa
melewati kuota, dan tanpa meninggalkan object permanen tanpa metadata.

### G-4: Mobile Tetap Layak

Pemilihan kamera/gallery, preview, kompresi, dan upload berjalan berurutan agar memory iPhone tidak
melonjak. Input tidak memicu zoom dan UI tidak bergeser saat status berubah.

### G-5: Fetch Tetap Ringan

List Pendampingan tidak mengambil foto. Detail mengambil metadata kecil pada server dan browser
hanya meminta gambar ketika elemen lazy image mendekati viewport.

### G-6: Dapat Dioperasikan

Tim dapat melihat count, total byte, average byte, compression ratio, stale pending, error rate, dan
hasil cleanup tanpa membaca foto atau PII dari log.

### Non-Goals

Fitur ini tidak bertujuan menjadi digital asset manager, media CDN publik, atau sistem arsip legal
yang mendukung immutable retention dan legal hold. Kebutuhan tersebut memerlukan desain terpisah.

## 6. Invariant Yang Tidak Boleh Dilanggar

1. `create_mentoring_session_atomic` tetap menjadi satu-satunya flow create sesi dan notes.
2. Tidak ada service-role key, object path mentah, atau signed URL permanen di client state/log.
3. Client compression tidak pernah menggantikan server validation.
4. Hanya file hasil encode server yang boleh masuk bucket.
5. Object path dibuat server/RPC, bukan nama file dari user.
6. Upload memakai `upsert: false`; object `ready` tidak ditimpa.
7. Kuota tiga dihitung terhadap row `pending` dan `ready` di bawah lock session.
8. Semua write metadata dilakukan service role melalui RPC/route yang sudah mengautorisasi actor.
9. Direct write tabel dari role `authenticated` dicabut.
10. Direct access bucket dari browser tidak memiliki permissive policy.
11. RLS select tabel tetap memeriksa user aktif, permission, dan outlet/branch access.
12. FK session pada evidence memakai `ON DELETE RESTRICT`, bukan cascade, agar object tidak menjadi
    yatim ketika session dihapus langsung.
13. Cleanup hanya memilih `pending` yang lebih tua dari threshold; tidak pernah memilih `ready`.
14. Penghapusan object memakai Storage API, bukan `delete from storage.objects`.
15. Existing session tanpa evidence tetap dapat dibuka, dinilai, dan ditampilkan.
16. Service worker tidak menyimpan response API atau gambar privat dalam Cache Storage.
17. Tidak ada foto atau PII pada structured log, analytics event, screenshot test production, atau
    error monitoring.
18. Vercel preview/E2E tidak boleh diarahkan ke Supabase production untuk test upload, cleanup,
    concurrency, atau migration.

## 7. Arsitektur Target

### 7.1 Alur Sukses

```text
User memilih 0..3 foto
  -> client membuat preview dan kompresi transport secara berurutan
  -> POST /api/mentoring-sessions (JSON, flow lama)
  -> API mengembalikan session.id
  -> client menyimpan createdSessionId dan tidak pernah POST sesi lagi
  -> POST satu foto ke /api/mentoring-sessions/{id}/evidence
  -> server auth + scope + rate limit + validate + Sharp canonical WebP
  -> server menghitung SHA-256
  -> reservation RPC lock session, cek kuota/dedup, insert row pending
  -> server upload object ke private bucket dengan upsert false
  -> finalize RPC mengubah pending menjadi ready
  -> API mengembalikan metadata evidence
  -> client mengulang untuk foto berikutnya
  -> redirect ke /mentoring/{id}
```

### 7.2 Mengapa Sesi Dibuat Lebih Dahulu

Storage dan PostgreSQL tidak menyediakan satu transaksi bersama. Memasukkan upload ke RPC sesi tidak
akan membuat Storage menjadi atomik. Dengan sesi dibuat lebih dahulu:

- session ID menjadi ownership boundary yang stabil;
- catatan teks tetap berhasil walau jaringan foto gagal;
- retry hanya mengulang foto;
- user dapat melanjutkan upload dari halaman detail;
- tidak perlu menyimpan original sementara sebelum session ada.

### 7.3 Matriks Kegagalan

| Titik gagal                   | State yang mungkin                              | Tindakan langsung                                         | Recovery                                                    |
| ----------------------------- | ----------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| Client compression            | Belum ada session/object                        | Tandai file gagal, sesi belum disubmit                    | Pilih ulang atau retry file                                 |
| Create session                | Tidak ada evidence                              | Tampilkan error create sesi                               | Submit ulang sesi aman sesuai flow lama                     |
| Optimize server               | Session ada, belum ada row                      | Tolak file; jangan reserve                                | Retry hanya foto dari detail/form                           |
| Reservation RPC               | Session ada, tanpa object                       | Return 403/409/422 yang terstruktur                       | Perbaiki permission/kuota/file; jangan create session lagi  |
| Storage upload                | Row `pending`, object mungkin parsial/tidak ada | Panggil Storage remove lalu hapus pending                 | Cron menghapus pending bila process crash                   |
| Finalize RPC                  | Row `pending`, object ada                       | Remove object lalu hapus pending bila request masih hidup | Cron menangani crash sebelum rollback                       |
| Response hilang setelah ready | Row dan object `ready`                          | Retry menghasilkan checksum sama                          | API mengembalikan existing ready sebagai idempotent success |
| Redirect gagal                | Session/evidence sudah valid                    | Tampilkan link lanjut ke detail                           | Refresh/detail membaca state server                         |
| Cron gagal                    | Pending lama tetap ada                          | Log error tanpa data sensitif                             | Vercel tidak retry; alert dan manual rerun                  |

## 8. Kontrak Database

### 8.1 Migration

Buat migration baru `supabase/migrations/0058_mentoring_evidence.sql`. Jangan mengedit migration lama
yang sudah pernah diterapkan. Migration harus idempotent sejauh pola repository memungkinkan dan
harus dapat dijalankan pada local Supabase sebelum linked production.

### 8.2 Tabel `public.mentoring_evidence`

| Kolom            | Tipe/constraint                                                     | Keterangan                                  |
| ---------------- | ------------------------------------------------------------------- | ------------------------------------------- |
| `id`             | `uuid primary key default gen_random_uuid()`                        | Evidence ID immutable                       |
| `session_id`     | `uuid not null references mentoring_session(id) on delete restrict` | Parent dan authorization scope              |
| `object_path`    | `text not null unique`                                              | Path server-generated                       |
| `content_sha256` | `text not null`                                                     | Lowercase 64 hex untuk retry/dedup per sesi |
| `sort_order`     | `smallint not null check (sort_order between 0 and 2)`              | Urutan tampilan                             |
| `status`         | `text not null check (status in ('pending','ready'))`               | Lifecycle object                            |
| `mime_type`      | `text not null check (mime_type = 'image/webp')`                    | Output kanonik                              |
| `byte_size`      | `integer not null check (byte_size between 1 and 358400)`           | Capacity source of truth                    |
| `width`          | `integer not null check (width between 1 and 1280)`                 | Metadata output                             |
| `height`         | `integer not null check (height between 1 and 1280)`                | Metadata output                             |
| `created_by`     | `uuid not null references users(id) on delete restrict`             | Actor uploader                              |
| `created_at`     | `timestamptz not null default now()`                                | Cleanup age                                 |
| `ready_at`       | `timestamptz null`                                                  | Harus terisi hanya saat ready               |

Constraint tambahan:

1. Unique aktif `(session_id, sort_order)` untuk row `pending`/`ready`.
2. Unique aktif `(session_id, content_sha256)` untuk mencegah file sama dalam satu sesi.
3. Check SHA-256 `^[0-9a-f]{64}$`.
4. Check `ready_at is null` saat pending dan `ready_at is not null` saat ready.
5. Check path ketat:
   `session/<session_uuid>/evidence-<evidence_uuid>.webp`.
6. Index `(session_id, status, sort_order)` untuk detail.
7. Index `(status, created_at)` untuk cleanup.

Agent harus memastikan partial unique index benar-benar menghitung seluruh row yang masih memakai
slot. Bila v1 hanya memiliki status pending/ready, index non-partial juga dapat dipakai. Jangan
membuat unique global pada checksum karena dua sesi boleh memiliki foto sama tanpa berbagi object.

### 8.3 Reservation dan Finalization RPC

Buat service-role-only function dengan fixed `search_path`, revoke default execute, dan grant hanya
ke `service_role`:

1. `reserve_mentoring_evidence(...)`
   - menerima session ID, actor ID, checksum, byte, width, dan height;
   - mengunci row `mentoring_session for update`;
   - memvalidasi actor aktif dan permission `mentoring`;
   - memvalidasi akses outlet/branch;
   - hanya mengizinkan `conducted_by = actor` atau role admin;
   - mencari checksum existing; row ready dikembalikan sebagai idempotent existing;
   - menghitung pending + ready di dalam lock dan menolak foto keempat;
   - memilih slot kosong 0..2;
   - membuat UUID dan object path sendiri;
   - insert `pending` dan mengembalikan row serta flag `was_existing`.
2. `finalize_mentoring_evidence(...)`
   - hanya mengubah row pending yang sesuai actor/request menjadi ready;
   - mengisi `ready_at = now()`;
   - idempotent bila row sudah ready dengan metadata/checksum sama;
   - menolak mismatch.

Jika cleanup atau abort memakai RPC tambahan, RPC itu juga service-role-only dan hanya boleh
menghapus row `pending`. Tidak boleh ada RPC generic delete berdasarkan object path dari request.

### 8.4 RLS dan Grant

1. Enable RLS pada tabel baru.
2. Grant `select` kepada `authenticated`; revoke insert/update/delete.
3. Tambahkan restrictive `active_user_guard` secara eksplisit. Migration `0027` tidak otomatis
   mencakup tabel yang dibuat kemudian.
4. Select policy hanya mengembalikan row `ready` bila:
   - user memiliki permission `mentoring`; dan
   - user memiliki akses ke outlet milik parent session.
5. Tidak ada policy untuk anon.
6. Security regression harus membuktikan manager cabang A tidak membaca metadata cabang B.

### 8.5 Generated Type

Setelah migration lulus:

- regenerate `src/types/database.ts` dari schema aktual;
- jangan menulis type tabel/RPC secara manual;
- update `scripts/verify-database-types.mjs` agar marker tabel dan RPC baru diverifikasi;
- jalankan diff dan pastikan tidak ada churn schema yang tidak terkait.

## 9. Kontrak Supabase Storage

### 9.1 Bucket

Migration yang sama membuat atau mengunci konfigurasi bucket:

| Setting         | Nilai                |
| --------------- | -------------------- |
| ID              | `mentoring-evidence` |
| Public          | `false`              |
| File size limit | `358400` byte        |
| Allowed MIME    | `image/webp` saja    |

Tidak boleh memakai bucket `cashier-photos` karena lifecycle, policy, ukuran, dan domain aksesnya
berbeda. Tidak perlu membuat direct `storage.objects` policy untuk bucket baru; ketiadaan permissive
policy memastikan browser tidak dapat mengakses object secara langsung. Semua upload/download
melewati server setelah application authorization.

### 9.2 Path

Format tunggal:

```text
session/<session-uuid>/evidence-<evidence-uuid>.webp
```

Nama file asli tidak disimpan pada path, response, atau log. Path harus lolos parser ketat pada
upload, delivery, rollback, dan cleanup. Prefix atau UUID yang tidak cocok dengan row harus ditolak.

### 9.3 Lifecycle

| Status DB | Object yang diharapkan             | Boleh ditampilkan | Cleanup otomatis  |
| --------- | ---------------------------------- | ----------------- | ----------------- |
| `pending` | Belum ada atau baru selesai upload | Tidak             | Ya, setelah 2 jam |
| `ready`   | Tepat satu object WebP             | Ya                | Tidak             |

Jangan menghapus parent session melalui SQL ketika evidence masih ada. `ON DELETE RESTRICT` memaksa
future delete workflow untuk menghapus object melalui Storage API lebih dahulu dan menyimpan audit
yang sesuai.

## 10. Kontrak Kompresi dan Validasi

### 10.1 Input Client

| Aturan            | Nilai                                      |
| ----------------- | ------------------------------------------ |
| Source MIME       | JPEG, PNG, atau WebP statis                |
| Source maksimum   | 10 MiB per file sebelum client processing  |
| Jumlah            | Maksimal 3 total                           |
| Output transport  | WebP bila browser mendukung, JPEG fallback |
| Dimensi transport | Maksimal 1280 px pada sisi terpanjang      |
| Byte transport    | Maksimal 921600 byte atau 900 KiB          |
| Processing        | Satu file pada satu waktu                  |

Client harus mendeteksi dukungan WebP, mempertahankan aspect ratio, menerapkan orientasi foto, tidak
upscale, dan mencabut semua object URL ketika file dihapus/component unmount. File fallback JPEG
tetap diubah menjadi WebP oleh server.

Gunakan resize-at-decode melalui `createImageBitmap` bila browser mendukung, lalu tutup
`ImageBitmap`, kosongkan canvas, dan lepaskan reference buffer setelah setiap file. Fallback browser
harus diuji di Safari; jangan memproses tiga source besar secara paralel.

### 10.2 Input Server

Route wajib memakai Node.js runtime karena `sharp` dan melakukan:

1. Auth, permission, feature flag, dan rate limit sebelum transformasi mahal.
2. Pre-check `Content-Length` bila tersedia, lalu pemeriksaan `File.size` maksimum 1 MiB.
3. Validasi MIME deklaratif, signature/magic byte, dan hasil decode; extension tidak dipercaya.
4. `sharp` dengan `failOn: 'error'` dan `limitInputPixels` setara pola avatar saat ini.
5. Tolak `metadata.pages > 1`, SVG, GIF, HEIC/HEIF, file corrupt, zero dimension, dan dimensi/pixel
   yang melanggar batas.
6. `rotate()` tanpa angle untuk EXIF auto-orientation.
7. Resize `fit: 'inside'`, maksimum 1280 x 1280, `withoutEnlargement: true`.
8. Encode WebP secara deterministik tanpa `keepMetadata()`/`withMetadata()`.
9. Hitung byte, width, height, dan SHA-256 dari output, bukan input.

### 10.3 Output Server

| Aturan       | Nilai                       |
| ------------ | --------------------------- |
| Format       | Static WebP                 |
| MIME         | `image/webp`                |
| Target       | <= 307200 byte atau 300 KiB |
| Hard maximum | <= 358400 byte atau 350 KiB |
| Long edge    | <= 1280 px                  |
| Metadata     | Dihapus, termasuk EXIF/GPS  |
| Upscale      | Dilarang                    |

Gunakan quality/downscale ladder yang teruji, misalnya mulai 1280 px quality 78, turunkan quality
secara terbatas, lalu turunkan dimensi sampai minimum yang disepakati. Jangan hanya menjalankan
`webp({quality: 80})` sekali dan berharap semua foto lolos. Bila output tetap lebih besar dari batas
keras pada quality/dimension floor, kembalikan error 422 dan jangan upload.

Quality floor dan dimension floor harus dicatat pada Log Keputusan setelah visual fixture diuji.
Rekomendasi awal: quality tidak lebih rendah dari 55 dan long edge tidak lebih rendah dari 720 px.

### 10.4 Mengapa Tidak Menyimpan Thumbnail

Avatar tampil pada list dan leaderboard sehingga thumbnail tersimpan masuk akal. Bukti Pendampingan
hanya tampil pada detail dengan maksimum tiga foto. Thumbnail kedua akan menambah object count,
lifecycle cleanup, dan kapasitas. V1 memakai satu WebP kanonik dengan lazy loading.

## 11. Kontrak API

### 11.1 Upload

`POST /api/mentoring-sessions/[id]/evidence`

- Content-Type: multipart/form-data.
- Satu field file dan satu foto per request.
- Rate limit awal: 12 request per user per 15 menit; ukur dan revisi bila retry normal terhambat.
- Feature flag: `MENTORING_EVIDENCE_UPLOAD_ENABLED` harus `true`.
- Auth: `requirePermission('mentoring')`.
- Mutation scope: conductor session atau admin dan tetap branch scoped.
- Response 201 untuk evidence baru, 200 untuk checksum ready yang sudah ada.
- Response tidak mengembalikan `object_path`.
- Error 409 untuk kuota/race/pending duplicate, 413 untuk payload, 415 untuk format, 422 untuk hasil
  decode/kompresi, dan error auth sesuai wrapper repository.

Urutan server:

1. Authorize dan baca session minimum fields.
2. Validate/transform ke buffer kanonik.
3. Hitung metadata dan checksum.
4. Reserve row pending.
5. Bila RPC mengembalikan existing ready, jangan upload lagi; return 200.
6. Upload ke bucket dengan `contentType: image/webp`, `cacheControl` sesuai keputusan delivery, dan
   `upsert: false`.
7. Finalize row.
8. Pada error setelah reservation, remove object via Storage API, lalu delete/abort pending.
9. Log hanya request ID, evidence ID, session ID bila kebijakan log mengizinkan ID, byte in/out,
   duration, stage, dan error code. Jangan log nama/file bytes/note.

### 11.2 Delivery

`GET /api/mentoring-sessions/[id]/evidence/[evidenceId]`

1. Autentikasi dan permission `mentoring`.
2. Query row `ready` melalui user-scoped client/RLS atau explicit equivalent yang teruji.
3. Pastikan evidence benar-benar milik route session ID.
4. Validasi object path dengan parser ketat.
5. Gunakan admin client hanya untuk `storage.download` setelah authorization lulus.
6. Return `Content-Type: image/webp`, `X-Content-Type-Options: nosniff`, `Vary: Cookie`, dan ETag dari
   checksum.
7. Gunakan browser private cache dengan revalidation, bukan public/shared cache. Rekomendasi:
   `Cache-Control: private, no-cache` dan conditional 304 bila `If-None-Match` cocok.
8. Authorization tetap dilakukan sebelum mengembalikan 304. Dengan begitu browser dapat memakai
   bytes lokal, tetapi role/branch revocation tetap diperiksa dan Supabase tidak perlu mengirim ulang
   object ketika ETag cocok.
9. Cross-branch atau evidence/session mismatch sebaiknya menjadi 404 setelah auth untuk mengurangi
   object enumeration.

### 11.3 Metadata Detail

Halaman detail mengambil hanya `id`, `sort_order`, `width`, `height`, `byte_size`, dan checksum bila
dibutuhkan untuk URL/versioning. Jangan select object binary atau memanggil Storage saat server
merender list metadata. Helper URL tidak boleh membocorkan object path.

### 11.4 Cleanup Cron

`GET /api/cron/mentoring-evidence-cleanup`

- Authorized dengan `CRON_SECRET` dari `Authorization: Bearer <secret>` milik Vercel.
- Pertahankan kompatibilitas `x-cron-secret` untuk manual invocation yang sudah ada.
- Bandingkan secret dengan constant-time comparison.
- Ambil maksimal 100 row pending lebih tua dari dua jam, urut paling lama.
- Hapus object path dalam batch melalui Storage API.
- Hapus row pending hanya bila object removal berhasil atau object sudah tidak ada.
- Jangan menyentuh ready row.
- Idempotent dan aman bila dipanggil dua kali.
- Return count scanned/removed/failed/remaining tanpa PII.

Tambahkan schedule harian di `vercel.json`, bukan per menit. Vercel Cron menggunakan UTC dan tidak
melakukan retry otomatis. Rekomendasi jadwal awal `17 18 * * *`, yaitu sekitar 01:17 WIB, lalu
verifikasi timezone aktual pada deployment.

## 12. Authorization Matrix

| Actor                                        | Lihat metadata/foto | Upload ke sesi sendiri | Upload ke sesi user lain | Direct Storage     |
| -------------------------------------------- | ------------------- | ---------------------- | ------------------------ | ------------------ |
| Admin aktif                                  | Ya                  | Ya                     | Ya                       | Tidak dari browser |
| Manager aktif, permission on, cabang sama    | Ya                  | Ya bila conductor      | Tidak                    | Tidak              |
| Supervisor aktif, permission on, cabang sama | Ya                  | Ya bila conductor      | Tidak                    | Tidak              |
| Role permission `mentoring` off              | Tidak               | Tidak                  | Tidak                    | Tidak              |
| Manager cabang berbeda                       | Tidak               | Tidak                  | Tidak                    | Tidak              |
| User nonaktif                                | Tidak               | Tidak                  | Tidak                    | Tidak              |
| Anon                                         | Tidak               | Tidak                  | Tidak                    | Tidak              |
| Service role route terotorisasi              | Melalui server      | Ya setelah app auth    | Sesuai rule actor        | Ya                 |

UI visibility bukan security control. Setiap route, RPC, RLS, dan Storage operation harus lulus
matrix ini secara independen.

## 13. UX dan State Machine Client

### 13.1 Picker

1. Gunakan dua icon button yang jelas: kamera dan gallery, dengan tooltip/accessibility label.
2. Kamera memakai `capture="environment"`; gallery tidak memakai capture.
3. Tampilkan preview dengan aspect ratio asli. Jangan crop atau memaksa wajah di tengah.
4. User dapat menghapus/reorder foto lokal sebelum submit.
5. Disable pemilihan setelah tiga file, tetapi re-enable segera ketika preview lokal dihapus.
6. Tampilkan error per file, bukan toast tunggal yang menghilangkan konteks.
7. Kompres satu file pada satu waktu dan berikan status `processing`, `ready`, `uploading`, `done`,
   atau `failed` pada container berdimensi stabil.
8. Hormati `prefers-reduced-motion`; progress tidak boleh menggeser form.

### 13.2 Submit Dua Tahap

State minimum:

```text
idle -> creating_session -> session_created -> uploading -> complete
                                      |              |
                                      |              -> partial_failure -> retry_upload
                                      -> no_photos -> complete
```

Aturan kritis:

- Setelah `createdSessionId` terisi, tombol retry dilarang memanggil create-session lagi.
- `createdSessionId` tetap berada di state sampai redirect; tampilkan link detail bila redirect gagal.
- Upload dilakukan sequential atau concurrency maksimal dua. Rekomendasi awal sequential untuk
  iPhone memory dan CPU yang lebih stabil.
- Bila satu dari tiga gagal, dua yang sukses tidak diupload ulang.
- User boleh melanjutkan ke detail dengan sesi valid dan retry evidence dari sana.
- Refresh setelah create tidak boleh menyembunyikan sesi. Detail menyediakan uploader bila slot ada.

### 13.3 Detail Gallery

1. Existing session tanpa evidence menampilkan empty state ringkas tanpa error.
2. Gallery hanya muncul pada halaman detail, bukan list.
3. Gunakan stable aspect-ratio container dan `loading="lazy"`.
4. Gunakan `next/image` `unoptimized` atau komponen existing yang tetap melewati protected proxy.
5. Klik membuka modal/lightbox yang sudah mengikuti focus trap, Escape, dan scroll lock aplikasi.
6. `object-fit: contain` menjaga konteks foto; jangan memotong bukti dengan `cover` pada preview
   utama.
7. Tombol tambah hanya terlihat untuk conductor/admin, permission on, flag on, dan slot tersisa.
8. Jangan menampilkan object path, checksum, atau nama file teknis.

### 13.4 Mobile Acceptance

- Viewport 320 x 568 dan 390 x 844 tidak memiliki horizontal overflow.
- Input file dan tombol menggunakan touch target yang layak.
- Field text tetap minimal 16 px agar iOS tidak zoom.
- Modal tidak tertutup sticky header atau bottom navigation.
- Tiga preview tidak menyebabkan layout shift ketika compression status berubah.
- Test perangkat/Safari mencakup camera JPEG, gallery JPEG/PNG/WebP, cancel picker, background/resume,
  jaringan lambat, dan retry.

## 14. Privacy, Security, dan Abuse Control

1. Foto dapat mengandung wajah atau dokumen pribadi. Panduan operasional harus melarang pengambilan
   data pelanggan/dokumen yang tidak relevan.
2. EXIF/GPS harus dibuang dan dibuktikan dengan fixture ber-metadata.
3. Bucket tetap private dan URL public tidak pernah dibuat.
4. Jangan memakai nama kasir/outlet sebagai object path.
5. Jangan percaya Content-Type atau extension dari browser.
6. Tolak polyglot/corrupt/animated input dan batasi decoded pixels.
7. Rate limit dilakukan sebelum Sharp bila mungkin; reservation tetap memberi hard quota di DB.
8. Error response tidak membedakan keberadaan evidence lintas cabang.
9. Log, analytics, dan error tracker tidak menerima foto, base64, signed URL, nama file, nama user,
   atau isi catatan.
10. CSP/service worker regression memastikan media privat tidak masuk public Cache Storage.
11. Service role hanya dipakai pada server dan semua route tetap mengautorisasi actor sebelum admin
    client menyentuh database/Storage.
12. Lakukan dependency audit `sharp` dan client image code sebelum rollout.

## 15. Capacity dan Observability

### 15.1 Budget

| Skenario          | Rumus                   | Maksimum teoritis |
| ----------------- | ----------------------- | ----------------- |
| Satu foto         | 1 x 350 KiB             | 350 KiB           |
| Satu sesi penuh   | 3 x 350 KiB             | 1.03 MiB          |
| 1,000 sesi penuh  | 1,000 x 1,075,200 byte  | 1.00 GiB          |
| 10,000 sesi penuh | 10,000 x 1,075,200 byte | 10.01 GiB         |

Agent harus mencatat baseline Supabase Storage sebelum rollout dan menentukan alert dari quota plan
aktual. Jangan menebak batas plan dari source repository.

### 15.2 Metrik Minimum

- jumlah upload attempt/success/failure per stage;
- input byte dan output byte aggregate;
- compression ratio aggregate;
- p50/p95 transform duration;
- p50/p95 upload duration;
- count dan total `byte_size` evidence ready;
- average/max byte per evidence;
- session dengan 0/1/2/3 evidence;
- stale pending count dan usia tertua;
- cleanup scanned/removed/failed;
- 413/415/422/429 rate;
- delivery 200/304/403/404 serta storage download error.

Gunakan ID teknis dan aggregate. Jangan menambahkan high-cardinality nama user/outlet atau checksum
ke analytics eksternal.

### 15.3 Query Operasional

Tambahkan query read-only pada `docs/OPERATIONS_RUNBOOK.md` untuk:

1. count dan sum byte evidence ready;
2. average/p95 byte bila query aman;
3. pending lebih tua dari dua jam;
4. session yang mencapai kuota;
5. metadata row yang tidak konsisten.

Query object-level hanya untuk diagnosis terotorisasi. Jangan menginstruksikan operator menghapus
`storage.objects` dengan SQL.

## 16. Kontrak Kerja Agent

### Sebelum Memulai Milestone

1. Baca `AGENTS.md`, `docs/DEVELOPER_GUIDE.md`, dokumen ini, dan dokumentasi Next.js 16 lokal pada
   `node_modules/next/dist/docs` untuk Route Handler/Image yang akan disentuh.
2. Jalankan `git status --short --branch` dan catat perubahan user. Jangan mengubah
   `supabase/config.toml`.
3. Catat baseline commit, migration linked/local terbaru, environment target, dan feature flag.
4. Hanya satu milestone boleh `IN_PROGRESS`.
5. Ubah tabel Bukti Milestone dan Handoff sebelum source edit.
6. Jangan menjalankan migration production, push, atau deploy tanpa permintaan/approval user.

### Setelah Milestone

1. Jalankan seluruh acceptance criteria dan test gate milestone.
2. Jalankan `git diff --check` dan `git status --short`.
3. Catat command dan hasil nyata, termasuk skipped/blocked test.
4. Catat file berubah, migration, keputusan, metrik, risiko, dan rollback.
5. Ubah status menjadi `COMPLETE` hanya bila seluruh gate milestone lulus.
6. Gunakan `IMPLEMENTED_PENDING_VALIDATION` bila source selesai tetapi device/staging test belum ada.
7. Perbarui `Milestone aktif`, Bukti Milestone, Log Keputusan, dan Handoff sebelum berhenti.

Jangan menulis `PASS` untuk test yang tidak dijalankan. Jangan menghapus catatan agent sebelumnya;
tambahkan koreksi baru dengan alasan dan bukti.

## 17. Urutan Milestone

| ID   | Tujuan                                                     | Status                           | Dependensi |
| ---- | ---------------------------------------------------------- | -------------------------------- | ---------- |
| ME-0 | Baseline, product contract, dan fixture                    | `IMPLEMENTED_PENDING_VALIDATION` | -          |
| ME-1 | Schema, RLS, RPC, bucket, dan generated types              | `IMPLEMENTED_PENDING_VALIDATION` | ME-0       |
| ME-2 | Validation dan canonical compression server                | `IMPLEMENTED_PENDING_VALIDATION` | ME-0       |
| ME-3 | Upload API, reservation, rollback, dan idempotency         | `IMPLEMENTED_PENDING_VALIDATION` | ME-1, ME-2 |
| ME-4 | Private delivery, metadata query, dan detail gallery       | `IMPLEMENTED_PENDING_VALIDATION` | ME-1, ME-2 |
| ME-5 | Client picker, precompression, two-stage submit, dan retry | `IMPLEMENTED_PENDING_VALIDATION` | ME-3, ME-4 |
| ME-6 | Orphan cleanup, cron auth, monitoring, dan runbook         | `IMPLEMENTED_PENDING_VALIDATION` | ME-1, ME-3 |
| ME-7 | Security/E2E/performance gate dan rollout production       | `BLOCKED_EXTERNAL_VALIDATION`    | ME-1..ME-6 |

## 18. ME-0: Baseline, Contract, dan Fixture

**Tujuan:** memastikan implementasi dimulai dari state aktual dan keputusan v1 dapat diuji.

**Langkah:**

1. Rekam current commit, dirty files, migration local/linked, Vercel deployment, dan region Supabase.
2. Audit ulang semua file pada File Map karena source dapat berubah setelah roadmap dibuat.
3. Verifikasi tersedia Supabase staging/test terpisah. Bila tidak ada, tandai integration/E2E
   `BLOCKED_EXTERNAL_VALIDATION`; jangan memakai production sebagai test target.
4. Catat current Storage size dan object count bucket yang ada dari dashboard/query read-only.
5. Catat jumlah sesi Pendampingan per bulan untuk proyeksi 3, 6, dan 12 bulan.
6. Dapatkan approval owner atas maksimum tiga, evidence opsional, no delete v1, dan retention default.
7. Buat fixture test lokal bebas PII:
   - JPEG landscape normal;
   - JPEG portrait dengan EXIF orientation dan GPS dummy;
   - PNG transparan;
   - WebP statis;
   - fake extension;
   - corrupt image;
   - animated WebP/GIF;
   - high-entropy/noisy image;
   - decoded-pixel limit case.
8. Uji tipe file aktual dari camera dan gallery Safari/iPhone target. Jangan memakai foto production.
9. Rekam baseline pembuatan sesi tanpa foto dan detail sesi lama.
10. Tetapkan quality/dimension floor berdasarkan visual fixture dan batas 350 KiB.
11. Isi matriks role fixture untuk admin, manager dua cabang, supervisor, permission off, dan inactive.

**Acceptance criteria:** keputusan produk ditandatangani di Log Keputusan, fixture tidak mengandung
PII, baseline storage/performance tercatat, dan iPhone format behavior diketahui.

**Test gate:** tidak ada source behavior yang berubah; fixture terisolasi dari production;
`git diff --check` lulus.

## 19. ME-1: Schema, RLS, RPC, Bucket, dan Type

**Tujuan:** membuat metadata dan Storage boundary yang menegakkan kuota serta access control.

**Langkah:**

1. Buat migration `0058_mentoring_evidence.sql` sesuai Kontrak Database dan Storage.
2. Buat tabel, constraints, index, RLS, restrictive active-user policy, dan minimum grants.
3. Buat bucket private dengan exact MIME/size limits.
4. Buat reservation/finalization RPC service-role-only dengan fixed search path.
5. Gunakan parent row lock untuk serialisasi slot dan checksum per session.
6. Tambahkan SQL regression untuk foto keempat concurrent, duplicate checksum, actor non-conductor,
   branch mismatch, permission off, inactive actor, dan direct table write.
7. Buktikan anon/authenticated tidak dapat upload/download langsung ke bucket.
8. Regenerate database types dan update type verification script.
9. Jalankan migration dari clean local database dan dari database yang sudah mencapai 0057.
10. Jalankan `supabase db lint` bila local tooling tersedia.

**Acceptance criteria:** kuota/dedup tahan race, RLS matrix lulus, bucket private/limited, RPC hanya
dapat dipanggil service role, dan existing mentoring queries tetap benar.

**Test gate:** local migration reset/apply, DB lint, `test:security`, `test:types`, typecheck, dan
targeted SQL concurrency test.

## 20. ME-2: Validation dan Canonical Compression

**Tujuan:** menghasilkan satu WebP aman yang selalu memenuhi budget.

**Langkah:**

1. Buat pure constants module yang aman diimport client tanpa menarik `sharp`.
2. Buat server-only validator/transformer pada domain storage/mentoring.
3. Reuse signature validation pattern avatar tanpa mengubah kontrak avatar.
4. Implementasikan pixel/page/dimension validation, auto-orient, resize inside, no upscale,
   metadata stripping, adaptive quality/downscale, output checks, dan SHA-256.
5. Pastikan setiap retry ladder membuat Sharp pipeline baru dari buffer input yang sama.
6. Tolak output >350 KiB dan jangan mengembalikan partial buffer.
7. Tambahkan unit test seluruh fixture ME-0 dan snapshot metadata, bukan snapshot visual binary.
8. Verifikasi GPS/EXIF benar-benar tidak ada pada output.
9. Benchmark p50/p95 CPU dan memory untuk tiga foto sequential pada machine test yang dicatat.
10. Pastikan module Sharp hanya masuk server route chunk, bukan client bundle.

**Acceptance criteria:** semua input valid menjadi static WebP <=350 KiB dan <=1280 px; invalid,
animated, corrupt, dan oversized decode ditolak; metadata hilang; output deterministik untuk dedup.

**Test gate:** targeted Vitest, full unit test, typecheck, lint, clean build, bundle inspection, dan
memory/CPU benchmark tercatat.

## 21. ME-3: Upload API dan Transaction Compensation

**Tujuan:** membuat upload idempotent dengan rollback dan tanpa duplicate session.

**Langkah:**

1. Tambahkan nested POST route dan Node runtime declaration sesuai Next.js 16 lokal.
2. Tambahkan feature flag server, permission guard, scope check, content-length/file-size check, dan
   rate limit sebelum Sharp.
3. Integrasikan transformer ME-2, checksum, reservation RPC, Storage upload, dan finalization RPC.
4. Implementasikan compensation pada setiap failure setelah reservation.
5. Return existing ready sebagai idempotent success saat checksum sama.
6. Pastikan response tidak membocorkan object path.
7. Tambahkan structured stage error dan request ID tanpa PII.
8. Tambahkan endpoint pada API contract smoke.
9. Mock/inject failure pada reserve, upload, finalize, remove, dan response-after-finalize.
10. Uji dua/fourth concurrent request untuk memastikan DB, bukan UI, menegakkan kuota.

**Acceptance criteria:** tidak ada object tanpa row permanen pada controlled failure, retry response
lost tidak menggandakan file, foto keempat ditolak, dan session yang sudah dibuat tidak dipost ulang.

**Test gate:** unit/API contract, security regression, failure-injection integration, typecheck,
lint, dan build.

## 22. ME-4: Private Delivery dan Detail Gallery

**Tujuan:** menampilkan bukti hanya kepada user yang berhak tanpa menambah fetch pada list.

**Langkah:**

1. Buat URL helper yang hanya memakai session/evidence ID.
2. Tambahkan protected GET route dengan RLS/explicit scope, strict association, ETag, private
   revalidation, nosniff, dan `Vary: Cookie`.
3. Pastikan conditional 304 baru dikembalikan setelah auth dan authorization.
4. Query metadata ready pada detail page dengan select minimal dan urutan stabil.
5. Buat gallery/lightbox responsive, lazy image, object contain, empty state, loading/error state,
   keyboard navigation, focus management, dan reduced motion.
6. Jangan menambahkan evidence query atau image URL ke MentoringList/API list.
7. Uji permission revocation, branch reassignment, inactive user, object mismatch, dan cache 304.
8. Uji Storage download tidak dipanggil pada authorized conditional 304.
9. Verifikasi service worker tidak menyimpan protected image response.

**Acceptance criteria:** matrix view access lulus, cached bytes tidak menjadi public, second load
memakai conditional cache, list payload/request count tidak bertambah, dan existing empty session
tetap normal.

**Test gate:** route tests, security regression, Playwright detail gallery, accessibility smoke,
network trace, typecheck, lint, dan build.

## 23. ME-5: Picker, Client Compression, Submit, dan Retry

**Tujuan:** memberi flow kamera/gallery yang stabil dan tidak membuat duplicate session.

**Langkah:**

1. Buat reusable evidence picker/uploader dengan stable dimensions dan per-file state.
2. Implementasikan client source validation, orientation, resize, adaptive transport compression,
   WebP detection/JPEG fallback, object URL cleanup, dan sequential processing.
3. Tambahkan camera/gallery controls, local remove/reorder, slot counter, dan accessible status.
4. Ubah form submit menjadi state machine dua tahap tanpa mengubah payload create session.
5. Simpan `createdSessionId` segera setelah response 201; semua retry setelah itu hanya upload.
6. Upload sequential dan pertahankan hasil sukses saat satu file gagal.
7. Tambahkan retry/add flow pada detail untuk conductor/admin dengan slot tersisa.
8. Tambahkan continue-to-detail untuk partial failure.
9. Uji double-click, Enter submit, back/forward, refresh, offline, timeout, abort, dan resume.
10. Jalankan iPhone/Safari matrix dari ME-0 serta Android/Chromium smoke.

**Acceptance criteria:** 0..3 foto dapat disimpan, tidak ada sesi duplikat, partial failure dapat
dipulihkan, memory mobile stabil, object URL dibersihkan, dan UI tidak overlap/zoom/shift.

**Test gate:** component/unit test, Playwright mobile/desktop, real Safari/iPhone validation atau
status pending yang jujur, typecheck, lint, dan build.

## 24. ME-6: Cleanup, Cron, Monitoring, dan Runbook

**Tujuan:** menghapus pending gagal dan membuat pertumbuhan storage terlihat.

**Langkah:**

1. Perluas `src/lib/cron/auth.ts` agar menerima Vercel Bearer secret dan legacy header secara aman.
2. Tambahkan unit test valid/invalid/missing/mismatched-length secret untuk kedua header.
3. Buat cleanup GET route dengan threshold 2 jam, limit 100, oldest-first, idempotency, dan
   structured result.
4. Gunakan Storage API remove; delete pending row hanya setelah hasil Storage aman.
5. Tambahkan daily cron ke `vercel.json` dan dokumentasikan UTC/WIB.
6. Tambahkan metric/log stale pending dan remaining backlog; Vercel tidak retry otomatis.
7. Tambahkan query capacity dan manual rerun procedure ke `OPERATIONS_RUNBOOK.md`.
8. Test pending tanpa object, pending dengan object, ready object, partial Storage error, dua cron
   bersamaan, dan backlog >100.
9. Pastikan cleanup tidak dapat dipanggil tanpa secret dan response tidak memuat path.
10. Tambahkan alert threshold setelah quota plan dan baseline ME-0 diketahui.

**Acceptance criteria:** stale pending dibersihkan, ready tidak tersentuh, cron production dapat
terotorisasi, failure terlihat dan dapat diulang manual, serta dashboard/runbook menunjukkan budget.

**Test gate:** unit route/cron auth, integration Storage sandbox, manual authorized/unauthorized
smoke, lint, typecheck, build, dan preview cron configuration validation.

## 25. ME-7: Regression, Rollout, dan Production Gate

**Tujuan:** membuktikan fitur aman, hemat, dan tidak merusak Pendampingan existing.

**Langkah:**

1. Jalankan seluruh matriks test pada Bagian 26 dengan fixture non-production.
2. Jalankan clean production build dan bandingkan JS, request count, detail LCP, serta upload time.
3. Verifikasi list Pendampingan tidak fetch evidence dan first load global tidak menarik Sharp/client
   compressor chunk.
4. Apply migration ke staging/preview lebih dahulu dan verifikasi bucket/RLS/RPC.
5. Deploy code dengan `MENTORING_EVIDENCE_UPLOAD_ENABLED=false`.
6. Smoke existing create/list/detail, lalu gallery empty state.
7. Enable upload pada staging, uji role/cabang/mobile/failure/cleanup.
8. Ambil backup dan catat migration status sebelum production apply.
9. Apply migration production, deploy dengan upload flag off, smoke read path, lalu enable flag pada
   deployment berikutnya.
10. Pantau 24 jam pertama: errors, 413/422/429, byte average, pending age, cleanup, function CPU,
    dan Storage growth.
11. Pantau 7 hari dan bandingkan proyeksi dengan budget.
12. Perbarui Developer Guide, Operations Runbook, roadmap, decision log, dan handoff.

**Acceptance criteria:** seluruh automated gate lulus, role/staging/device validation tercatat,
existing flow tidak regresi, storage budget sesuai, cleanup berjalan, dan owner menyetujui retention.

**Regression gate minimum:**

- `npm.cmd run lint`
- `npm.cmd run typecheck`
- `npm.cmd test`
- `npm.cmd run test:api`
- `npm.cmd run test:security`
- `npm.cmd run test:types`
- `npm.cmd run test:e2e`
- `npm.cmd run build`
- `git diff --check`
- Supabase local migration reset/apply dan DB lint
- linked migration list/dry-run setelah approval

## 26. Matriks Pengujian Wajib

### 26.1 File dan Compression

| Kasus                  | Hasil yang diharapkan                               |
| ---------------------- | --------------------------------------------------- |
| JPEG/PNG/WebP valid    | Output static WebP <=350 KiB, <=1280 px             |
| Portrait EXIF          | Orientasi visual benar, EXIF/GPS hilang             |
| PNG alpha              | Alpha terjaga atau keputusan flatten terdokumentasi |
| Fake `.jpg`            | 415/422, tidak reserve/upload                       |
| SVG/GIF/HEIC           | Ditolak v1                                          |
| Animated WebP          | Ditolak                                             |
| Corrupt/truncated      | Ditolak tanpa crash                                 |
| Pixel bomb             | Ditolak oleh decoded pixel limit                    |
| Input >1 MiB ke API    | 413 sebelum transformasi                            |
| Output sulit dikompres | Ladder berjalan; hard fail jika >350 KiB            |

### 26.2 Data dan Concurrency

| Kasus                         | Hasil yang diharapkan                             |
| ----------------------------- | ------------------------------------------------- |
| 0 evidence                    | Sesi sukses dan detail empty state                |
| 1/2/3 evidence                | Semua ready dengan urutan stabil                  |
| 4 upload serial               | Foto keempat 409                                  |
| 4 upload concurrent           | Maksimum tiga row/object aktif                    |
| Checksum sama dalam sesi      | Existing ready/idempotent, tidak ada object kedua |
| Checksum sama beda sesi       | Diizinkan, object ownership terpisah              |
| Finalize gagal                | Object dihapus, pending diabort/cron              |
| Response hilang setelah ready | Retry return existing, tidak duplicate            |
| Parent delete dengan evidence | Ditolak FK restrict                               |

### 26.3 Authorization

Uji seluruh Authorization Matrix pada metadata query, upload route, delivery route, RPC direct,
table direct, dan Storage direct. Permission toggle dan user deactivation harus efektif tanpa hanya
mengandalkan hidden UI.

### 26.4 UI dan Network

- 320 x 568, 390 x 844, 768 x 1024, 1024 x 600, dan 1440 x 900.
- Safari iPhone, Chromium Android, dan desktop Chromium.
- slow 3G, offline during upload, retry, page refresh, back/forward, and double submit.
- keyboard, screen reader labels, focus trap, Escape, reduced motion, and 200% zoom.
- no horizontal overflow, no text overlap, no iOS input zoom, no page-wide skeleton regression.
- list page has zero evidence image requests.
- detail only requests images lazily.
- conditional request returns 304 after authorization and avoids Storage download.

### 26.5 Cleanup

- pending age 119 minutes is preserved;
- pending age >120 minutes is removed;
- ready age >120 minutes is preserved;
- missing object still allows stale pending row cleanup;
- Storage transient error preserves row for retry;
- unauthorized cron returns 401/403 per existing convention;
- concurrent invocation remains idempotent;
- backlog >100 reports remaining count.

## 27. File Map

### Wajib Dibaca

- `src/components/mentoring/MentoringForm.tsx`
- `src/components/mentoring/MentoringList.tsx`
- `src/app/(app)/mentoring/new/page.tsx`
- `src/app/(app)/mentoring/[id]/page.tsx`
- `src/app/api/mentoring-sessions/route.ts`
- `supabase/migrations/0038_mentoring_uuid_validation.sql`
- `src/components/cashiers/CashierAvatarForm.tsx`
- `src/app/api/cashiers/[id]/avatar/route.ts`
- `src/app/api/storage/cashier-avatar/route.ts`
- `src/lib/storage/avatar-validation.ts`
- `src/lib/storage/cashier-avatar.ts`
- `src/lib/cron/auth.ts`
- `src/lib/api/route.ts`
- `src/lib/auth/guards.ts`
- `src/lib/auth/permissions-server.ts`
- `src/types/database.ts`
- `scripts/api-contract-smoke.mjs`
- `scripts/security-regression.mjs`
- `scripts/verify-database-types.mjs`
- `vercel.json`

### File Baru Yang Direkomendasikan

- `supabase/migrations/0058_mentoring_evidence.sql`
- `src/lib/mentoring/evidence-constants.ts`
- `src/lib/storage/mentoring-evidence.ts`
- `src/lib/storage/mentoring-evidence-validation.ts`
- `src/lib/storage/__tests__/mentoring-evidence-validation.test.ts`
- `src/components/mentoring/MentoringEvidencePicker.tsx`
- `src/components/mentoring/MentoringEvidenceGallery.tsx`
- `src/components/mentoring/MentoringEvidenceUploadPanel.tsx`
- `src/app/api/mentoring-sessions/[id]/evidence/route.ts`
- `src/app/api/mentoring-sessions/[id]/evidence/[evidenceId]/route.ts`
- `src/app/api/cron/mentoring-evidence-cleanup/route.ts`
- `src/lib/storage/__tests__/mentoring-evidence.test.ts`
- `e2e/mentoring-evidence.spec.ts`

Nama helper boleh disesuaikan dengan pola repository, tetapi ownership boundary dan kontrak dalam
dokumen ini tidak boleh hilang hanya untuk mengurangi jumlah file.

## 28. Risiko dan Mitigasi

| Risiko                                      | Dampak                         | Mitigasi                                                                 |
| ------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------ |
| Upload client dibypass                      | File berbahaya/besar masuk     | Server decode, signature, pixel limit, re-encode, bucket limit           |
| Storage dan DB tidak atomik                 | Orphan/inconsistent row        | Pending reservation, compensation, stale cleanup                         |
| Dua upload bersamaan melewati kuota         | Lebih dari tiga object         | Lock parent session dan count dalam RPC                                  |
| Retry membuat sesi duplikat                 | Catatan operasional ganda      | `createdSessionId` state dan retry foto-only                             |
| Long-lived browser cache setelah revocation | Foto lama masih terlihat       | Private revalidation + ETag, auth before 304                             |
| Foto list memperlambat first load           | Banyak egress/request          | Detail-only dan lazy load                                                |
| iPhone mengirim HEIC                        | Picker gagal                   | Device audit ME-0; explicit unsupported error; separate design if needed |
| Sharp menambah client bundle                | First load membesar            | Server-only module dan bundle inspection                                 |
| Foto noisy tetap besar                      | Batas bucket gagal             | Adaptive ladder dan hard output assertion                                |
| Metadata GPS tersisa                        | Privacy leak                   | Default strip + fixture verification                                     |
| Cron tidak terotorisasi di Vercel           | Pending tidak dibersihkan      | Support Bearer CRON_SECRET + preview smoke                               |
| Cron gagal tanpa retry                      | Backlog tumbuh                 | Alert, remaining count, manual rerun runbook                             |
| Session dihapus langsung                    | Object orphan                  | FK `ON DELETE RESTRICT`                                                  |
| Auto retention salah                        | Bukti produksi hilang          | Tidak ada ready auto-delete tanpa owner policy                           |
| Service worker menyimpan foto               | Data privat menjadi persistent | Cache namespace regression dan protected-route exclusion                 |
| User change tertimpa                        | Config lokal hilang            | Audit status dan jangan sentuh `supabase/config.toml`                    |

## 29. Rollout dan Rollback

### Rollout

1. Migration local dan staging.
2. Security/type tests.
3. Deploy code dengan upload flag off.
4. Verify empty/read gallery dan existing mentoring.
5. Enable upload staging dan jalankan full matrix.
6. Pastikan Vercel preview memakai Supabase staging, bukan credential production.
7. Backup production serta verifikasi latest migration.
8. Apply additive migration production.
9. Deploy code production dengan upload flag off.
10. Smoke routes, bucket, RLS, dan cron auth tanpa fixture destructive.
11. Enable upload melalui deployment baru.
12. Monitor 24 jam dan 7 hari.

### Rollback

1. Matikan `MENTORING_EVIDENCE_UPLOAD_ENABLED` terlebih dahulu.
2. Pertahankan delivery/gallery agar bukti ready tetap dapat dibaca.
3. Rollback source bila perlu; biarkan migration/table/bucket additive tetap ada.
4. Jangan drop table, bucket, atau menghapus object sebagai rollback biasa.
5. Cleanup pending dapat tetap berjalan walau upload dimatikan.
6. Destructive rollback hanya setelah backup, object count/table check, owner approval, dan runbook
   terpisah.

## 30. Definition of Done

Fitur baru selesai hanya bila:

1. ME-0 sampai ME-7 memiliki bukti aktual dan status final.
2. Existing create/list/detail Pendampingan tanpa foto tidak regresi.
3. Maksimum tiga dan 350 KiB ditegakkan di DB, server, dan bucket.
4. Original/thumbnail tidak tersimpan.
5. Metadata EXIF/GPS hilang dari output.
6. Race upload, idempotent retry, partial failure, dan cleanup lulus.
7. Semua role/cabang/inactive/direct-access security test lulus.
8. List tidak mengambil foto dan detail lazy load terbukti dari network trace.
9. iPhone/Safari target sudah diuji atau release dinyatakan blocked, bukan diasumsikan lulus.
10. Cron production terotorisasi dan satu eksekusi aktual tercatat.
11. Storage baseline, budget, alert, dan runbook tersedia.
12. Retention/no-delete policy disetujui owner.
13. Semua regression gate lulus.
14. Roadmap, Developer Guide, Operations Runbook, dan Handoff diperbarui.
15. Working tree tidak mengubah file user di luar scope.

## 31. Protokol Pembaruan Agent

Sebelum milestone:

1. Ubah hanya milestone target menjadi `IN_PROGRESS`.
2. Isi agent, waktu mulai, baseline commit, branch, dan dirty files pada Bukti Milestone.
3. Catat asumsi yang berubah sejak roadmap dibuat.

Sesudah implementasi:

1. Jalankan gate milestone.
2. Isi commit/deployment bila ada.
3. Catat command dan hasil numerik, bukan hanya `tested`.
4. Catat file berubah dan migration applied target.
5. Catat screenshot/trace/report path yang dapat dibuka agent berikutnya.
6. Ubah status ke `COMPLETE` hanya bila acceptance criteria lulus.
7. Bila external validation belum tersedia, gunakan `IMPLEMENTED_PENDING_VALIDATION`.
8. Perbarui Handoff dengan satu next action yang konkret.

## 32. Bukti Milestone

| Milestone | Agent/waktu       | Commit/deployment                   | Test dan metrik                                                                                                                                                                                       | Status                           | Catatan/artefak                                                                                                              |
| --------- | ----------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| ME-0      | Codex, 2026-08-11 | working tree / belum deploy         | Audit source dan contract selesai; fixture device, storage baseline, dan owner approval belum dijalankan                                                                                              | `IMPLEMENTED_PENDING_VALIDATION` | Tidak menggunakan production sebagai target test                                                                             |
| ME-1      | Codex, 2026-08-11 | working tree / staging `0058` applied | Clean local reset dan staging menerapkan `0001..0058`; local security regression lulus; remote DB lint nol temuan; RPC, tabel, RLS read, dan bucket private terverifikasi                         | `IMPLEMENTED_PENDING_VALIDATION` | Targeted concurrent request dan role/revocation browser matrix belum dijalankan                                               |
| ME-2      | Codex, 2026-08-11 | working tree / belum deploy         | Sharp canonical WebP, signature/pixel/page/MIME/size checks, metadata stripping; full unit suite 13 file/43 test dan clean build lulus                                                                | `IMPLEMENTED_PENDING_VALIDATION` | Fixture EXIF/noisy lengkap dan benchmark CPU/memory belum ada                                                                |
| ME-3      | Codex, 2026-08-11 | working tree / belum deploy         | E2E upload riil ke Storage lokal lulus desktop/mobile; reservation/finalize/path dan dedupe/kuota lulus SQL; API contract 11 request lulus; rollback mempertahankan pending bila Storage remove gagal | `IMPLEMENTED_PENDING_VALIDATION` | Failure injection setiap tahap dan concurrency HTTP belum dijalankan                                                         |
| ME-4      | Codex, 2026-08-11 | working tree / belum deploy         | Protected delivery, image WebP privat, lazy gallery/lightbox, `ETag`, dan authorized conditional `304` lulus E2E desktop/mobile                                                                       | `IMPLEMENTED_PENDING_VALIDATION` | Revocation/cross-branch browser matrix dan Safari cache belum dijalankan                                                     |
| ME-5      | Codex, 2026-08-11 | working tree / belum deploy         | Picker, client compression, two-stage submit, upload, redirect, gallery, dan lightbox lulus pada Chromium desktop dan mobile viewport                                                                 | `IMPLEMENTED_PENDING_VALIDATION` | Safari/iPhone nyata, offline/timeout/double-submit belum dijalankan                                                          |
| ME-6      | Codex, 2026-08-11 | working tree / belum deploy         | Unit auth lulus; Storage upload/remove probe lulus; cron tanpa secret `401`; authorized cleanup menghapus 1 stale pending, gagal 0, remaining 0, dan mempertahankan 2 ready                           | `IMPLEMENTED_PENDING_VALIDATION` | Concurrent cron, backlog >100, dan Vercel preview cron belum dijalankan                                                      |
| ME-7      | Codex, 2026-08-11 | `5cb14ed`, Vercel Preview            | CI/Vercel hijau; setup dan anon/RPC lulus; bypass aman; flag-off smoke: 2 API `401`, authenticated API `200`, 5 route, sesi `201`, 0 evidence, cleanup admin 1->1                              | `BLOCKED_EXTERNAL_VALIDATION`    | Upload flag-on, role/device/concurrency/cleanup runtime dan rollout production belum dilakukan                                |

## 33. Log Keputusan

| Tanggal    | Keputusan                                       | Alasan                                                                              | Status                                                     |
| ---------- | ----------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 2026-08-11 | Maksimal tiga foto per sesi                     | Membatasi storage, upload time, dan UI                                              | Direkomendasikan                                           |
| 2026-08-11 | Satu WebP kanonik, tanpa original/thumbnail     | Capacity dan lifecycle paling sederhana                                             | Direkomendasikan                                           |
| 2026-08-11 | Target 300 KiB, hard max 350 KiB, 1280 px       | Bukti tetap dapat diperiksa dengan budget terukur                                   | Perlu fixture validation ME-0                              |
| 2026-08-11 | Evidence opsional                               | Backward compatible dan tahan jaringan buruk                                        | Perlu owner approval ME-0                                  |
| 2026-08-11 | Conductor/admin dapat upload                    | Ownership jelas tanpa permission baru                                               | Direkomendasikan                                           |
| 2026-08-11 | Tidak ada ready delete v1                       | Bukti tidak hilang tanpa audit trail                                                | Perlu owner approval ME-0                                  |
| 2026-08-11 | Ready evidence tidak auto-delete                | Retensi adalah keputusan bisnis                                                     | Perlu owner approval ME-0                                  |
| 2026-08-11 | Private proxy + ETag revalidation               | Menjaga auth revocation dan mengurangi Storage re-download                          | Direkomendasikan                                           |
| 2026-08-11 | HEIC di luar v1                                 | Browser/server compatibility perlu validasi terpisah                                | Perlu device validation ME-0                               |
| 2026-08-11 | Row ID dipakai sebagai UUID pada object path    | Menjamin binding path yang diperiksa API dan mencegah reservation selalu dibatalkan | Divalidasi local SQL + E2E                                 |
| 2026-08-11 | Abort row hanya setelah object removal berhasil | Mempertahankan pending untuk retry cron dan mencegah orphan ketika Storage gagal    | Typecheck/lint/unit/build lulus; failure injection pending |

## 34. Handoff

### Status Implementasi Saat Ini

- Source implementation untuk ME-1 sampai ME-6 sudah di-commit pada branch `staging` sebagai
  `5cb14ed` dan berhasil dibangun oleh Vercel Preview.
- Migration `0058` sudah lulus clean reset, DB lint, dan security regression pada stack lokal
  terpisah. Staging sudah menerima `0001..0058`; production tidak disentuh.
- Existing mentoring create tetap JSON + service-role-only atomic RPC; bukti dibuat setelah session `201`
  sehingga retry tidak pernah membuat session baru.
- Upload off secara default. Set `MENTORING_EVIDENCE_UPLOAD_ENABLED=true` hanya setelah migration,
  bucket, RLS, dan smoke test staging lulus.
- Dedicated Playwright bukti foto dan full suite lulus pada desktop/mobile Chromium. Full suite
  terakhir menghasilkan 17 pass, 3 skip yang disengaja, dan 0 fail.
- Project linked saat ini adalah staging `kpi-kasir-staging` (`fkanacflupmyuohkjque`). Seluruh
  migrasi `0001..0058` berhasil diterapkan tanpa seed/role, dry-run pascamigrasi menyatakan
  up-to-date, dan remote DB lint tidak menemukan error.
- Smoke staging mengonfirmasi tabel dan RPC reserve/finalize/abort tersedia, tabel kosong untuk
  service role maupun anon, serta bucket `mentoring-evidence` private dengan hard limit 358400 byte
  dan MIME `image/webp`.
- Production `gxnlhtqnfgcbkfqoxpoa` terakhir diverifikasi read-only masih pada `0001..0057` sebelum
  workspace dipindahkan ke staging. Jangan menjalankan linked push production tanpa relink dan gate
  produksi eksplisit.
- Region staging adalah `ap-northeast-2`, berbeda dari production `ap-southeast-2`; validasi schema
  tetap sah, tetapi baseline latensi staging tidak setara dengan production.
- Vercel Preview branch tersedia di
  `https://kpi-kasir-git-staging-yoga-septriana-s-projects.vercel.app`. Redeploy setelah konfigurasi
  environment sukses; setup staging menghasilkan tepat satu admin aktif, completed timestamp, dan
  claim yang sudah dibersihkan.
- Preview tetap memakai Vercel Authentication. Protection Bypass for Automation tersimpan hanya di
  `.env.local` yang diabaikan Git; header bypass tervalidasi tanpa membuka Preview ke publik.
- Remote anon smoke lulus: flag `admin_created` dapat dibaca, tabel `users` mengembalikan array
  kosong walaupun admin ada, dan RPC reserve evidence ditolak `401` dengan PostgreSQL code `42501`.
- Flag-off browser/API smoke memakai session harness dan akun sintetis: branch/evidence tanpa sesi
  sama-sama `401`, branch setelah session `200`, lima route inti tidak error, picker foto tidak ada,
  sesi tanpa foto dibuat `201`, evidence row tetap 0, dan cleanup mengembalikan admin aktif 1 ke 1.
- Login password browser terhadap user Auth yang baru dibuat seketika menghasilkan campuran `200`
  dan `400 validation_failed`; payload/key/project sudah benar dan direct Auth selalu berhasil.
  Session harness stabil. Catat sebagai keterbatasan fixture propagation/rate sebelum menyimpulkan
  regresi login pengguna existing.
- Belum ada validasi iPhone/Safari nyata, role/revocation browser matrix, baseline kapasitas
  production, atau owner approval untuk retention/no-delete.

### Langkah Agent Berikutnya

1. Ubah `MENTORING_EVIDENCE_UPLOAD_ENABLED=true` hanya pada Vercel Preview lalu redeploy branch
   `staging`; jangan mengubah Production.
2. Jalankan upload/delivery/ETag/lightbox smoke dengan synthetic test user dan cleanup object/row.
3. Validasi role/cabang/revocation, HTTP concurrency, partial
   failure, concurrent cleanup, backlog >100, dan monitoring.
4. Jalankan matriks iPhone/Safari nyata serta catat ukuran, CPU/memory, dan kualitas fixture foto.
5. Setelah owner menyetujui retention/no-delete dan semua gate lulus, backup production, apply
   migration, deploy dengan flag off, lalu enable bertahap dan pantau 24 jam/7 hari.

## 35. Referensi Resmi

- [Supabase Storage bucket fundamentals](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase Storage file limits](https://supabase.com/docs/guides/storage/uploads/file-limits)
- [Supabase Storage schema design](https://supabase.com/docs/guides/storage/schema/design)
- [Supabase Storage size usage](https://supabase.com/docs/guides/platform/manage-your-usage/storage-size)
- [Vercel Functions limits](https://vercel.com/docs/functions/limitations)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Vercel Cron management and CRON_SECRET](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [Sharp output/WebP](https://sharp.pixelplumbing.com/api-output/)
- [Sharp resize](https://sharp.pixelplumbing.com/api-resize/)
- [Sharp rotate and auto-orientation](https://sharp.pixelplumbing.com/api-operation/)
