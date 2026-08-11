# Roadmap: Arsip Kategori Dan Detail Penilaian

Dokumen ini adalah sumber kebenaran implementasi fitur arsip konfigurasi penilaian. Fitur harus
memungkinkan admin mengganti kategori dan detail untuk periode berikutnya tanpa menghapus atau
mengubah penilaian yang sudah tercatat.

Agent wajib memperbarui status, bukti pengujian, keputusan, log, dan handoff setelah setiap
milestone lulus. Jangan menandai milestone selesai hanya berdasarkan review kode.

## 1. Identitas

| Field                         | Nilai                                                               |
| ----------------------------- | ------------------------------------------------------------------- |
| Status                        | `IMPLEMENTED_PENDING_EXTERNAL_VALIDATION`                           |
| Baseline commit               | `af8d198`                                                           |
| Dibuat                        | 2026-08-10 WIB                                                      |
| Diperbarui                    | 2026-08-11 WIB                                                      |
| Milestone aktif               | AC-6                                                                |
| Framework                     | Next.js App Router 16.3.0, React 19, Tailwind CSS                   |
| Backend                       | Supabase Auth, PostgreSQL, RLS, RPC service-role                    |
| Ruang lingkup                 | Kategori penilaian, detail penilaian, snapshot periode, audit trail |
| Perubahan lokal di luar scope | `supabase/config.toml`                                              |

## 2. Tujuan Dan Definisi Selesai

Fitur dianggap selesai jika:

1. Admin dapat mengarsipkan dan memulihkan kategori melalui UI dengan modal konfirmasi.
2. Admin dapat mengarsipkan dan memulihkan detail melalui UI dengan modal konfirmasi.
3. Tidak ada hard delete terhadap `category` atau `detail` pada alur aplikasi.
4. Arsip tidak menghapus atau mengubah `category_weight_history`, `detail_config_history`,
   `assessment`, `deduction_event`, `cashier_period_score`, atau `leaderboard_entry` lama.
5. Periode berjalan tetap memakai snapshot yang dibuat ketika periode dibuka.
6. Kategori/detail yang diarsipkan tidak masuk snapshot periode berikutnya.
7. Kategori/detail yang dipulihkan dapat masuk periode berikutnya setelah konfigurasi valid.
8. Semua perubahan status dicatat di `audit_log` dengan actor, alasan, data sebelum, dan data
   sesudah.
9. Hanya admin aktif yang dapat menjalankan mutasi; RPC tetap service-role-only.
10. UI memakai istilah `Arsipkan` dan `Pulihkan`, bukan `Hapus`.
11. Regression gate, build production, dan smoke test staging lulus.

## 3. Kondisi Sistem Saat Ini

- `DELETE /api/categories/[id]` bukan hard delete. Endpoint memanggil
  `admin_update_category(..., p_is_active: false)`.
- Belum ada tombol arsip kategori pada `CategoryEditForm` atau halaman detail kategori.
- Belum ada endpoint maupun tombol arsip/pulihkan detail.
- Halaman daftar kategori hanya mengambil `is_active = true`, sehingga kategori arsip tidak dapat
  dilihat atau dipulihkan dari UI.
- `category` dan `detail` sudah memiliki kolom `is_active`.
- Form penilaian membaca `category_weight_history` dan `detail_config_history`, bukan konfigurasi
  master aktif.
- `open_period` hanya menyalin kategori aktif dan detail aktif ke snapshot periode baru.
- Select RLS untuk `category`, `detail`, dan tabel snapshot mengizinkan authenticated user membaca
  row arsip. Ini diperlukan agar periode berjalan tetap dapat menggunakan snapshot lama.
- Foreign key awal masih memakai `ON DELETE CASCADE` pada beberapa relasi master ke data
  historis. Hard delete langsung melalui SQL dapat menghapus assessment dan snapshot.
- Migrasi terbaru adalah `0055_allow_partial_category_configuration.sql`; migrasi fitur berikutnya
  harus memakai nomor setelah `0055`.
- `Modal` dan pola konfirmasi status sudah tersedia pada `src/components/ui/Modal.tsx` dan
  `src/components/cashiers/CashierStatusButton.tsx`.

## 4. Keputusan Arsitektur Yang Tidak Boleh Diubah Diam-Diam

1. Arsip adalah perubahan `is_active`, bukan penghapusan row.
2. Mengarsipkan kategori tidak mengubah `is_active` detail anak. Parent nonaktif sudah membuat
   semua detailnya tidak masuk periode baru, sedangkan status anak tetap dapat dipulihkan dengan
   benar ketika parent dipulihkan.
3. Mengarsipkan detail hanya mengubah detail tersebut dan hanya memengaruhi snapshot periode baru.
4. Snapshot periode yang sudah dibuat bersifat immutable dari alur konfigurasi master.
5. Jangan memperbarui snapshot periode berjalan ketika kategori/detail diarsipkan atau dipulihkan.
6. Jangan menghitung ulang skor lama sebagai efek mutasi master.
7. Pemulihan kategori mengikuti batas total bobot aktif maksimal 100 persen. Persyaratan tepat
   100 persen tetap diperiksa ketika membuka periode baru.
8. Detail hanya boleh dipulihkan jika parent category aktif.
9. Semua mutasi status harus atomik bersama audit log di dalam RPC database.
10. Existing endpoint category DELETE boleh dipertahankan untuk kompatibilitas, tetapi UI baru
    memakai endpoint status eksplisit.
11. Jangan menambahkan endpoint hard DELETE untuk detail.
12. Jangan menjalankan `supabase db reset` terhadap project production.

## 5. Kontrak Kerja Agent

Sebelum memulai milestone:

1. Baca `AGENTS.md`, `docs/DEVELOPER_GUIDE.md`, dokumen ini, dan dokumentasi Next.js lokal yang
   relevan.
2. Jalankan `git status --short` dan catat perubahan user yang harus dipertahankan.
3. Pastikan baseline commit masih dapat diidentifikasi.
4. Hanya satu milestone boleh berstatus `IN_PROGRESS`.
5. Audit ulang migrasi terbaru sebelum menentukan nomor migrasi baru.
6. Jangan mengubah migrasi lama yang sudah digunakan production.

Setelah menyelesaikan satu milestone:

1. Jalankan seluruh test gate milestone.
2. Jalankan `git diff --check` dan `git status --short`.
3. Catat file yang berubah, keputusan, hasil test, dan blocker pada dokumen ini.
4. Ubah milestone menjadi `COMPLETE` hanya bila acceptance criteria dan test gate lulus.
5. Perbarui `Milestone aktif`, tabel bukti, handoff, dan log sebelum memulai milestone berikutnya.

## 6. Urutan Milestone

| ID   | Tujuan                                         | Status                        | Dependensi       |
| ---- | ---------------------------------------------- | ----------------------------- | ---------------- |
| AC-0 | Baseline data dan kontrak keselamatan          | `COMPLETE`                    | -                |
| AC-1 | Proteksi database, RPC status, dan audit trail | `COMPLETE`                    | AC-0             |
| AC-2 | Endpoint status kategori dan detail            | `COMPLETE`                    | AC-1             |
| AC-3 | UI daftar aktif/arsip dan status kategori      | `COMPLETE`                    | AC-2             |
| AC-4 | UI arsip/pulihkan detail                       | `COMPLETE`                    | AC-2, AC-3       |
| AC-5 | Regression historis dan periode berjalan       | `COMPLETE`                    | AC-1 sampai AC-4 |
| AC-6 | Staging, rollout production, dan observasi     | `BLOCKED_EXTERNAL_VALIDATION` | AC-5             |

## 7. AC-0: Baseline Data Dan Kontrak Keselamatan

**Tujuan:** membuktikan data apa yang harus tetap identik sebelum dan sesudah arsip.

**Langkah:**

1. Inventarisasi kategori/detail production yang akan diganti tanpa menampilkan data sensitif di
   log atau dokumen repository.
2. Untuk setiap target, catat ID, status, bobot, jumlah detail, jumlah periode snapshot, jumlah
   assessment, jumlah deduction event, dan jumlah skor terkait.
3. Catat periode yang sedang `open` dan pastikan target sudah atau belum berada pada snapshotnya.
4. Ambil backup database atau pastikan point-in-time recovery Supabase tersedia sebelum rollout.
5. Buat query verifikasi read-only untuk membandingkan count dan ID sebelum/sesudah arsip.
6. Dokumentasikan bahwa perubahan master berlaku untuk periode berikutnya, bukan periode berjalan.

**Tabel yang wajib masuk baseline:**

- `category`
- `detail`
- `category_weight_history`
- `detail_config_history`
- `assessment`
- `deduction_event`
- `cashier_period_score`
- `cashier_period_completion`
- `leaderboard_entry`
- `audit_log`

**Acceptance criteria:** tersedia baseline read-only yang dapat diulang dan daftar invariant data
historis yang harus tetap identik.

**Test gate:** query read-only staging/production, `git status --short`, dan review kontrak data.

## 8. AC-1: Proteksi Database, RPC Status, Dan Audit

**Tujuan:** memastikan hard delete tidak dapat merusak riwayat dan perubahan status tercatat
secara atomik.

**Migrasi baru yang disarankan:**

- `supabase/migrations/0056_assessment_configuration_archive.sql`, atau nomor berikutnya bila sudah
  ada migrasi baru ketika agent mulai.

**Langkah database:**

1. Ubah foreign key historis yang relevan dari `ON DELETE CASCADE` menjadi `ON DELETE RESTRICT`
   atau `NO ACTION`:
   - `detail_category_id_fkey`
   - `category_weight_history_category_id_fkey`
   - `detail_config_history_detail_id_fkey`
   - `assessment_detail_id_fkey`
2. Verifikasi nama constraint terhadap production sebelum migrasi. Jangan berasumsi nama lokal
   selalu sama.
3. Buat RPC service-role-only `admin_set_category_status` dengan parameter:
   - `p_actor_id uuid`
   - `p_category_id uuid`
   - `p_is_active boolean`
   - `p_reason text`
4. RPC kategori wajib memvalidasi admin aktif, alasan 3-500 karakter, lock row, advisory lock bobot,
   idempotensi, dan batas total bobot saat restore.
5. RPC kategori hanya mengubah row category. Jangan mengubah detail anak atau snapshot.
6. Buat RPC service-role-only `admin_set_detail_status` dengan parameter setara.
7. RPC detail wajib lock detail dan parent, menolak restore bila parent archived, serta tidak
   menyentuh snapshot atau assessment.
8. Kedua RPC menulis `audit_log` dalam transaksi yang sama:
   - action `category.archived`, `category.restored`, `detail.archived`, atau `detail.restored`
   - entity type `category` atau `detail`
   - before/after row sebagai JSONB
   - alasan dimasukkan secara eksplisit pada payload audit
9. Revoke execute dari `public`, `anon`, dan `authenticated`; grant hanya ke `service_role`.
10. Regenerasi `src/types/database.ts` setelah migrasi lokal berhasil.

**Acceptance criteria:** direct hard delete terhadap konfigurasi yang memiliki child/history gagal,
RPC status atomik dan idempotent, serta row historis tidak berubah.

**Test gate:**

- migrasi lokal berhasil
- `npm run test:types`
- SQL security regression untuk permission RPC
- SQL test archive/restore dan audit log
- `npm run typecheck`
- `git diff --check`

## 9. AC-2: Endpoint Status Kategori Dan Detail

**Tujuan:** menyediakan kontrak server yang eksplisit dan tervalidasi untuk UI.

**Endpoint yang disarankan:**

- `PATCH /api/categories/[id]/status`
- `PATCH /api/categories/[id]/details/[detailId]/status`

**Request body:**

```json
{
  "isActive": false,
  "reason": "Diganti dengan konfigurasi penilaian baru"
}
```

**Langkah:**

1. Validasi body dengan Zod: `isActive` boolean dan reason trim 3-500 karakter.
2. Gunakan `requireRole(['admin'])`, `createAdminClient`, dan `withApiRoute`.
3. Panggil RPC status dari AC-1; jangan melakukan update tabel langsung dari Route Handler.
4. Pastikan `categoryId` pada URL cocok dengan parent detail yang dituju.
5. Kembalikan 404 untuk entity/parent mismatch, 400 untuk konfigurasi tidak valid, 403 untuk role,
   dan 200 untuk berhasil/idempotent.
6. Pertahankan `DELETE /api/categories/[id]` sebagai soft archive untuk kompatibilitas. Refactor agar
   memakai RPC baru atau tandai deprecated, tetapi jangan mengubahnya menjadi hard delete.
7. Hapus `is_active` dari generic category edit flow bila mutasi status sudah dipisahkan, agar semua
   perubahan status selalu memiliki reason dan audit trail.
8. Terapkan rate limit yang konsisten dengan endpoint mutasi admin lain bila helper tersedia.

**Acceptance criteria:** non-admin tidak dapat mengubah status, payload invalid ditolak, parent
mismatch ditolak, dan error database diterjemahkan menjadi pesan UI yang aman.

**Test gate:** lint, typecheck, API contract test, auth regression, dan test status idempotent.

## 10. AC-3: UI Daftar Aktif/Arsip Dan Status Kategori

**Tujuan:** admin dapat menemukan, mengarsipkan, dan memulihkan kategori tanpa kehilangan konteks.

**Langkah UI daftar:**

1. Ubah `/settings/categories` agar menerima query `status=active|archived`.
2. Gunakan tab/segmented control `Aktif` dan `Arsip`. Default tetap `Aktif`.
3. Query server hanya mengambil status yang dipilih dan tetap diurutkan berdasarkan nama.
4. Total bobot, indikator sisa bobot, dan form tambah kategori hanya dihitung/ditampilkan pada tab
   aktif.
5. Kartu arsip menampilkan badge `Diarsipkan` dan tetap dapat dibuka untuk melihat detail.
6. Tampilkan jumlah detail aktif dan total detail agar dampak restore dapat dipahami.

**Langkah UI detail kategori:**

1. Buat `CategoryStatusButton` sebagai Client Component dengan icon Lucide `Archive` atau
   `ArchiveRestore`, tooltip, dan label aksesibel.
2. Gunakan `Modal`/`ConfirmDialog` yang sudah ada. Jangan membuat sistem modal baru.
3. Wajibkan alasan 3-500 karakter seperti pola perubahan status kasir.
4. Modal archive menjelaskan secara singkat:
   - kategori tidak digunakan pada periode baru
   - periode berjalan dan penilaian lama tetap memakai snapshot
   - tidak ada data penilaian yang dihapus
5. Modal restore menjelaskan bobot yang akan kembali aktif dan kemungkinan gagal bila total aktif
   melebihi 100 persen.
6. Selama request, disable tombol confirm/cancel yang relevan dan cegah double submit.
7. Setelah berhasil, `router.refresh()` dan arahkan ke tab status yang sesuai tanpa full reload.
8. Pada kategori arsip, sembunyikan form tambah detail dan nonaktifkan edit konfigurasi. Data tetap
   dapat dibaca dan tombol `Pulihkan` tetap tersedia.
9. Jangan menggunakan label `Hapus Kategori` pada UI baru.

**Acceptance criteria:** layout tidak bergeser, modal focus trap/Escape bekerja, loading tidak macet,
dan kategori berpindah antara tab Aktif/Arsip setelah mutation berhasil.

**Test gate:** lint, typecheck, keyboard navigation, reduced-motion, screenshot mobile/desktop, dan
E2E admin kategori archive/restore.

## 11. AC-4: UI Arsip Dan Pulihkan Detail

**Tujuan:** admin dapat mengganti detail untuk periode berikutnya tanpa menghapus detail lama.

**Langkah:**

1. Pada halaman kategori aktif, tambahkan filter/segmented control detail `Aktif` dan `Arsip`.
2. Buat `DetailStatusButton` dengan icon `Archive`/`ArchiveRestore`, tooltip, aria-label, dan modal
   alasan.
3. Letakkan action dekat badge status tanpa mengubah ukuran kartu saat modal dibuka.
4. Arsip detail memanggil endpoint status AC-2 dan tidak menghapus row.
5. Restore detail hanya tersedia bila parent category aktif.
6. Pada parent category arsip, detail hanya read-only; status detail asli tetap ditampilkan.
7. Detail yang diarsipkan tetap tampil pada tab Arsip dan dapat dibuka/dipulihkan.
8. Form tambah detail hanya muncul untuk parent category aktif.
9. Setelah berhasil, refresh data dan pertahankan tab detail yang relevan.

**Acceptance criteria:** detail aktif tidak muncul pada snapshot periode baru setelah diarsipkan,
detail lama tetap dapat ditemukan, dan restore di parent archived ditolak server serta dijelaskan UI.

**Test gate:** lint, typecheck, API test, keyboard/modal test, screenshot, dan E2E detail
archive/restore.

## 12. AC-5: Regression Historis Dan Periode Berjalan

**Tujuan:** membuktikan fitur tidak mengubah penilaian yang sudah ada.

**Skenario wajib:**

1. Buka periode dengan kategori/detail lama dan buat assessment skala serta deduction event.
2. Simpan baseline score, category score JSON, completion status, snapshot, assessment, dan event.
3. Arsipkan satu detail yang ada pada snapshot periode berjalan.
4. Pastikan assessment detail tersebut masih dapat dilanjutkan pada periode berjalan.
5. Arsipkan parent category dan ulangi verifikasi periode berjalan.
6. Pastikan semua row historis dan skor baseline identik setelah archive/restore master.
7. Buka periode berikutnya dan buktikan category/detail arsip tidak masuk snapshot baru.
8. Pulihkan konfigurasi, buka periode berikutnya lagi pada fixture terisolasi, dan buktikan row aktif
   masuk snapshot.
9. Coba hard delete category/detail yang sudah dipakai dan pastikan database menolak.
10. Uji admin, manager, supervisor, user nonaktif, request tanpa session, dan request lintas parent.
11. Uji konfigurasi aktif sementara di bawah 100 persen: archive/create boleh dilakukan, tetapi
    preflight/open period harus menolak sampai total tepat 100 persen.

**Invariant yang tidak boleh berubah akibat archive/restore:**

- jumlah dan nilai `assessment`
- jumlah dan nilai `deduction_event`
- snapshot periode yang sudah ada
- `cashier_period_score.total_score` dan `category_scores`
- status completion periode berjalan
- leaderboard periode yang sudah ditutup

**Acceptance criteria:** seluruh invariant lulus dan tidak ada query rekalkulasi historis yang
terpicu oleh perubahan master.

**Test gate:**

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run test:api`
- `npm run test:security`
- `npm run test:e2e`
- `npm run build`
- `git diff --check`

## 13. AC-6: Staging Dan Rollout Production

**Tujuan:** menerapkan fitur tanpa risiko kehilangan data production.

**Urutan rollout:**

1. Pastikan backup/PITR dan baseline AC-0 tersedia.
2. Terapkan migrasi AC-1 di staging terlebih dahulu.
3. Jalankan security regression dan skenario periode berjalan di staging.
4. Deploy aplikasi setelah RPC tersedia. Jangan deploy API yang bergantung pada RPC sebelum
   migrasi database berhasil.
5. Smoke test akun admin pada desktop dan iPhone.
6. Terapkan migrasi production pada jam perubahan yang disepakati. Perhatikan lock saat mengganti
   foreign key dan jangan menjalankannya bersamaan dengan batch penilaian besar.
7. Deploy aplikasi, lalu arsipkan satu fixture/test configuration yang tidak dipakai bila tersedia.
8. Bandingkan count dan invariant AC-0 setelah tindakan pertama.
9. Pantau error API, audit log, query latency, serta form penilaian periode berjalan.
10. Setelah stabil, admin dapat mengarsipkan konfigurasi lama, membuat konfigurasi baru, dan
    memastikan total bobot aktif tepat 100 persen sebelum periode berikutnya dibuka.

**Rollback:**

- Rollback aplikasi terlebih dahulu bila UI/API bermasalah; status row tetap dapat dipulihkan dari
  audit log.
- RPC baru boleh tetap berada di database selama rollback aplikasi karena bersifat additive.
- Jangan mengembalikan foreign key ke cascade sebagai respons insiden biasa.
- Jangan memulihkan data dengan hard delete atau menulis ulang snapshot periode.
- Bila status salah berubah, gunakan RPC restore dengan alasan insiden dan verifikasi audit log.

**Acceptance criteria:** staging dan production smoke test lulus, invariant data tetap sama, dan
agent mencatat waktu migrasi/deploy serta hasil observasi.

## 14. Peta File Implementasi

**Kemungkinan file baru:**

- `supabase/migrations/0056_assessment_configuration_archive.sql`
- `src/app/api/categories/[id]/status/route.ts`
- `src/app/api/categories/[id]/details/[detailId]/status/route.ts`
- `src/components/categories/CategoryStatusButton.tsx`
- `src/components/categories/DetailStatusButton.tsx`

**Kemungkinan file berubah:**

- `src/app/(app)/settings/categories/page.tsx`
- `src/app/(app)/settings/categories/[id]/page.tsx`
- `src/components/categories/CategoryEditForm.tsx`
- `src/components/categories/DetailForm.tsx`
- `src/app/api/categories/[id]/route.ts`
- `src/types/database.ts`
- `supabase/tests/security_regression.sql`
- test API/E2E terkait kategori
- dokumen ini

## 15. Hal Di Luar Scope

- Hard delete kategori/detail production.
- Mengubah snapshot periode yang sudah dibuka.
- Memindahkan assessment lama ke detail baru.
- Menghitung ulang periode tertutup memakai konfigurasi baru.
- Membuka dua versi konfigurasi dalam periode yang sama.
- Mengubah bobot atau definisi detail secara retroaktif.
- Menghapus data historis untuk merapikan UI.

Kebutuhan mengganti konfigurasi di tengah periode yang sama harus menjadi proyek versioning/migrasi
terpisah dengan keputusan bisnis eksplisit, bukan bagian fitur arsip ini.

## 16. Bukti Milestone

| Milestone | Commit | Migrasi/Files                                 | Test                                                                                         | Status        | Catatan                                                      |
| --------- | ------ | --------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------ |
| AC-0      | -      | Baseline contract + regression fixture        | SQL regression                                                                               | `COMPLETE`    | Baseline production aktual tetap wajib dibuat pada AC-6      |
| AC-1      | -      | `0056_assessment_configuration_archive.sql`   | Supabase local migration + security regression                                               | `COMPLETE`    | FK restrict, RPC atomic, audit, dan hard-delete guard lulus  |
| AC-2      | -      | API status routes + legacy DELETE refactor    | Typecheck, lint, API smoke 8 request                                                         | `COMPLETE`    | Auth, payload, dan parent mismatch tervalidasi               |
| AC-3      | -      | Categories list/detail + CategoryStatusButton | Build + lint/typecheck                                                                       | `COMPLETE`    | Tab aktif/arsip dan modal reason tersedia                    |
| AC-4      | -      | DetailStatusButton + detail tabs              | Build + lint/typecheck                                                                       | `COMPLETE`    | Restore child pada parent archived ditolak oleh RPC          |
| AC-5      | -      | Security regression + E2E archive spec        | Security pass; archive/restore admin desktop+mobile 2/2 pass; full E2E 17 pass/3 skip/0 fail | `COMPLETE`    | Test mengikuti perpindahan detail antara tab Aktif dan Arsip |
| AC-6      | -      | -                                             | Belum dijalankan                                                                             | `NOT_STARTED` | Belum ada staging/production migration atau smoke test       |

## 17. Hasil Eksekusi Lokal

Implementasi AC-1 sampai AC-4 sudah diterapkan dan diuji pada fixture Supabase lokal baru dengan
volume PostgreSQL terisolasi. Volume Supabase lokal lama tidak digunakan karena dibuat dengan
PostgreSQL 15 sedangkan image lokal saat ini PostgreSQL 17; tidak ada reset atau penghapusan data
production.

Gate yang lulus:

- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd test` — 35 test lulus
- `npm.cmd run test:types`
- `npm.cmd run build`
- `npm.cmd run test:api` — 8 protected request menghasilkan JSON 401 ter-normalisasi
- `npm.cmd run test:security` — migration, RLS, RPC privilege, audit, FK restrict, snapshot, dan
  invariant historis lulus
- Public E2E — 2 test lulus; 6 test authenticated dilewati pada run tanpa credential
- `git diff --check`

Test `e2e/assessment-configuration-archive.spec.ts` lulus untuk alur admin archive dan restore
kategori/detail pada Chromium desktop dan mobile. Spesifikasi mengikuti perilaku UI aktual: detail
yang diarsipkan berpindah ke tab Detail Arsip dan kembali ke Detail Aktif setelah dipulihkan.

Blocker sebelum production:

1. Buat baseline read-only production dan pastikan backup/PITR tersedia.
2. Jalankan migration dan smoke test pada staging dengan nama constraint production yang sudah
   diverifikasi.
3. Commit/deploy aplikasi setelah migration staging lulus, lalu observasi audit/API/error rate.

Tidak ada perubahan production yang dilakukan selama implementasi ini. `supabase/config.toml`
tetap dibiarkan sebagai perubahan lokal yang sudah ada sebelumnya.

## 18. Catatan Handoff Aktif

- Mulai dari AC-0 dan jangan melakukan write pada production saat baseline.
- Existing category DELETE adalah soft archive, tetapi UI belum menyediakan tombolnya.
- Periode berjalan sudah membaca snapshot; perubahan master tidak boleh mengubah snapshot.
- Jangan cascade-update status detail saat parent category diarsipkan.
- Tambahkan proteksi database terhadap hard delete sebelum membuka UI arsip production.
- Migrasi berikutnya harus memakai nomor setelah migrasi terbaru saat implementasi dimulai.
- Pertahankan perubahan user pada `supabase/config.toml`; file itu bukan bagian roadmap ini.
- Setelah satu milestone lulus, perbarui dokumen ini sebelum melanjutkan.

## 19. Log Perubahan Dokumen

| Waktu          | Agent | Perubahan                                                                                                                   |
| -------------- | ----- | --------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-10 WIB | Codex | Membuat roadmap arsip kategori/detail berdasarkan audit schema, snapshot periode, API, UI, RLS, dan foreign key production. |
| 2026-08-11 WIB | Codex | Menerapkan AC-1 sampai AC-4, menambah regression/API/E2E test, dan mencatat gate lokal serta blocker production.            |
| 2026-08-11 WIB | Codex | Memperbaiki alur test tab arsip; authenticated E2E desktop/mobile dan full regression suite lulus tanpa failure.            |
