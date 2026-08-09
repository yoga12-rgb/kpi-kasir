# AI Remediation Roadmap

Dokumen ini adalah sumber kebenaran operasional untuk perbaikan aplikasi KPI Kasir Rajaklana.
Dokumen ditujukan untuk agent AI atau developer yang melanjutkan pekerjaan pada sesi berbeda.

Dokumen ini wajib diperbarui setelah satu step selesai dan seluruh test gate step tersebut lulus.
Jangan memulai step berikutnya sebelum hasil implementasi, bukti pengujian, keputusan, dan handoff
step sebelumnya sudah dicatat di dokumen ini.

## 1. Identitas Dokumen

| Field | Nilai |
| --- | --- |
| Versi dokumen | 1.0.42 |
| Dibuat | 2026-08-09 14:19 WIB |
| Terakhir diperbarui | 2026-08-09 19:19 WIB |
| Baseline commit | `72e6cb3` |
| Status produksi | `BLOCKED` sampai Milestone M1-M8 selesai |
| Milestone aktif | M8.3 - Staging Dan Operational Readiness |
| Step berikutnya | M8.3 - Staging Dan Operational Readiness |
| Sumber audit | `docs/TECHNICAL_AUDIT.md` dan audit live database 2026-08-09 |

Jika source code, database live, dan dokumen berbeda, urutan sumber kebenaran adalah:

1. migrasi yang benar-benar sudah diterapkan pada database target;
2. source code pada branch aktif;
3. dokumen ini;
4. dokumen lama lainnya.

Perbedaan yang ditemukan wajib dicatat pada bagian `Catatan Handoff Aktif` sebelum implementasi.

## 2. Kontrak Kerja Wajib Untuk Agent

### 2.1 Sebelum Mengubah Kode

1. Baca dokumen ini sampai bagian milestone yang aktif.
2. Baca `docs/DEVELOPER_GUIDE.md` dan `docs/TECHNICAL_AUDIT.md`.
3. Jalankan `git status --short` dan jangan menghapus perubahan milik user.
4. Catat commit awal dengan `git rev-parse --short HEAD`.
5. Verifikasi Supabase lokal aktif sebelum menguji migrasi.
6. Baca seluruh file yang disebut dalam step, termasuk migrasi setelah file tersebut.
7. Ubah status step dari `READY` menjadi `IN_PROGRESS` dan isi nama agent serta waktu mulai.

### 2.2 Saat Implementasi

- Kerjakan hanya satu step dalam satu waktu.
- Jangan mengedit migrasi lama yang sudah pernah diterapkan. Buat migrasi baru berurutan.
- Jangan mengandalkan UI atau Route Handler sebagai satu-satunya authorization.
- Setiap bug wajib mendapatkan test regresi pada lapisan yang paling dekat dengan sumber bug.
- Setiap operasi multi-tabel harus atomik atau memiliki kompensasi yang diuji.
- Jangan menggunakan `service_role` dari Client Component atau bundle browser.
- Jangan menjalankan `supabase db reset` pada database lokal berisi data user tanpa persetujuan.
- Jangan menjalankan `npm audit fix --force`.
- Jangan menandai step selesai berdasarkan review kode saja.

### 2.3 Setelah Implementasi

Agent wajib melakukan urutan berikut:

1. Jalankan test gate khusus step.
2. Jalankan regression gate minimum.
3. Periksa `git diff --check` dan `git status --short`.
4. Jika satu test gagal, status step tetap `IN_PROGRESS` atau `BLOCKED`; catat kegagalannya.
5. Jika semua test lulus, ubah status step menjadi `COMPLETE`.
6. Isi ringkasan perubahan, file/migrasi, hasil test, bukti keamanan, dan risiko tersisa.
7. Perbarui `Terakhir diperbarui`, `Milestone aktif`, dan `Step berikutnya`.
8. Tambahkan satu entri pada `Log Perubahan Dokumen`.
9. Isi ulang `Catatan Handoff Aktif` untuk agent berikutnya.
10. Commit dokumen bersama implementasinya jika user meminta commit.

Agent dilarang memulai step baru sebelum poin 1-9 selesai.

### 2.4 Status Yang Diizinkan

| Status | Arti |
| --- | --- |
| `NOT_STARTED` | Belum dikerjakan |
| `READY` | Dependensi selesai dan siap dikerjakan |
| `IN_PROGRESS` | Sedang diimplementasikan atau diuji |
| `BLOCKED` | Tidak dapat dilanjutkan; alasan dan kebutuhan keputusan wajib dicatat |
| `COMPLETE` | Implementasi selesai dan semua acceptance criteria serta test gate lulus |

Hanya satu step boleh berstatus `IN_PROGRESS`.

## 3. Konteks Arsitektur Yang Tidak Boleh Hilang

- Framework: Next.js App Router 16.3.0, React 19, TypeScript, Tailwind CSS.
- Backend: Supabase Auth, PostgreSQL, RLS, RPC/trigger, dan private Storage.
- `createClient()` membawa session user dan tunduk pada RLS.
- `createAdminClient()` memakai service-role dan hanya boleh dipanggil server-side setelah guard.
- Role aplikasi: `admin`, `manager`, dan `supervisor`; kasir tidak mempunyai akun.
- Akses cabang: `users -> user_branch -> branch -> outlet -> cashier`.
- Permission role disimpan di `role_permission` dan dapat diubah melalui UI admin.
- Scoring berjalan melalui assessment, trigger PostgreSQL, `cashier_period_score`, lalu snapshot
  `leaderboard_entry` ketika periode ditutup.
- Foto kasir disimpan di bucket private `cashier-photos`; database hanya menyimpan object path.
- UI bersifat mobile-first dan saat ini dibatasi `max-w-app` 480px.

File orientasi utama:

- `src/lib/auth/guards.ts`
- `src/lib/auth/permissions.ts`
- `src/lib/supabase/server.ts`
- `src/app/api/`
- `supabase/migrations/`
- `supabase/migrations/0003_functions_cron.sql`
- `src/app/api/leaderboard/route.ts`
- `src/app/(app)/dashboard/page.tsx`
- `src/components/layout/AppShellClient.tsx`

## 4. Temuan Audit Yang Menjadi Dasar Roadmap

### 4.1 Blocker Produksi Yang Sudah Dibuktikan

| ID | Temuan | Bukti terbaru |
| --- | --- | --- |
| SEC-001 | `open_period`, `close_period`, dan rekalkulasi dapat dieksekusi `PUBLIC`, termasuk `anon` | `has_function_privilege(...)=true` pada DB lokal |
| SEC-002 | User non-admin dapat mengubah role sendiri menjadi admin | Uji UPDATE dalam transaksi berhasil lalu di-rollback |
| SEC-003 | Assessment lintas cabang dapat ditulis langsung | Uji manager terhadap assessment cabang lain berhasil lalu di-rollback |
| SEC-004 | Policy write assessment, deduction, mentoring menggunakan `USING (true)` | Policy aktif diverifikasi dari `pg_policies` |
| SEC-005 | `leaderboard_entry` menggunakan policy SELECT `USING (true)` | Migrasi dan policy live terverifikasi |
| SEC-006 | Toggle edit nama kasir/outlet memberi akses update seluruh kolom | Uji perubahan `is_active` berhasil lalu di-rollback |

Seluruh uji eksploitasi audit dilakukan di transaksi yang di-rollback. Tidak ada perubahan permanen.

### 4.2 Bug Integritas Utama

- Leaderboard periode tidak mengirim `periodId`, sehingga beberapa periode dapat tercampur.
- Dashboard menghitung baris assessment, bukan kasir lengkap dinilai.
- Pembuatan kategori memvalidasi total lama, bukan total setelah kategori ditambahkan.
- Kasir yang belum dinilai dapat memperoleh skor 100 dan masuk leaderboard.
- Rekalkulasi memakai category/detail aktif saat ini, bukan roster dan snapshot periode.
- Pembuatan kasir, mutasi, pendampingan, setup, dan penggantian foto belum atomik.
- Cron notifikasi tidak idempotent dan mengurutkan periode rendah berdasarkan UUID.
- Google invite memberi role/cabang sebelum token berhasil dikonsumsi secara atomik.

### 4.3 Bug UI/UX Utama

- Label form sering tidak terhubung ke kontrol karena `id` tidak dibuat otomatis.
- Modal tidak memiliki focus trap, restore focus, Escape handling, dan scroll lock lengkap.
- Browser zoom dinonaktifkan.
- Global `loading.tsx` membuat skeleton muncul kembali pada navigasi dinamis.
- Animasi halaman belum menghormati `prefers-reduced-motion`.
- Layout desktop tetap 480px dan bottom navigation belum memakai safe-area.
- Spinner masih dipakai pada leaderboard/notifikasi.
- Belum ada E2E spec walaupun Playwright sudah dikonfigurasi.

## 5. Keputusan Teknis Yang Mengikat

Keputusan berikut berlaku sampai user secara eksplisit mengubahnya.

### ADR-001: Authorization Berlapis

Route Handler wajib melakukan guard dan validasi bisnis. RLS tetap wajib membatasi operasi langsung
dengan permission dan cabang. Policy permissive dengan alasan "server guarded" tidak diperbolehkan.

### ADR-002: RPC Mutasi Sensitif

RPC periode dan rekalkulasi tidak boleh executable oleh `PUBLIC`, `anon`, atau user biasa. Route
admin memanggilnya dengan server-only service client setelah `requireAdmin()`. Function juga harus
menolak caller yang tidak dipercaya sebagai defense-in-depth.

### ADR-003: Skor Belum Lengkap

Kasir yang belum menyelesaikan seluruh detail wajib tidak memiliki skor final/rank. Nilai 100 hanya
boleh menjadi baseline detail deduksi yang memang sudah diinisialisasi, bukan default untuk data
yang belum diisi. Penutupan periode harus memiliki preflight dan override admin dengan alasan.

### ADR-004: Snapshot Historis

Periode menyimpan roster kasir, outlet, cabang, kategori, detail, dan konfigurasi yang berlaku saat
periode dibuka. Leaderboard periode tertutup membaca snapshot, bukan lokasi/config kasir saat ini.

### ADR-005: PWA Dan Cache Privat

Service worker tidak boleh menyimpan HTML terautentikasi, response API, signed URL, atau foto kasir.
Sampai strategi cache aman selesai, service worker tetap tidak diregistrasikan atau dihapus.

## 6. Test Gate Standar

### 6.1 Regression Gate Minimum

Jalankan setelah setiap step kode:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test -- --run
```

Jalankan `npm.cmd run build` jika step mengubah route, Server Component, middleware, dependency,
konfigurasi Next.js, atau kontrak import.

### 6.2 Gate Database/RLS

Wajib untuk perubahan SQL, RLS, RPC, trigger, atau constraint:

```powershell
supabase.cmd db lint --local --level warning
```

Tambahkan test integrasi yang membuktikan minimal:

- anon ditolak;
- supervisor tanpa permission ditolak;
- manager cabang A ditolak mengakses cabang B;
- manager cabang A hanya dapat melakukan aksi yang ditoggle;
- admin berhasil;
- user nonaktif ditolak meskipun token belum kedaluwarsa.

Migrasi harus diuji dari database kosong pada environment test terisolasi. Jangan reset database
kerja user tanpa persetujuan dan backup.

### 6.3 Gate UI

Wajib untuk perubahan UI/navigation:

- Playwright pada viewport 360x800, 480x900, dan 1440x900;
- keyboard-only navigation untuk kontrol yang berubah;
- tidak ada overflow/overlap;
- screenshot untuk state loading, kosong, error, dan data panjang;
- `prefers-reduced-motion` diverifikasi;
- console browser tanpa error dan request 4xx/5xx tidak terduga.

### 6.4 Gate Security Dependency

```powershell
npm.cmd audit --omit=dev
npm.cmd ls next postcss sharp --all
```

High/critical baru tidak boleh diterima tanpa catatan risiko dan persetujuan user.

## 7. Ringkasan Milestone

| Milestone | Tujuan | Status | Release gate |
| --- | --- | --- | --- |
| M0 | Baseline audit dan verifikasi | `COMPLETE` | Audit, build, lint, unit test, DB lint tersedia |
| M1 | Security containment | `COMPLETE` | Seluruh exploit P0 ditolak oleh test |
| M2 | Auth, setup, invite, dan lifecycle user | `COMPLETE` | Signup/invite atomik dan user nonaktif benar-benar ditolak |
| M3 | Transaksi data operasional | `COMPLETE` | Tidak ada partial write pada kasir, mutasi, mentoring, foto |
| M4 | Integritas scoring dan periode | `COMPLETE` | Snapshot, completeness, dan close-period konsisten |
| M5 | Leaderboard dan dashboard benar | `COMPLETE` | Data per periode/cabang dan metrik dashboard tervalidasi |
| M6 | API, cron, performa, dan observability | `COMPLETE` | API contract, cron idempotent, list scalable |
| M7 | UI, aksesibilitas, dan navigasi | `COMPLETE` | E2E viewport dan keyboard gate lulus |
| M8 | Release hardening dan dokumentasi | `IN_PROGRESS` | Full regression lulus; staging smoke eksternal masih diperlukan |

## 8. Milestone M1 - Security Containment

M1 adalah blocker. Jangan mengerjakan fitur baru sebelum M1 selesai.

### M1.1 - Kunci RPC Mutasi

Status: `COMPLETE`
Agent: Codex
Mulai: 2026-08-09 14:24 WIB
Selesai: 2026-08-09 14:32 WIB

Implementasi:

- Menambahkan migrasi `0026_lockdown_period_rpc.sql` tanpa mengedit migrasi lama.
- Mencabut EXECUTE RPC dari `PUBLIC`, `anon`, dan `authenticated`.
- Memberikan EXECUTE hanya kepada `service_role`.
- Menambahkan guard internal service-role pada open/close period.
- Menambahkan guard recalculate yang tetap mengizinkan pemanggilan dari trigger database.
- Mengubah route admin open/close untuk memakai `createAdminClient()` setelah `requireRole(['admin'])`.

Acceptance criteria:

- Lulus: privilege `PUBLIC=false`, `anon=false`, `authenticated=false`, `service_role=true`.
- Lulus: direct user trigger assessment tetap melakukan rekalkulasi dalam transaksi rollback.
- Lulus: direct service-role recalculate berhasil dalam transaksi rollback.
- Lulus: service-role open period duplicate-safe berhasil dalam transaksi rollback.
- Lulus: migrasi `0026` diterapkan pada database lokal dan migration list sinkron.
- Lulus: caller API admin terkompilasi dan memakai server-only client yang benar.

Test yang dijalankan:

- `supabase.cmd migration up --local` -> PASS, `0026` applied.
- `supabase.cmd migration list --local` -> PASS, local/remote sampai `0026`.
- `supabase.cmd db lint --local --level warning` -> PASS, no schema errors.
- SQL privilege check -> PASS, hanya `service_role` memiliki EXECUTE.
- Trigger assessment recalculate -> PASS dalam transaksi rollback.
- Service-role recalculate/open positive path -> PASS dalam transaksi rollback.
- `npm.cmd run typecheck` -> PASS.
- `npm.cmd run lint` -> PASS tanpa warning/error; catatan `next lint` deprecated.
- `npm.cmd test -- --run` -> PASS, 2 file dan 16 test.
- `npm.cmd run build` -> PASS, 32 route/static generation selesai.

Catatan risiko:

- Belum ada E2E login admin yang memanggil route HTTP secara penuh karena repository belum memiliki
  test fixture/session admin. Database service-role path yang dipakai route sudah diuji positif.
- Perilaku skor kategori belum dinilai = 100 sengaja tidak diubah pada M1.1; remediation-nya adalah
  M4.3.
- Rollout harus forward-only: deploy route yang memakai service-role terlebih dahulu, lalu apply
  migrasi `0026`. Jangan rollback kode ke route lama setelah migrasi diterapkan.
- M1 tetap `IN_PROGRESS` sampai M1.2-M1.6 selesai.

### M1.2 - Tutup Self Role Escalation Dan User Nonaktif

Status: `COMPLETE`

Agent: Codex

Mulai: 2026-08-09 14:33 WIB

Selesai: 2026-08-09 14:42 WIB

Commit hasil: `NOT_COMMITTED`

Implementasi:

- Migrasi `0027_lockdown_user_access.sql` menghapus policy `users_update_own` dan
  `users_update_admin`, serta mencabut `INSERT/UPDATE/DELETE` `users` dari `authenticated`.
- Helper `is_active_user`, `current_user_role`, `user_has_branch_access`,
  `user_can_access_branch`, dan `user_has_permission` sekarang menolak akun nonaktif.
- Restrictive policy `active_user_guard` diterapkan ke seluruh tabel publik dan `storage.objects`.
- RPC `admin_update_user` hanya dapat dipanggil `service_role`, melakukan perubahan atomik,
  mencegah admin mengubah role/status dirinya sendiri, mencegah hilangnya admin aktif terakhir,
  dan menulis actor, timestamp, before, serta after ke `audit_log`.
- Endpoint `PATCH /api/users/[id]` dan panel admin `UserManagementList` menjadi flow resmi untuk
  perubahan role/status user.
- Signed URL avatar diganti proxy same-origin `GET /api/storage/cashier-avatar`; proxy memvalidasi
  session aktif pada setiap request dan `CashierAvatar` memakai `unoptimized` agar cookie auth ikut
  dikirim. Dengan ini signed URL lama tidak menjadi jalur bypass setelah user dinonaktifkan.

Acceptance evidence:

- `authenticated_can_update_users=false`, `anon_can_call_admin_update=false`,
  `authenticated_can_call_admin_update=false`, dan `service_role_can_call_admin_update=true`.
- Admin dapat mengubah role/status user dalam transaksi rollback dan audit `before/after` terbentuk.
- Mutasi role/status admin sendiri ditolak.
- User yang dibuat nonaktif melihat `is_active_user=false`, `0` baris branch, dan `0` baris users
  melalui konteks `authenticated`; seluruh perubahan pengujian di-rollback.

Ruang lingkup:

- Drop `users_update_own` yang dapat mengubah semua kolom.
- Cabut direct UPDATE `users` dari role yang tidak membutuhkan.
- Jika edit nama profil diperlukan, gunakan endpoint/RPC yang hanya menerima `full_name`.
- Pastikan helper `is_admin`, permission, branch, outlet, cashier, dan storage memeriksa
  `users.is_active=true`.
- Pastikan user nonaktif tidak dapat membaca/menulis melalui Data API dengan token lama.
- Tambahkan alur server untuk perubahan role/status user dan audit log.

Acceptance criteria:

- Manager/supervisor tidak dapat mengubah `role`, `email`, atau `is_active` sendiri.
- User nonaktif ditolak oleh page, API, RLS, RPC, dan Storage.
- Admin dapat mengubah role/status melalui endpoint resmi.
- Perubahan role/status mempunyai actor, timestamp, before, dan after pada audit log.

Test gate:

- `supabase.cmd migration up --local` -> PASS, migrasi `0027` diterapkan tanpa reset data.
- `supabase.cmd db lint --local --level warning` -> PASS tanpa schema error.
- `supabase.cmd migration list --local` -> PASS, migration `0001` sampai `0027` sinkron lokal.
- Privilege SQL, RPC positive/negative path, audit log, self-mutation rejection, dan inactive-token
  RLS test -> PASS dalam transaksi rollback.
- `npm.cmd run typecheck` -> PASS.
- `npm.cmd run lint` -> PASS tanpa warning/error; catatan `next lint` deprecated.
- `npm.cmd test -- --run` -> PASS, 2 file dan 16 test.
- `npm.cmd run build` -> PASS, route `/api/users/[id]`, proxy avatar, dan 33 halaman terkompilasi.
- `git diff --check` dan target-file whitespace check -> PASS.

Catatan risiko:

- HTTP E2E dengan session admin belum tersedia karena repository belum memiliki fixture login; ini
  tetap menjadi acceptance tambahan pada M1.5.
- Perubahan role/status pada invite registration tetap merupakan server-role path tepercaya, bukan
  Data API client path; audit admin mutation sudah dicakup oleh RPC ini.
- Admin aktif saat ini sengaja tidak dapat menonaktifkan atau menurunkan role dirinya sendiri untuk
  mencegah lockout dan hilangnya admin terakhir.
- M1 tetap `IN_PROGRESS` sampai M1.3-M1.6 selesai.

### M1.3 - Ganti Policy Write Permissive

Status: `COMPLETE`

Agent: Codex

Mulai: 2026-08-09 14:48 WIB

Selesai: 2026-08-09 14:57 WIB

Commit hasil: `NOT_COMMITTED`

Implementasi:

- Migrasi `0028_operation_level_write_policies.sql` menghapus empat policy permissive
  `assessment_write_server_guarded`, `de_write_server_guarded`, `ms_write_server_guarded`, dan
  `mcn_write_server_guarded`.
- Assessment sekarang memiliki policy INSERT/UPDATE/DELETE yang memeriksa permission assessment,
  user aktif, cashier/cabang aktif, detail aktif, dan periode open.
- Deduction INSERT/DELETE wajib melalui assessment induk yang dapat diakses, bertipe deduction,
  cashier aktif, dan periode open; `created_by` wajib sama dengan user session.
- Mentoring session memeriksa permission mentoring, outlet/cabang aktif, dan `conducted_by` actor.
- Mentoring cashier note wajib menghubungkan session dan cashier pada outlet yang sama serta
  memastikan keduanya berada dalam akses cabang actor.
- Helper akses branch/outlet/cashier sekarang menolak entitas nonaktif.
- Endpoint DELETE deduction memuat parent assessment dan periode sebelum delete, lalu memverifikasi
  ulang hasil delete melalui RLS.

Acceptance evidence:

- Keempat policy permissive tidak lagi ada pada database lokal.
- Manager Bali dapat mengakses cashier Bali tetapi ditolak saat menulis assessment, deduction, atau
  mentoring session untuk cabang Jakarta.
- Permission assessment/mentoring yang dimatikan menolak direct write.
- Periode closed menolak assessment dan deduction baru.
- Flow normal manager pada cabang yang ditugaskan berhasil untuk assessment, deduction, mentoring
  session, dan note cashier pada outlet yang sama; seluruh test di-rollback.
- Note mentoring dengan cashier dari outlet berbeda ditolak.

Ruang lingkup:

- Drop `assessment_write_server_guarded`, `de_write_server_guarded`,
  `ms_write_server_guarded`, dan `mcn_write_server_guarded`.
- Buat policy per operasi yang memeriksa permission, user aktif, periode open, dan cabang.
- Deduction wajib mengikuti akses assessment induk.
- Mentoring note wajib memastikan cashier berasal dari outlet/cabang session yang valid.
- Endpoint DELETE deduksi wajib memverifikasi parent dan branch, bukan hanya UUID event.

Acceptance criteria:

- Direct write manager cabang A terhadap cabang B ditolak untuk seluruh tabel terkait.
- Permission off selalu menolak direct write dan API write.
- Periode closed menolak assessment/deduction baru.
- Admin dan role yang berizin tetap dapat menjalankan flow normal.

Test gate:

- `supabase.cmd migration up --local` -> PASS, migrasi `0028` diterapkan tanpa reset data.
- `supabase.cmd db lint --local --level warning` -> PASS tanpa schema error.
- Policy/privilege SQL inspection -> PASS; empat policy `*_write_server_guarded` tidak ditemukan.
- SQL security matrix cross-branch, permission off, closed period, normal flow, dan parent-scope
  mentoring note -> PASS dalam transaksi rollback.
- `npm.cmd run typecheck` -> PASS.
- `npm.cmd run lint` -> PASS tanpa warning/error; catatan `next lint` deprecated.
- `npm.cmd test -- --run` -> PASS, 2 file dan 16 test.
- `npm.cmd run build` -> PASS, 33 halaman dan seluruh route API terkompilasi.
- `git diff --check` dan target-file whitespace check -> PASS.

Catatan risiko:

- HTTP E2E dengan session nyata belum tersedia karena repository belum memiliki fixture login; ini
  tetap menjadi acceptance tambahan pada M1.5.
- M1.4 masih diperlukan untuk membatasi scope kolom `cashier`/`outlet` dan kebocoran leaderboard.
- Policy write server-guarded pada tabel lain di luar scope M1.3 tetap dilacak pada milestone berikutnya.
- M1 tetap `IN_PROGRESS` sampai M1.4-M1.6 selesai.

### M1.4 - Tutup Kebocoran Leaderboard Dan Scope Kolom

Status: `COMPLETE`

Agent: Codex

Mulai: 2026-08-09 15:00 WIB

Selesai: 2026-08-09 15:11 WIB

Commit hasil: `NOT_COMMITTED`

Implementasi:

- Migrasi `0029_leaderboard_and_column_scope.sql` mengganti `le_select_auth USING(true)` dengan
  policy `leaderboard_select_access` yang memeriksa permission leaderboard dan branch scope.
- `authenticated` tidak lagi memiliki update seluruh kolom `cashier`/`outlet`; hanya `UPDATE(name)`.
- Policy update cashier/outlet diselaraskan dengan permission dan akses entitas aktif.
- Endpoint edit nama tetap memakai session client; endpoint deactivate/transfer cashier dan perubahan
  sensitif outlet memakai `createAdminClient()` setelah admin guard.
- Operasi admin pada `outlet` tetap dapat mengubah field sensitif melalui endpoint resmi, sementara
  direct Data API client tidak memiliki privilege kolom tersebut.

Acceptance evidence:

- Manager hanya melihat satu row leaderboard dari cabang Bali; row Jakarta menghasilkan `0` row.
- Update nama outlet berhasil ketika permission tersedia, tetapi update `branch_id` dan `is_active`
  ditolak.
- Update nama cashier berhasil ketika toggle `cashiers.update` aktif, tetapi update `outlet_id` dan
  `is_active` ditolak.
- Privilege SQL menunjukkan `cashier_update_all=false`, `outlet_update_all=false`, dan hanya kolom
  `name` yang dapat di-update oleh `authenticated`.

Ruang lingkup:

- Ganti `le_select_auth USING(true)` dengan permission plus branch access.
- Batasi implementasi `cashiers.update` hanya pada nama kasir.
- Batasi `outlets.update` hanya pada nama outlet.
- Gunakan endpoint/RPC terpisah untuk status, transfer, atau perubahan branch.
- Tambahkan test bahwa toggle UI sesuai dengan kemampuan database sebenarnya.

Acceptance criteria:

- Manager hanya dapat membaca snapshot cabang yang ditugaskan.
- Toggle edit nama tidak dapat mengubah status, outlet, branch, tanggal kerja, atau avatar path.
- Update kolom terlarang ditolak melalui direct Data API.

Test gate:

- `supabase.cmd migration up --local` -> PASS, migrasi `0029` diterapkan tanpa reset data.
- `supabase.cmd db lint --local --level warning` -> PASS tanpa schema error.
- Leaderboard branch isolation, name-only update, permission toggle, dan forbidden-column SQL test
  -> PASS dalam transaksi rollback.
- `npm.cmd run typecheck` -> PASS.
- `npm.cmd run lint` -> PASS tanpa warning/error; catatan `next lint` deprecated.
- `npm.cmd test -- --run` -> PASS, 2 file dan 16 test.
- `npm.cmd run build` -> PASS, 33 halaman dan seluruh route API terkompilasi.
- `git diff --check` dan target-file whitespace check -> PASS.

Catatan risiko:

- HTTP E2E dengan session nyata belum tersedia karena repository belum memiliki fixture login; ini
  menjadi fokus M1.5.
- Admin endpoint sensitif memakai service-role client; guard role server wajib dipertahankan dan
  rollout harus tetap forward-only.
- M1 tetap `IN_PROGRESS` sampai M1.5-M1.6 selesai.

### M1.5 - Tambahkan Security Regression Suite

Status: `COMPLETE`

Agent: Codex

Mulai: 2026-08-09 15:12 WIB

Selesai: 2026-08-09 15:25 WIB

Commit hasil: `NOT_COMMITTED`

Implementasi:

- Menambahkan `supabase/tests/security_regression.sql` dengan fixture UUID deterministik, role
  matrix `anon`, `inactive`, `supervisor`, `manager A`, `manager B`, dan `admin`.
- Seluruh fixture, perubahan permission, dan data uji dibungkus satu transaksi lalu di-`ROLLBACK`;
  pengulangan test tidak meninggalkan user, branch, assessment, atau audit log.
- Menambahkan `scripts/security-regression.mjs` yang menemukan container Supabase lokal dan
  menjalankan suite melalui `psql` tanpa reset database kerja.
- Menambahkan command `npm.cmd run test:security`.

Ruang lingkup:

- Tambahkan test otomatis role matrix: anon, inactive, supervisor, manager A, manager B, admin.
- Cover SELECT/INSERT/UPDATE/DELETE dan RPC sensitif.
- Gunakan fixture deterministic dan cleanup/rollback.
- Integrasikan ke command test atau script terpisah yang didokumentasikan.

Acceptance criteria:

- Seluruh SEC-001 sampai SEC-006 memiliki negative regression test.
- Test gagal jika policy permissive diperkenalkan kembali.
- Test dapat dijalankan ulang dari environment test bersih.

Acceptance evidence:

- SEC-001: `open_period`, `close_period`, `recalculate_cashier_period_score`, dan
  `admin_update_user` hanya executable oleh `service_role`.
- SEC-002: direct self role escalation ditolak; akses mutasi profile `authenticated` juga ditolak.
- SEC-003/SEC-004: assessment, deduction, dan mentoring lintas cabang/parent mismatch ditolak;
  permission supervisor dan periode closed diuji.
- SEC-005: manager A/B hanya melihat leaderboard branch masing-masing, sedangkan admin melihat dua
  fixture branch.
- SEC-006: update nama outlet/kasir yang diizinkan berhasil, sementara `is_active` ditolak melalui
  column privilege dan RLS.
- Setelah suite selesai, query cleanup menunjukkan fixture auth/branch/audit berjumlah `0`.

Test gate:

- `npm.cmd run test:security` -> PASS, seluruh matrix SQL selesai dan `ROLLBACK`.
- `supabase.cmd db lint --local --level warning` -> PASS tanpa schema error.
- `npm.cmd run typecheck` -> PASS.
- `npm.cmd run lint` -> PASS tanpa warning/error; catatan `next lint` deprecated.
- `npm.cmd test -- --run` -> PASS, 2 file dan 16 test.
- `npm.cmd run build` -> PASS, 33 route/page terkompilasi.
- `git diff --check` -> PASS.

Catatan risiko:

- Suite saat ini menguji kontrak database/RLS melalui session database lokal, belum HTTP E2E dengan
  browser dan session Auth nyata. HTTP E2E tetap menjadi gap M7 dan smoke test staging.
- Runner membutuhkan Docker dan Supabase lokal yang sudah berjalan serta migrasi target sudah
  diterapkan; runner tidak menjalankan `db reset` dan tidak menghapus data user.
- M1.6 dependency hardening selesai; HTTP E2E tetap menjadi gap M7.

### M1.6 - Remediasi Dependency High

Status: `COMPLETE`

Agent: Codex

Mulai: 2026-08-09 15:27 WIB

Selesai: 2026-08-09 15:43 WIB

Commit hasil: `NOT_COMMITTED`

Implementasi:

- Upgrade `next` dan `eslint-config-next` ke `16.3.0`, versi yang kompatibel dengan Node lokal
  `22.14.0` dan React 19.
- Upgrade direct PostCSS ke `^8.5.26`; dependency Next menggunakan PostCSS `8.5.23`.
- Sharp dependency Next berada pada `0.35.3`; tidak ada override atau `npm audit fix --force`.
- Migrasi convention Next 16 dari `src/middleware.ts` ke `src/proxy.ts` dengan matcher dan alur
  cookie Supabase yang sama.
- Mengganti script `next lint` yang sudah dihapus Next 16 menjadi `eslint .`, menambah flat config
  `eslint.config.mjs`, dan mengecualikan artefak generated Supabase `.temp`.
- Next 16 memperbarui `tsconfig.json` untuk automatic JSX runtime dan `.next/dev/types`.

Ruang lingkup:

- Upgrade Next.js/PostCSS/Sharp pada branch terpisah tanpa `--force`.
- Ikuti migration guide Next.js dan ganti `next lint` dengan ESLint CLI jika diperlukan.
- Verifikasi image optimization, middleware, OAuth callback, RSC, dan production build.

Acceptance criteria:

- `npm audit --omit=dev` tidak melaporkan high/critical yang berasal dari paket tersebut.
- Seluruh test, build, avatar, login, dan navigasi lulus.
- Perubahan breaking dan rollback dicatat.

Acceptance evidence:

- `npm.cmd audit --omit=dev` -> PASS, `0 vulnerabilities`.
- `npm.cmd ls next postcss sharp --all` -> PASS: Next `16.3.0`, PostCSS `8.5.23`/`8.5.26`, Sharp
  `0.35.3`.
- Production build Next 16/Turbopack -> PASS; seluruh App Router page dan API route terkompilasi;
  tidak ada warning middleware.
- Smoke server production -> `/login=200`, `/dashboard=307`, dan `/api/branches=307` tanpa session.
  API `307` berasal dari `requirePermission()` lama dan dilacak sebagai M2.4, bukan regresi M1.6.
- `npm.cmd run typecheck` -> PASS.
- `npm.cmd run lint` -> PASS melalui ESLint CLI flat config.
- `npm.cmd test -- --run` -> PASS, 2 file dan 16 test.
- `npm.cmd run test:security` -> PASS dengan fixture rollback.
- `supabase.cmd db lint --local --level warning` -> PASS tanpa schema error.
- `git diff --check` -> PASS.

Catatan risiko:

- `npm.cmd audit` penuh masih melaporkan vulnerability dev-only pada rantai Vitest/Vite/esbuild;
  perbaikannya ditunda ke upgrade test tooling terpisah karena `npm audit fix --force` meminta
  Vitest 4 dan merupakan breaking change.
- OAuth provider nyata dan upload avatar dengan session browser belum diuji end-to-end karena belum
  ada credential/fixture Auth; route avatar tetap terkompilasi dan endpoint tanpa session diblokir.
- Kontrak API unauthenticated masih redirect HTML `307`, bukan JSON `401`; remediation tetap M2.4.
- Rollback kode: kembalikan `next`, `eslint-config-next`, dan PostCSS pada `package.json`/lockfile,
  pulihkan `src/middleware.ts` dan `.eslintrc.json`, lalu jalankan install dari lockfile lama.
  Tidak ada migrasi database pada M1.6.

Milestone M1 selesai hanya jika M1.1-M1.6 `COMPLETE`.

## 9. Milestone M2 - Auth, Setup, Invite, Dan User Lifecycle

### M2.1 - Pending Profile Dan Kebijakan Signup

Status: `COMPLETE`

Agent: Codex

Mulai: 2026-08-09 15:45 WIB

Selesai: 2026-08-09 15:53 WIB

Commit hasil: `NOT_COMMITTED`

Implementasi:

- Migrasi `0030_pending_profiles.sql` mengubah trigger `handle_new_user` agar profile Auth baru
  dibuat dengan role `supervisor` dan `is_active=false`.
- Flow setup admin pertama mengaktifkan profile secara eksplisit setelah Auth user berhasil dibuat.
- Flow pendaftaran email melalui invite dan flow Google invite mengaktifkan profile hanya setelah
  invite valid, role, nama, dan assignment cabang diproses.
- Konfigurasi lokal mematikan email signup (`GOTRUE_EXTERNAL_EMAIL_ENABLED=false`) tanpa mematikan
  external OAuth yang diperlukan untuk invite Google; user OAuth yang tidak diundang tetap pending
  dan tidak dapat melewati `requireUser`.
- Security regression fixture ditambah assertion bahwa Auth user baru tidak langsung aktif.

- User Auth baru harus menghasilkan profile inactive/pending, bukan supervisor aktif.
- Production email signup harus dimatikan pada Auth configuration cloud; `supabase/config.toml`
  hanya mengatur local development dan tidak menggantikan verifikasi Dashboard/Management API.
- Google OAuth user baru tetap pending sampai invite berhasil dikonsumsi.
- Login user pending/inactive menampilkan pesan stabil tanpa memberi akses data.

Acceptance evidence:

- Auth container setelah restart menunjukkan `GOTRUE_EXTERNAL_EMAIL_ENABLED=false`.
- Insert Auth fixture baru menghasilkan `public.users.role='supervisor'` dan `is_active=false`.
- User nonaktif tetap melihat 0 data dan ditolak write oleh RLS/security suite.
- Setup/invite/Google server flow sekarang memiliki aktivasi eksplisit; atomic multi-table completion
  menjadi scope M2.2.

Test gate:

- `supabase.cmd migration up --local` -> PASS, migrasi `0030` diterapkan.
- `supabase.cmd migration list --local` -> PASS, local/remote sampai `0030` sinkron.
- `supabase.cmd db lint --local --level warning` -> PASS tanpa schema error.
- `npm.cmd run test:security` -> PASS, pending-profile dan inactive-user assertions lulus.
- `npm.cmd run typecheck` -> PASS.
- `npm.cmd run lint` -> PASS.
- `npm.cmd test -- --run` -> PASS, 2 file dan 16 test.
- `npm.cmd run build` -> PASS, seluruh route terkompilasi pada Next 16.

Catatan risiko:

- Global Auth signup tetap `GOTRUE_DISABLE_SIGNUP=false` agar OAuth invite dapat membuat identity;
  application access tetap invitation-gated melalui pending profile. Konfigurasi OAuth dan Auth
  setting cloud wajib diverifikasi sebelum production.
- Aktivasi profile, assignment cabang, dan `invite.used_at` belum satu transaksi database; ini wajib
  diselesaikan pada M2.2.
- Kontrak API unauthenticated masih redirect `307`, sesuai gap M2.4.

### M2.2 - Invite Atomic Dan Dapat Dikelola

Status: `COMPLETE`

Agent: Codex

Mulai: 2026-08-09 15:54 WIB

Selesai: 2026-08-09 16:02 WIB

Commit hasil: `NOT_COMMITTED`

Implementasi:

- Migrasi `0031_atomic_invite_lifecycle.sql` menambahkan `revoked_at` dan `revoked_by`, lalu
  menyediakan RPC `consume_invite`, `revoke_invite`, dan `regenerate_invite` yang hanya executable
  oleh `service_role`.
- `consume_invite` mengunci baris invite dan user dengan `FOR UPDATE`, memvalidasi token, expiry,
  revoke state, email, profile pending, dan seluruh branch aktif; aktivasi profile, role, assignment
  cabang, dan `used_at/accepted_user_id` berada dalam satu transaksi RPC.
- Flow email invite dan Google invite memakai RPC yang sama. Jika pembuatan Auth user berhasil tetapi
  konsumsi invite gagal, route melakukan kompensasi dengan menghapus Auth user baru.
- Pembuatan invite menolak branch duplikat, branch tidak valid, dan branch nonaktif.
- Daftar invite memakai cursor pagination dan search server-side. UI menampilkan status pending,
  terdaftar, kedaluwarsa, atau dicabut, serta menyediakan revoke dan regenerate.
- Endpoint admin baru: `POST /api/invites/[id]/revoke` dan
  `POST /api/invites/[id]/regenerate`.

Acceptance evidence:

- Token hanya dapat dikonsumsi sekali; pemakaian ulang dan token kedaluwarsa ditolak.
- Revoke mencatat actor dan timestamp; regenerate mengganti token, menghapus revoke state, dan
  menetapkan expiry baru.
- Caller `anon` dan `authenticated` tidak memiliki EXECUTE pada ketiga RPC; `service_role` tetap
  dapat menjalankan positive path.
- Assignment role/branch, aktivasi profile, dan status invite diverifikasi setelah satu pemanggilan
  RPC dalam security regression transaction.
- Pagination/search invite tidak lagi mengambil seluruh daftar untuk halaman admin.

File dan migrasi:

- `supabase/migrations/0031_atomic_invite_lifecycle.sql`
- `supabase/tests/security_regression.sql`
- `src/lib/invites.ts`
- `src/app/api/invites/accept/route.ts`
- `src/app/api/invites/route.ts`
- `src/app/api/invites/[token]/revoke/route.ts`
- `src/app/api/invites/[token]/regenerate/route.ts`
- `src/components/invite/InviteList.tsx`
- `src/app/(app)/settings/users/page.tsx`
- `src/types/database.ts`

Test gate:

- `supabase.cmd migration up --local` -> PASS, migrasi `0031` diterapkan.
- `supabase.cmd migration list --local` -> PASS, local/remote sampai `0031` sinkron.
- `supabase.cmd db lint --local` -> PASS, tidak ada schema error.
- `npm.cmd run test:security` -> PASS, privilege, pending profile, atomic consume, token reuse,
  revoke, regenerate, expiry, dan role denial lulus dalam transaksi rollback.
- `npm.cmd run typecheck` -> PASS.
- `npm.cmd run lint` -> PASS tanpa warning/error.
- `npm.cmd test -- --run` -> PASS, 2 file dan 16 test.
- `npm.cmd run build` -> PASS, seluruh route termasuk endpoint lifecycle invite terkompilasi.

Catatan risiko:

- Auth user dibuat di luar transaksi PostgreSQL; route memakai kompensasi delete jika RPC final gagal.
  Ini mengurangi partial state, tetapi M8 tetap perlu integration test HTTP dengan kegagalan terkontrol.
- Global Auth signup masih aktif untuk mendukung pembuatan identity OAuth; enforcement akses tetap
  melalui pending profile dan RLS. Setting provider dan signup production wajib diverifikasi sebelum
  deployment.
- Revoke/regenerate hanya tersedia pada invite yang belum digunakan. Invite terpakai tidak diubah.
- API unauthenticated masih memiliki redirect `307`; standardisasi JSON adalah scope M2.4.

Step berikutnya: M2.3.

### M2.3 - Setup Admin Race-Safe

Status: `COMPLETE`

Agent: Codex

Mulai: 2026-08-09 16:03 WIB

Selesai: 2026-08-09 16:07 WIB

Commit hasil: `NOT_COMMITTED`

Implementasi:

- Migrasi `0032_race_safe_setup.sql` menambahkan reservation claim, timestamp claim, counter
  percobaan, dan window rate-limit pada satu baris `app_setup`.
- RPC `reserve_setup` mengunci baris setup dengan `FOR UPDATE`, menolak setup selesai, admin aktif,
  claim aktif, dan lebih dari lima percobaan dalam 15 menit.
- RPC `finalize_setup` memverifikasi claim, profile Auth, email, dan expiry claim; lalu mengaktifkan
  profile sebagai admin dan menandai setup selesai dalam satu transaksi.
- RPC `release_setup` melepaskan claim hanya melalui service role untuk jalur kompensasi.
- Migrasi `0033_setup_admin_guard.sql` menerapkan guard admin aktif secara forward-only setelah
  `0032` sudah diterapkan.
- `POST /api/setup` memakai claim UUID sebelum Auth create, menghapus Auth user baru bila finalize
  gagal, dan mengembalikan status `409/429` untuk setup selesai atau dibatasi.

Acceptance evidence:

- Request setup kedua saat claim pertama aktif ditolak.
- Lima percobaan tercatat; percobaan berikutnya mendapat rate limit.
- Finalize hanya dapat dilakukan oleh claim yang tepat dan menghasilkan satu admin aktif serta flag
  `app_setup.admin_created=true`.
- `anon` dan `authenticated` tidak memiliki EXECUTE pada seluruh setup RPC.
- Guard admin aktif menutup setup kedua walaupun flag setup stale.

File dan migrasi:

- `supabase/migrations/0032_race_safe_setup.sql`
- `supabase/migrations/0033_setup_admin_guard.sql`
- `supabase/tests/security_regression.sql`
- `src/app/api/setup/route.ts`
- `src/types/database.ts`

Test gate:

- `supabase.cmd migration up --local` -> PASS, migrasi `0032` dan `0033` diterapkan.
- `supabase.cmd migration list --local` -> PASS, local/remote sampai `0033` sinkron.
- `supabase.cmd db lint --local` -> PASS, tidak ada schema error.
- `npm.cmd run test:security` -> PASS, setup claim race, rate limit, finalize, admin guard, dan
  privilege denial lulus dalam transaksi rollback.
- `npm.cmd run typecheck` -> PASS.
- `npm.cmd run lint` -> PASS tanpa warning/error.
- `npm.cmd test -- --run` -> PASS, 2 file dan 16 test.
- `npm.cmd run build` -> PASS, route `/api/setup` terkompilasi.

Catatan risiko:

- Reservation tidak menahan database lock selama Auth API call; claim UUID dan expiry 10 menit
  mencegah request paralel, sedangkan delete Auth menjadi kompensasi jika finalize gagal.
- Jika delete Auth juga gagal, claim sengaja dibiarkan sampai expiry untuk mencegah retry liar; operasi
  berikutnya perlu dijalankan setelah claim timeout atau melalui recovery administratif.
- Rate limit saat ini berbasis satu baris database dan window tetap; rate limit global per IP untuk
  deployment multi-instance menjadi bagian M6.4.

Step berikutnya: M2.4.

### M2.4 - Kontrak Auth API Dan OAuth Redirect

Status: `COMPLETE`

Agent: Codex

Mulai: 2026-08-09 16:08 WIB

Selesai: 2026-08-09 16:16 WIB

Commit hasil: `NOT_COMMITTED`

Implementasi:

- Menambahkan `withApiRoute` untuk seluruh Route Handler di `src/app/api`: session/profile aktif
  diverifikasi sebelum handler, redirect dari guard diterjemahkan menjadi JSON `401/403`, dan
  request diberi `requestId` pada body/header.
- Response error lama berbentuk string dinormalisasi ke envelope `{ error: { code, message,
  requestId } }`; pesan teknis database/Auth disamarkan.
- Endpoint data yang sebelumnya tidak memanggil guard, termasuk periods current, sekarang ikut
  terlindungi oleh wrapper API. Setup, invite accept/detail, dan cron tetap public secara eksplisit
  lalu memiliki validasi masing-masing.
- Callback OAuth memvalidasi `x-forwarded-host` dan protocol terhadap `APP_ORIGIN_ALLOWLIST`; `next`
  hanya menerima path lokal sehingga tidak menjadi open redirect.
- Menambahkan unit test redirect safety dan environment `APP_ORIGIN_ALLOWLIST` pada `.env.example`.

Acceptance evidence:

- `GET /api/branches` tanpa session -> `401` JSON, bukan redirect `307`/HTML.
- `GET /api/periods/current` tanpa session -> `401` JSON dengan `requestId`.
- `GET /api/invites/does-not-exist` tetap public dan -> `404` JSON ter-normalisasi.
- API handler yang tidak terdaftar guard tidak lagi menjadi jalur baca anonim karena wrapper memeriksa
  profile aktif.
- Forwarded host yang tidak ada di allowlist tidak dipakai untuk redirect OAuth.

File utama:

- `src/lib/api/route.ts`
- seluruh `src/app/api/**/route.ts`
- `src/lib/auth/redirect.ts`
- `src/app/auth/callback/route.ts`
- `src/lib/auth/__tests__/redirect.test.ts`
- `.env.example`
- `docs/DEVELOPER_GUIDE.md`

Test gate:

- `npm.cmd run typecheck` -> PASS.
- `npm.cmd run lint` -> PASS tanpa warning/error.
- `npm.cmd test -- --run` -> PASS, 3 file dan 19 test.
- `npm.cmd run build` -> PASS, seluruh API wrapper dan callback terkompilasi.
- Smoke production server port `3109` -> PASS: protected API `401` JSON, public invite `404` JSON.
- `git diff --check` -> PASS.

Catatan risiko:

- `APP_ORIGIN_ALLOWLIST` wajib diisi dengan origin production yang tepat; tanpa konfigurasi proxy
  production dapat fallback ke origin request dan deployment harus dianggap tidak siap.
- Wrapper melakukan satu pembacaan session/profile tambahan sebelum guard bisnis; ini menambah satu
  query pada request API dan dapat dioptimalkan setelah kontrak guard stabil.
- Cron tetap public secara transport dan hanya dilindungi `CRON_SECRET`; idempotensi/rate limit cron
  menjadi scope M6.1/M6.4.

Step berikutnya: M3.1.

Milestone M2 selesai setelah flow password, Google, token ganda, expiry, inactive user, setup paralel,
API unauthenticated, dan OAuth origin gate lulus.

## 10. Milestone M3 - Transaksi Data Operasional

### M3.1 - Create Cashier Dengan History

Status: `COMPLETE`

Agent: Codex

Mulai: 2026-08-09 16:17 WIB

Selesai: 2026-08-09 16:18 WIB

Commit hasil: `NOT_COMMITTED`

Implementasi:

- Migrasi `0034_atomic_cashier_create.sql` menambahkan unique partial index
  `cashier_one_active_history_idx` untuk memastikan satu history aktif per kasir.
- RPC service-role-only `create_cashier_with_history` memvalidasi actor aktif, permission
  `cashiers.create`, outlet/cabang aktif, branch assignment, nama, dan employment date.
- Insert `cashier` dan `cashier_outlet_history` dipindahkan ke satu transaksi RPC.
- `POST /api/cashiers` sekarang memakai `requirePermission` untuk guard lalu memanggil RPC dengan
  admin client; tidak ada lagi dua insert client yang dapat meninggalkan partial state.

Acceptance evidence:

- Manager A berhasil membuat kasir pada outlet branch A beserta tepat satu history aktif.
- Manager A ditolak saat target outlet berada di branch B.
- Supervisor tanpa `cashiers.create` ditolak.
- Employment date masa depan ditolak.
- RPC tidak executable oleh `anon` atau `authenticated`.
- Existing local history tidak memiliki duplikasi aktif saat constraint diterapkan.

File dan migrasi:

- `supabase/migrations/0034_atomic_cashier_create.sql`
- `supabase/tests/security_regression.sql`
- `src/app/api/cashiers/route.ts`

Test gate:

- `supabase.cmd migration up --local` -> PASS, migrasi `0034` diterapkan.
- `supabase.cmd migration list --local` -> PASS, local/remote sampai `0034` sinkron.
- `supabase.cmd db lint --local` -> PASS, tidak ada schema error.
- `npm.cmd run test:security` -> PASS, positive/negative cashier creation dan privilege test lulus
  dalam transaksi rollback.
- `npm.cmd run typecheck` -> PASS.
- `npm.cmd run lint` -> PASS tanpa warning/error.
- `npm.cmd test -- --run` -> PASS, 3 file dan 19 test.
- `npm.cmd run build` -> PASS, route create cashier terkompilasi.
- `git diff --check` -> PASS.

Catatan risiko:

- History transfer masih memakai flow lama dan menjadi target M3.2; unique partial index sekarang
  akan menolak overlap aktif secara database.
- RPC memakai server-role setelah route guard; direct service-role caller tetap wajib menjaga actor
  ID yang benar. RLS/security suite memverifikasi actor/branch/permission pada RPC.

Step berikutnya: M3.2.

### M3.2 - Transfer Cashier Atomic

Status: `COMPLETE`

Agent: Codex

Mulai: 2026-08-09 16:19 WIB

Selesai: 2026-08-09 16:22 WIB

Commit hasil: `NOT_COMMITTED`

Implementasi:

- Migrasi `0035_atomic_cashier_transfer.sql` menambahkan RPC `transfer_cashier_atomic` service-role-only.
- RPC mengunci cashier, outlet target, dan active history; memvalidasi actor admin, cashier aktif,
  outlet target aktif, outlet berbeda, history aktif, dan `effective_at` setelah placement lama.
- Penutupan history lama, update outlet cashier, dan insert history baru dilakukan dalam satu transaksi.
- Migrasi `0036_harden_cashier_transfer_clock.sql` memperbaiki warning lint dan memberi toleransi
  clock skew satu menit untuk timestamp request tanpa melonggarkan penolakan tanggal jauh di masa depan.
- Endpoint transfer memvalidasi UUID dan `effectiveAt`, lalu memakai RPC; tidak ada lagi update/insert
  multi-step yang diabaikan error-nya.

Acceptance evidence:

- Admin berhasil memindahkan cashier dan tepat satu history baru menjadi aktif.
- Transfer outlet sama, target nonaktif, effective date sebelum history aktif, dan actor non-admin
  ditolak.
- Existing unique active-history index tetap menjaga invariant bila ada request bersamaan.
- RPC tidak executable oleh `anon` atau `authenticated`.

File dan migrasi:

- `supabase/migrations/0035_atomic_cashier_transfer.sql`
- `supabase/migrations/0036_harden_cashier_transfer_clock.sql`
- `supabase/tests/security_regression.sql`
- `src/app/api/cashiers/[id]/transfer/route.ts`

Test gate:

- `supabase.cmd migration up --local` -> PASS, migrasi `0035` dan `0036` diterapkan.
- `supabase.cmd migration list --local` -> PASS, local/remote sampai `0036` sinkron.
- `supabase.cmd db lint --local` -> PASS tanpa schema error/warning.
- `npm.cmd run test:security` -> PASS, transfer positive/negative, history invariant, dan privilege
  denial lulus dalam transaksi rollback.
- `npm.cmd run typecheck` -> PASS.
- `npm.cmd run lint` -> PASS tanpa warning/error.
- `npm.cmd test -- --run` -> PASS, 3 file dan 19 test.
- `npm.cmd run build` -> PASS, endpoint transfer terkompilasi.

Catatan risiko:

- Transfer saat ini hanya admin, sesuai flow UI existing. Delegasi manager memerlukan permission
  khusus dan policy/RPC actor model terpisah.
- Effective timestamp masih dikirim client; server menolak timestamp lebih dari satu menit di masa
  depan, tetapi deployment production tetap harus memakai sinkronisasi waktu.

Step berikutnya: M3.3.

### M3.3 - Mentoring Session Atomic

Status: `COMPLETE`

Agent: Codex

Mulai: 2026-08-09 16:23 WIB

Selesai: 2026-08-09 16:25 WIB

Commit hasil: `NOT_COMMITTED`

Implementasi:

- Migrasi `0037_atomic_mentoring_session.sql` menambahkan RPC
  `create_mentoring_session_atomic` service-role-only.
- RPC memvalidasi actor aktif/permission mentoring, outlet dan branch aktif, tanggal tidak future,
  batas catatan, duplicate cashier note, cashier aktif, dan kecocokan cashier dengan outlet.
- Seluruh validasi dilakukan sebelum insert; session dan semua `mentoring_cashier_note` kemudian
  dibuat dalam satu transaksi.
- POST mentoring dipindahkan dari dua insert client menjadi satu RPC admin client.
- Migrasi `0038_mentoring_uuid_validation.sql` memperbaiki regex UUID agar sesuai dengan tipe UUID
  PostgreSQL tanpa membatasi nibble version internal.
- GET mentoring tetap memakai client session, cursor pagination, branch scope, dan filter existing.

Acceptance evidence:

- Manager A berhasil membuat session dan note cashier pada outlet branch A.
- Duplicate note, cashier lintas outlet, cashier inactive, dan tanggal future ditolak.
- Session duplicate tidak tersisa setelah error validasi.
- RPC tidak executable oleh `anon` atau `authenticated`.
- Batas note outlet/cashier maksimal 2000 karakter dipaksa pada route dan RPC.

File dan migrasi:

- `supabase/migrations/0037_atomic_mentoring_session.sql`
- `supabase/migrations/0038_mentoring_uuid_validation.sql`
- `supabase/tests/security_regression.sql`
- `src/app/api/mentoring-sessions/route.ts`

Test gate:

- `supabase.cmd migration up --local` -> PASS, migrasi `0037` dan `0038` diterapkan.
- `supabase.cmd migration list --local` -> PASS, local/remote sampai `0038` sinkron.
- `supabase.cmd db lint --local` -> PASS tanpa schema error/warning.
- `npm.cmd run test:security` -> PASS, mentoring positive/negative, duplicate rollback, inactive
  cashier, future date, dan privilege denial lulus dalam transaksi rollback.
- `npm.cmd run typecheck` -> PASS.
- `npm.cmd run lint` -> PASS tanpa warning/error.
- `npm.cmd test -- --run` -> PASS, 3 file dan 19 test.
- `npm.cmd run build` -> PASS, endpoint mentoring terkompilasi.

Catatan risiko:

- RPC memakai `jsonb` agar seluruh note tetap berada dalam satu transaksi; generated database types
  pada baseline lama masih longgar (`Database = any`). Temuan ini sudah ditutup pada M8.4 dengan
  generated schema dan regression guard `test:types`.
- GET mentoring belum memiliki response envelope khusus untuk pagination di luar wrapper umum; bentuk
  `{ sessions, nextCursor, hasMore }` dipertahankan untuk kompatibilitas client.

Step berikutnya: M3.4.

### M3.4 - Avatar Replacement Aman

Status: `COMPLETE`

Agent: Codex

Mulai: 2026-08-09 16:26 WIB

Selesai: 2026-08-09 16:30 WIB

Commit hasil: `NOT_COMMITTED`

Implementasi:

- `sharp` menjadi dependency produksi langsung untuk decode dan validasi gambar di server.
- Validator memeriksa batas 2 MB, extension, MIME, magic bytes, format hasil decode, serta dimensi
  maksimum 4096x4096 sebelum Storage menerima file.
- Migrasi `0039_avatar_bucket_limits.sql` mengunci bucket `cashier-photos` sebagai private, batas
  2 MB, dan MIME `image/jpeg`, `image/png`, `image/webp`.
- Upload memakai object path versioned `cashier/{cashierId}/avatar-{uuid}.{ext}` dengan `upsert:false`.
  Database diperbarui lebih dahulu; object lama dihapus setelah update berhasil.
- Jika update database gagal, object baru langsung dihapus sebagai compensating cleanup. Cleanup
  object lama bersifat best-effort dan dicatat ke server log bila Storage gagal.
- Proxy avatar hanya menerima path cashier avatar lama yang kompatibel atau path versioned UUID,
  sehingga object arbitrary tidak dapat dibaca melalui endpoint.

Acceptance evidence:

- File bytes bukan gambar ditolak walaupun extension/MIME terlihat valid.
- PNG dengan extension atau MIME yang tidak cocok ditolak.
- PNG valid 64x64 diterima dan format/dimensinya terbaca dari decoder.
- Bucket live lokal terverifikasi private, `2097152` bytes, dan allowlist tiga MIME gambar.
- Existing old avatar path tetap didukung proxy; replacement baru tidak menimpa object lama sebelum
  database berhasil diperbarui.

File dan migrasi:

- `supabase/migrations/0039_avatar_bucket_limits.sql`
- `supabase/tests/security_regression.sql`
- `src/lib/storage/avatar-validation.ts`
- `src/lib/storage/__tests__/avatar-validation.test.ts`
- `src/lib/storage/cashier-avatar.ts`
- `src/app/api/cashiers/[id]/avatar/route.ts`
- `src/app/api/storage/cashier-avatar/route.ts`
- `package.json` dan `package-lock.json`

Test gate:

- `supabase.cmd migration up --local` -> PASS, migrasi `0039` diterapkan.
- `supabase.cmd migration list --local` -> PASS, local/remote sampai `0039` sinkron.
- `supabase.cmd db lint --local` -> PASS, tidak ada schema error/warning.
- `npm.cmd run test:security` -> PASS, privilege RPC, role/branch matrix, dan bucket config lulus
  dalam transaksi rollback.
- `npm.cmd run typecheck` -> PASS.
- `npm.cmd run lint` -> PASS tanpa warning/error.
- `npm.cmd test -- --run` -> PASS, 4 file dan 22 test.
- `npm.cmd run build` -> PASS, route avatar dan proxy terkompilasi pada Next 16.3.0.
- `git diff --check` -> PASS.

Catatan risiko:

- Cleanup object lama dilakukan setelah DB sukses dan best-effort; kegagalan Storage dicatat namun
  tidak membatalkan response sukses. Monitoring Storage orphan perlu ditambahkan pada hardening lanjutan.
- Batas dan MIME bucket sudah diterapkan lokal melalui migrasi; konfigurasi target production wajib
  diverifikasi setelah migrasi production dijalankan.
- Validasi decoder membatasi dimensi, tetapi tidak melakukan face detection atau normalisasi orientasi;
  crop dari client tetap menjadi tanggung jawab UI existing.

Step berikutnya: M3.5.

### M3.5 - Cashier Lifecycle

Status: `COMPLETE`

Agent: Codex

Mulai: 2026-08-09 16:31 WIB

Selesai: 2026-08-09 16:39 WIB

Commit hasil: `NOT_COMMITTED`

Implementasi:

- Migrasi `0040_cashier_lifecycle.sql` menambahkan `cashier_status_history` dengan status, alasan,
  effective timestamp, actor, dan index histori. Data legacy inactive yang masih memiliki placement
  terbuka dinormalisasi lebih dulu.
- RPC `set_cashier_status_atomic` hanya executable `service_role`, memvalidasi actor admin aktif,
  alasan, effective timestamp, transisi status, outlet/cabang aktif saat reaktivasi, lalu mengubah
  status dan placement dalam satu transaksi. Deaktivasi menutup placement aktif; reaktivasi membuat
  placement baru pada outlet terakhir.
- RPC `set_outlet_status_guarded` dan `set_branch_status_guarded` mencegah parent dinonaktifkan ketika
  masih memiliki kasir aktif, memvalidasi reaktivasi outlet pada cabang aktif, dan mencatat audit log.
- Route branch/outlet status kini memanggil RPC service-role setelah admin guard. Direct authenticated
  update untuk kolom status branch dibatasi; perubahan nama/kode tetap memakai kolom yang diizinkan.
- Endpoint `PATCH /api/cashiers/[id]/status` ditambahkan. DELETE lama tetap kompatibel tetapi sekarang
  juga memakai lifecycle RPC dengan alasan fallback.
- RLS `user_can_view_cashier` memberi admin akses audit ke kasir nonaktif, sedangkan manager/supervisor
  hanya melihat kasir aktif pada cabang aktif. Storage foto mengikuti aturan yang sama melalui migrasi
  `0041_harden_inactive_cashier_storage.sql`.
- Halaman daftar kasir admin mendukung filter Aktif/Nonaktif/Semua. Profil admin menampilkan riwayat
  status, dan badge status mendukung konfirmasi nonaktif/reactivasi dengan alasan wajib.

Acceptance evidence:

- Deaktivasi kasir mencatat reason/actor/effective date, menutup tepat satu placement aktif, dan tidak
  meninggalkan placement aktif.
- Effective date sebelum aktivitas placement terakhir ditolak.
- Admin dapat membaca kasir nonaktif dan history untuk audit; manager tidak dapat melihat kasir nonaktif.
- Manager tidak dapat memanggil lifecycle RPC atau mengubah status melalui direct table update.
- Outlet/cabang dengan kasir aktif ditolak untuk dinonaktifkan. Setelah seluruh kasir nonaktif, parent
  dapat dinonaktifkan; reaktivasi berurutan branch -> outlet -> cashier berhasil.
- Reaktivasi kasir menambahkan placement aktif baru dan history status baru.

File dan migrasi:

- `supabase/migrations/0040_cashier_lifecycle.sql`
- `supabase/migrations/0041_harden_inactive_cashier_storage.sql`
- `supabase/tests/security_regression.sql`
- `src/app/api/cashiers/[id]/status/route.ts`
- `src/app/api/cashiers/[id]/route.ts`
- `src/app/api/branches/[id]/route.ts`
- `src/app/api/outlets/[id]/route.ts`
- `src/components/cashiers/CashierStatusButton.tsx`
- `src/app/(app)/cashiers/page.tsx`
- `src/app/(app)/cashiers/[id]/page.tsx`

Test gate:

- `supabase.cmd migration up --local` -> PASS, migrasi `0040` dan `0041` diterapkan.
- `supabase.cmd migration list --local` -> PASS, local/remote sampai `0041` sinkron.
- `supabase.cmd db lint --local` -> PASS, tidak ada schema error/warning.
- `npm.cmd run test:security` -> PASS, lifecycle transition, parent guards, admin/non-admin visibility,
  direct update denial, dan service-role privilege lulus dalam transaksi rollback.
- `npm.cmd run typecheck` -> PASS.
- `npm.cmd run lint` -> PASS tanpa warning/error.
- `npm.cmd test -- --run` -> PASS, 4 file dan 22 test.
- `npm.cmd run build` -> PASS, endpoint status baru dan filter halaman terkompilasi.
- `git diff --check` -> PASS.

Catatan risiko:

- Parent branch/outlet belum memiliki UI reaktivasi khusus; API status guard sudah tersedia dan urutan
  reaktivasi diwajibkan oleh database.
- Status history parent dicatat di `audit_log`, sementara status history cashier memiliki tabel khusus.
- Filter admin saat ini memakai query string server-rendered, belum cursor pagination untuk jumlah data
  sangat besar; optimasi daftar kasir menjadi pekerjaan lanjutan.

Step berikutnya: M4.1.

## 11. Milestone M4 - Integritas Scoring Dan Periode

### M4.1 - Perbaiki Validasi Konfigurasi

Status: `COMPLETE`

Agent: Codex

Mulai: 2026-08-09 16:41 WIB

Selesai: 2026-08-09 16:45 WIB

Commit hasil: `NOT_COMMITTED`

Implementasi:

- Migrasi `0042_category_configuration_validation.sql` menambahkan constraint nama category/detail,
  RPC config service-role-only, dan revoke direct insert/update/delete authenticated.
- `admin_create_category` menghitung proposed total setelah category baru masuk di bawah advisory
  transaction lock. `admin_update_category` menghitung total setelah perubahan name/weight/status.
- `admin_create_detail` memvalidasi parent category aktif, nama, tipe enum, serta hanya menerima
  parameter scale atau deduction yang sesuai dan positif.
- Route category/detail memakai admin client dan RPC, sehingga guard admin, validasi bisnis, dan write
  berada di server boundary yang sama. Validasi angka route juga menolak nilai non-finite.
- `open_period` forward-only memvalidasi total bobot active category tepat 100 dan minimal satu detail
  aktif sebelum menutup periode lama atau membuat periode baru. Snapshot hanya dibuat setelah preflight.

Acceptance evidence:

- Create category menguji total sesudah insert; overflow ditolak.
- Update name mempertahankan konfigurasi valid; invalid scale tanpa `scale_max` ditolak.
- Open period dengan total category 99 ditolak sebelum periode baru dibuat.
- Admin authenticated tidak dapat menulis category/detail langsung; hanya RPC service-role yang memiliki
  execute privilege.
- Existing positive create category (75 + 25), detail, and open-period precondition regression lulus
  pada fixture deterministic yang mengisolasi data development lokal.

File dan migrasi:

- `supabase/migrations/0042_category_configuration_validation.sql`
- `supabase/tests/security_regression.sql`
- `src/app/api/categories/route.ts`
- `src/app/api/categories/[id]/route.ts`
- `src/app/api/categories/[id]/details/route.ts`

Test gate:

- `supabase.cmd migration up --local` -> PASS, migrasi `0042` diterapkan.
- `supabase.cmd migration list --local` -> PASS, local/remote sampai `0042` sinkron.
- `supabase.cmd db lint --local` -> PASS, tidak ada schema error/warning.
- `npm.cmd run test:security` -> PASS, privilege config RPC, proposed total, detail validation,
  open-period precondition, dan direct-write denial lulus dalam transaksi rollback.
- `npm.cmd run typecheck` -> PASS.
- `npm.cmd run lint` -> PASS tanpa warning/error.
- `npm.cmd test -- --run` -> PASS, 4 file dan 22 test.
- `npm.cmd run build` -> PASS, seluruh route category/detail dan period terkompilasi.
- `git diff --check` -> PASS.

Catatan risiko:

- Setiap mutasi category saat ini wajib menghasilkan total active weight tepat 100; workflow bulk
  rebalancing belum tersedia dan sebaiknya menjadi UI transaction/batch pada hardening konfigurasi.
- M4.2 memastikan fungsi rekalkulasi dan validasi assessment tidak membaca konfigurasi live untuk
  periode yang sudah memiliki snapshot.

Step berikutnya: M4.2.

### M4.2 - Snapshot Config Sebagai Sumber Periode

Status: `COMPLETE`

Agent: Codex

Mulai: 2026-08-09 16:48 WIB

Selesai: 2026-08-09 16:53 WIB

Commit hasil: `NOT_COMMITTED`

Implementasi:

- Migrasi `0043_period_snapshot_source.sql` menambah metadata snapshot category/detail: nama,
  category parent, dan tipe detail; data legacy di-backfill dari konfigurasi live hanya sekali saat
  migrasi.
- `get_category_weight` dan `get_detail_config` sekarang hanya membaca history periode tanpa fallback
  ke category/detail live.
- `recalculate_cashier_period_score` membaca bobot, nama, parent, dan detail assessment dari snapshot
  periode sehingga rename, perubahan bobot, perubahan tipe, dan perubahan parameter live tidak
  memengaruhi periode yang sudah dibuka.
- Route assessment skala dan deduction mengambil konfigurasi dari `detail_config_history` dan menolak
  detail yang tidak termasuk snapshot periode.
- Policy assessment/deduction menerima detail yang aktif saat snapshot dibuat meskipun detail live
  kemudian dinonaktifkan; detail baru di luar snapshot tetap ditolak.
- `open_period` menyimpan seluruh metadata snapshot forward-only setelah configuration preflight.
- Kontrak tipe `CategoryWeightHistory`, `DetailConfigHistory`, dan `CashierStatusHistory` diperbarui;
  Developer Guide menjelaskan source of truth snapshot.

Acceptance evidence:

- Setelah category/detail live diubah, rekalkulasi tetap menghasilkan nama dan bobot snapshot lama.
- `get_detail_config` tetap mengembalikan `scale_max` snapshot lama setelah konfigurasi live berubah.
- Assessment pada detail snapshot yang kini inactive tetap dapat diperbarui pada periode yang sama.
- Assessment untuk detail yang tidak ada pada snapshot ditolak oleh policy.
- Regression fixture deterministic di-rollback dan tidak mengubah data lokal permanen.

File dan migrasi:

- `supabase/migrations/0043_period_snapshot_source.sql`
- `supabase/tests/security_regression.sql`
- `src/app/api/assessments/route.ts`
- `src/app/api/assessments/[id]/deductions/route.ts`
- `src/types/database.ts`
- `docs/DEVELOPER_GUIDE.md`

Test gate:

- `supabase.cmd migration up --local` -> PASS, migrasi `0043` diterapkan.
- `supabase.cmd migration list --local` -> PASS, local/remote sampai `0043` sinkron.
- `supabase.cmd db lint --local` -> PASS, tidak ada schema error/warning.
- `npm.cmd run test:security` -> PASS, snapshot source, immutable config, assessment snapshot,
  detail di luar snapshot, dan seluruh regression security lulus dalam transaksi rollback.
- `npm.cmd run typecheck` -> PASS.
- `npm.cmd run lint` -> PASS tanpa warning/error.
- `npm.cmd test -- --run` -> PASS, 4 file dan 22 test.
- `npm.cmd run build` -> PASS, seluruh route assessment dan status terkompilasi.
- `git diff --check` -> PASS.

Catatan risiko:

- Periode lama yang belum menyimpan nama/type snapshot hanya dapat di-backfill dari konfigurasi live
  pada saat migrasi `0043`; periode baru menyimpan metadata lengkap saat `open_period`.
- Fallback kategori tanpa assessment masih 100 untuk kompatibilitas perilaku lama; keputusan ini
  sengaja dipindahkan ke M4.3 agar dapat diganti bersama completion state dan UI/cron.

Step berikutnya: M4.3.

### M4.3 - Completion Model

Status: `COMPLETE`

Agent: Codex

Mulai: 2026-08-09 16:54 WIB

Selesai: 2026-08-09 17:02 WIB

Commit hasil: `NOT_COMMITTED`

Implementasi:

- Migrasi `0044_cashier_period_completion.sql` menambah tabel completion per cashier-period dengan
  status `not_started`, `in_progress`, atau `complete`, jumlah detail snapshot, timestamp selesai,
  index period/status, RLS branch-scoped, dan write service-role-only.
- Completion di-backfill untuk periode open dan dibuat ketika periode baru dibuka untuk kasir aktif.
- Rekalkulasi kini menghitung completion dari jumlah detail snapshot versus assessment yang ada.
  Detail yang belum dinilai berkontribusi 0 pada skor sementara sehingga tidak mendapat full credit.
- Migrasi `0045_completion_partial_score.sql` memperbaiki skor kategori partial dengan denominator
  seluruh detail snapshot, tanpa mengubah migrasi yang telah diterapkan sebelumnya.
- Halaman daftar/detail penilaian membaca snapshot config dan menampilkan status completion.
- Dashboard menghitung kasir selesai dari completion; cron reminder mengingatkan status partial maupun
  belum mulai, bukan hanya kasir tanpa baris assessment.
- Kontrak tipe `CompletionStatus` dan `CashierPeriodCompletion` serta Developer Guide diperbarui.

Acceptance evidence:

- Cashier-period tanpa assessment menghasilkan `not_started` dan skor 0.
- Satu dari dua detail menghasilkan `in_progress`, 1/2, dan skor di bawah full credit.
- Seluruh dua detail menghasilkan `complete`, 2/2, dan `completed_at` terisi.
- Manager hanya dapat melihat completion untuk cabang yang ditugaskan dan tidak dapat menulis langsung.
- Form assessment tetap menampilkan detail yang berasal dari snapshot walaupun detail live berubah.
- Regression fixture deterministic di-rollback dan tidak mengubah data lokal permanen.

File dan migrasi:

- `supabase/migrations/0044_cashier_period_completion.sql`
- `supabase/migrations/0045_completion_partial_score.sql`
- `supabase/tests/security_regression.sql`
- `src/app/(app)/assessment/page.tsx`
- `src/app/(app)/assessment/[cashierId]/page.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/api/cron/notifications/route.ts`
- `src/types/database.ts`
- `docs/DEVELOPER_GUIDE.md`

Test gate:

- `supabase.cmd migration up --local` -> PASS, migrasi `0044` dan `0045` diterapkan.
- `supabase.cmd migration list --local` -> PASS, local/remote sampai `0045` sinkron.
- `supabase.cmd db lint --local` -> PASS, tidak ada schema error/warning.
- `npm.cmd run test:security` -> PASS, status completion, partial score, branch isolation, dan direct
  write denial lulus dalam transaksi rollback.
- `npm.cmd run typecheck` -> PASS.
- `npm.cmd run lint` -> PASS tanpa warning/error.
- `npm.cmd test -- --run` -> PASS, 4 file dan 22 test.
- `npm.cmd run build` -> PASS, halaman assessment/dashboard dan cron terkompilasi.
- `git diff --check` -> PASS.

Catatan risiko:

- Kasir baru yang dibuat setelah periode dibuka belum otomatis masuk completion sampai roster periode
  diperkenalkan; itu menjadi ruang lingkup M4.4.
- Close period masih mengizinkan data incomplete dan akan memakai skor sementara; preflight penutupan
  yang eksplisit menjadi ruang lingkup M4.5.

### M4.4 - Period Roster Dan Historical Placement

Status: `COMPLETE`

Agent: Codex

Mulai: 2026-08-09 17:04 WIB

Selesai: 2026-08-09 17:08 WIB

Commit hasil: `NOT_COMMITTED`

Keputusan kebijakan:

- Roster menyimpan placement pada saat periode dibuka. Transfer setelah periode dibuka tidak
  memindahkan lokasi historis periode tersebut.
- Kasir yang dibuat saat periode open otomatis dimasukkan ke roster dengan `entry_reason`
  `cashier_created`. Kasir existing yang belum memiliki roster dapat dimasukkan oleh admin melalui
  flow mid-period dengan tanggal eligible dan alasan wajib.
- Close period hanya memproses roster; fallback backfill hanya berlaku untuk periode legacy yang
  belum memiliki roster.

Implementasi:

- Migrasi `0046_period_roster_historical_placement.sql` menambah `cashier_period_roster` dengan
  snapshot cashier/outlet/branch name, IDs, avatar path, tanggal eligible, dan reason.
- RLS roster scope-aware berdasarkan permission leaderboard dan branch; authenticated tidak memiliki
  write policy atau write grant.
- `open_period` membuat roster dan completion untuk seluruh kasir aktif pada outlet/cabang aktif.
- `create_cashier_with_history` membuat roster dan completion pada periode open dalam transaksi yang
  sama dengan cashier serta initial placement.
- RPC `add_cashier_to_period_roster` admin-only memvalidasi periode open, tanggal dalam range, kasir
  aktif, outlet/cabang aktif, duplicate, dan reason; perubahan dicatat ke `period_log`.
- `close_period` merekalkulasi dan menulis `leaderboard_entry` memakai roster snapshot, termasuk nama
  dan avatar path historis. Kolom metadata leaderboard ditambahkan untuk menghindari join placement
  live saat periode tertutup.
- API `POST /api/periods/[id]/roster` serta selector periode leaderboard ditambahkan. Periode closed
  membaca `leaderboard_entry` snapshot, periode open membaca score berjalan.
- Security fixture menguji kasir dipindahkan setelah roster dibuat dan memastikan leaderboard tetap
  memakai outlet lama.

File dan migrasi:

- `supabase/migrations/0046_period_roster_historical_placement.sql`
- `supabase/tests/security_regression.sql`
- `src/app/api/periods/[id]/roster/route.ts`
- `src/app/api/leaderboard/route.ts`
- `src/app/(app)/leaderboard/page.tsx`
- `src/components/leaderboard/LeaderboardView.tsx`
- `src/types/database.ts`
- `docs/DEVELOPER_GUIDE.md`

Test gate:

- `supabase.cmd migration up --local` -> PASS, migrasi `0046` diterapkan.
- `supabase.cmd migration list --local` -> PASS, local/remote sampai `0046` sinkron.
- `supabase.cmd db lint --local` -> PASS, tidak ada schema error/warning.
- `npm.cmd run test:security` -> PASS, privilege RPC roster, duplicate roster, historical transfer,
  closed leaderboard snapshot, dan seluruh regression security lulus dalam transaksi rollback.
- `npm.cmd run typecheck` -> PASS.
- `npm.cmd run lint` -> PASS tanpa warning/error.
- `npm.cmd test -- --run` -> PASS, 4 file dan 22 test.
- `npm.cmd run build` -> PASS, endpoint roster dan selector leaderboard terkompilasi.
- `git diff --check` -> PASS.

Catatan risiko:

- Roster belum menyimpan beberapa placement segment dalam satu periode; kebijakan saat ini sengaja
  memakai placement saat entry/open sebagai lokasi periode.
- UI admin untuk memilih kasir existing dan mengirim mid-period roster belum dibuat; endpoint sudah
  tersedia untuk flow terkontrol dan akan dapat dipasang pada hardening period berikutnya.

### M4.5 - Open/Close Period Preflight

Status: `COMPLETE`

Agent: Codex

Mulai: 2026-08-09 17:10 WIB

Selesai: 2026-08-09 17:16 WIB

Commit awal: `72e6cb3`

Commit hasil: `NOT_COMMITTED`

Keputusan kebijakan:

- Sistem tidak menutup periode lama secara otomatis ketika periode baru dibuka. Penutupan harus
  melewati preflight, dan data incomplete hanya dapat dilewati admin dengan alasan audit.
- Hanya boleh ada satu periode `open`; periode dengan tanggal overlap ditolak. Request open/close
  yang diulang pada periode dan parameter yang sama bersifat idempotent.
- Preview penutupan membaca konfigurasi snapshot dan roster historis, sehingga keputusan close tidak
  bergantung pada konfigurasi atau penempatan live yang berubah setelah periode berjalan.

Implementasi:

- Migrasi `0047_period_preflight_and_override.sql` menambah unique partial index untuk satu periode
  open, validasi tanggal/overlap, RPC preflight, close dengan override terkontrol, dan audit log.
- Migrasi `0048_remove_open_period_lint_warning.sql` menyempurnakan definisi `open_period` tanpa
  mengedit migrasi yang sudah diterapkan dan menghapus warning lint variabel tidak terpakai.
- `GET /api/periods/[id]/preflight` menampilkan validitas konfigurasi, cashier incomplete, dan
  preview ranking untuk admin.
- `POST /api/periods/[id]/close` menerima `overrideIncomplete` serta `overrideReason`; override
  manager ditolak, alasan admin dicatat pada `period_log`, dan close kedua tidak menggandakan hasil.
- Cron rollover menutup periode sebelumnya melalui flow close biasa lalu membuka periode baru hanya
  jika penutupan berhasil. Form admin menjelaskan bahwa periode sebelumnya harus ditutup manual.

File dan migrasi:

- `supabase/migrations/0047_period_preflight_and_override.sql`
- `supabase/migrations/0048_remove_open_period_lint_warning.sql`
- `supabase/tests/security_regression.sql`
- `src/app/api/periods/[id]/close/route.ts`
- `src/app/api/periods/[id]/preflight/route.ts`
- `src/app/api/cron/periods/route.ts`
- `src/components/periods/ClosePeriodButton.tsx`
- `src/components/periods/PeriodForm.tsx`
- `docs/DEVELOPER_GUIDE.md`

Test gate:

- `supabase.cmd db lint --local` -> PASS, tidak ada schema error/warning.
- `supabase.cmd migration list --local` -> PASS, local/remote sampai `0048` sinkron.
- `npm.cmd run test:security` -> PASS, preflight, overlap, incomplete block, admin override,
  audit log, idempotent close, roster, transfer, dan historical snapshot lulus rollback test.
- `npm.cmd run typecheck` -> PASS.
- `npm.cmd run lint` -> PASS tanpa warning/error.
- `npm.cmd test -- --run` -> PASS, 4 file dan 22 test.
- `npm.cmd run build` -> PASS, endpoint preflight/roster dan flow close terkompilasi.
- `git diff --check` -> PASS; warning LF/CRLF Git tidak menunjukkan whitespace error.

Risiko tersisa:

- Cron tidak dapat melewati cashier incomplete tanpa override admin. Jika operasional membutuhkan
  penutupan paksa otomatis, kebijakan dan audit approval terpisah harus disepakati terlebih dahulu.
- Roster saat ini menyimpan satu placement historis per cashier-period; segment placement belum menjadi
  scope produk.

Step berikutnya: M4.6 - Scoring Regression Tests.

### M4.6 - Scoring Regression Tests

Status: `COMPLETE`

Agent: Codex

Mulai: 2026-08-09 17:17 WIB

Selesai: 2026-08-09 17:19 WIB

Commit awal: `72e6cb3`

Commit hasil: `NOT_COMMITTED`

Ringkasan:

- Unit scoring memverifikasi nilai slider desimal 0.1, pembulatan normalisasi, dan deduction floor
  termasuk input pecahan di atas 100.
- Security fixture memverifikasi config snapshot tetap menjadi sumber skor ketika detail live nonaktif
  atau berubah, missing assessment menjadi partial/not started, dan detail di luar snapshot ditolak.
- Lifecycle fixture memverifikasi cashier inactive/placement guard, transfer historis, close kedua
  idempotent tanpa duplicate leaderboard atau period log, serta rank historis berdasarkan snapshot.

File diubah:

- `src/lib/scoring/__tests__/normalize.test.ts`
- `supabase/tests/security_regression.sql`
- `docs/AI_REMEDIATION_ROADMAP.md`

Migrasi: `NONE`

Test gate:

- `npm.cmd test -- --run` -> PASS, 4 file dan 23 test.
- `npm.cmd run test:security` -> PASS, fixture RLS/RPC/scoring rollback lulus.
- `npm.cmd run typecheck` -> PASS.
- `npm.cmd run lint` -> PASS tanpa warning/error.
- `npm.cmd run build` -> PASS.
- `supabase.cmd db lint --local` -> PASS, tidak ada schema error/warning.
- `supabase.cmd migration list --local` -> PASS, local/remote sampai `0048` sinkron.
- `git diff --check` -> PASS; warning LF/CRLF Git tidak menunjukkan whitespace error.

Bukti keamanan/integritas: test negatif role/cabang, inactive cashier, detail di luar snapshot,
incomplete close, manager override, duplicate close, transfer, dan historical rank lulus dalam
transaksi yang di-rollback.

Risiko tersisa: belum ada browser E2E untuk menguji slider dan leaderboard secara visual; cakupan
concurrency production masih menjadi bagian M6/M8.

Step berikutnya: M5.1 - Leaderboard Periode Yang Benar.

## 12. Milestone M5 - Leaderboard Dan Dashboard

### M5.1 - Leaderboard Periode Yang Benar

Status: `COMPLETE`

Agent: Codex

Mulai: 2026-08-09 17:20 WIB

Selesai: 2026-08-09 17:23 WIB

Commit awal: `72e6cb3`

Commit hasil: `NOT_COMMITTED`

Keputusan:

- Query invalid ditolak di server dengan Zod; empty optional UUID diperlakukan sebagai tidak ada,
  bukan diteruskan ke database.
- Filter global/branch/outlet memiliki kontrak eksplisit. Outlet wajib berada pada branch yang dapat
  diakses user dan mismatch branch/outlet ditolak sebelum query leaderboard.
- Periode tertutup memakai `rank_global`, `rank_branch`, dan `rank_outlet` dari snapshot. Periode open
  dan cumulative menghitung rank dari result set saat ini.

Implementasi:

- `GET /api/leaderboard` memvalidasi `level`, `mode`, `periodId`, `branchId`, dan `outletId`; periode
  yang tidak ada mengembalikan 404, unauthorized branch/outlet mengembalikan 403, dan filter yang
  tidak sesuai level mengembalikan 400.
- Snapshot leaderboard tertutup sekarang memilih rank historis sesuai level, bukan menghitung ulang
  dari placement live atau subset request.
- `LeaderboardView` memakai `AbortController` per filter state sehingga request lama tidak dapat
  menimpa period/filter terbaru; abort tidak memicu error toast atau mematikan loading request baru.
- Error payload object `{ error: { message } }` dan format string lama sama-sama ditampilkan aman.
- Key list UI menyertakan `periodId` dan cashier ID untuk menjaga identitas row lintas periode.

File diubah:

- `src/app/api/leaderboard/route.ts`
- `src/components/leaderboard/LeaderboardView.tsx`
- `docs/DEVELOPER_GUIDE.md`

Migrasi: `NONE`

Test gate:

- `npm.cmd run typecheck` -> PASS.
- `npm.cmd run lint` -> PASS tanpa warning/error.
- `npm.cmd test -- --run` -> PASS, 4 file dan 23 test.
- `npm.cmd run test:security` -> PASS, role/branch/RPC/closed snapshot regression lulus.
- `npm.cmd run build` -> PASS, API leaderboard dan halaman selector terkompilasi.
- `supabase.cmd db lint --local` -> PASS, tidak ada schema error/warning.
- `supabase.cmd migration list --local` -> PASS, local/remote sampai `0048` sinkron.
- `git diff --check` -> PASS; warning LF/CRLF Git tidak menunjukkan whitespace error.

Risiko tersisa: belum ada browser E2E yang benar-benar mensimulasikan dua response leaderboard selesai
berurutan; AbortController sudah mencegah stale state pada client. Pagination server menjadi scope M5.2.

Step berikutnya: M5.2 - Ranking, Filter, Dan Pagination.

### M5.2 - Ranking, Filter, Dan Pagination

Status: `COMPLETE`

Agent: Codex

Mulai: 2026-08-09 17:24 WIB

Selesai: 2026-08-09 17:28 WIB

Commit awal: `72e6cb3`

Commit hasil: `NOT_COMMITTED`

Keputusan:

- Pagination JSON menggunakan cursor keyset berdasarkan `(score DESC, cashier_id ASC)`; cursor
  membawa rank offset sehingga rank live/cumulative tetap berlanjut pada halaman berikutnya.
- Limit halaman JSON dibatasi 100, default 25. Export CSV adalah operasi eksplisit dengan hard cap
  5000 row dan tetap menerapkan period/level/branch/outlet/search scope.
- Rank periode closed tetap memakai snapshot historis; rank open/cumulative dihitung pada result set
  filter yang sedang ditampilkan.

Implementasi:

- `GET /api/leaderboard` menambah `limit`, `cursor`, `search`, dan `format=csv` dengan validasi Zod,
  stable tie-breaker, `nextCursor`, `hasMore`, server-side name search, dan CSV response tanpa signed
  URL.
- `LeaderboardView` menampilkan search, reset filter, export CSV, dan load-more page; tidak lagi
  memanggil `rows.slice(0, 100)` atau menerima seluruh leaderboard ke browser.
- `src/lib/leaderboard/cursor.ts` memvalidasi dan encode/decode cursor; unit test menolak cursor
  malformed atau UUID tidak valid.
- Migration `0049_leaderboard_keyset_indexes.sql` menambah index komposit period/scope/score/cashier
  dan cumulative score untuk query keyset.

File dan migrasi:

- `src/app/api/leaderboard/route.ts`
- `src/components/leaderboard/LeaderboardView.tsx`
- `src/lib/leaderboard/cursor.ts`
- `src/lib/leaderboard/__tests__/cursor.test.ts`
- `supabase/migrations/0049_leaderboard_keyset_indexes.sql`
- `docs/DEVELOPER_GUIDE.md`

Test gate:

- `supabase.cmd migration up --local` -> PASS, migration `0049` diterapkan.
- `npm.cmd test -- --run` -> PASS, 5 file dan 25 test.
- `npm.cmd run test:security` -> PASS, branch/RLS/RPC/closed snapshot regression lulus.
- `npm.cmd run typecheck` -> PASS.
- `npm.cmd run lint` -> PASS tanpa warning/error.
- `npm.cmd run build` -> PASS, pagination/filter/export route terkompilasi.
- `supabase.cmd db lint --local` -> PASS, tidak ada schema error/warning.
- `supabase.cmd migration list --local` -> PASS, local/remote sampai `0049` sinkron.
- `git diff --check` -> PASS; warning LF/CRLF Git tidak menunjukkan whitespace error.

Bukti keamanan/integritas: filter branch/outlet tetap dicek terhadap assignment user sebelum query,
cursor UUID/score invalid ditolak, CSV tidak memuat signed URL, dan security fixture rollback lulus.

Risiko tersisa: export dibatasi 5000 row; pencarian `contains` pada nama belum memakai trigram index.
Dashboard role-aware menjadi scope M5.3.

Step berikutnya: M5.3 - Dashboard Role-Aware.

### M5.3 - Dashboard Role-Aware

Status: `COMPLETE`

Agent: Codex

Mulai: 2026-08-09 17:29 WIB

Selesai: 2026-08-09 17:34 WIB

Commit awal: `72e6cb3`

Commit hasil: `NOT_COMMITTED`

Implementasi:

- Dashboard admin menampilkan readiness close, validitas konfigurasi snapshot, kasir aktif,
  completion, invite pending/expired, dan unread notification dengan link ke workflow terkait.
- Dashboard manager menampilkan progres penilaian branch assignment, skor di bawah 70, pendampingan
  30 hari, unread notification, serta daftar top/bottom performer.
- Dashboard supervisor menampilkan cashier incomplete, pendampingan 30 hari, dan tindakan dari
  notification center sesuai permission.
- Query selalu memakai branch assignment dan role permission. Query error dicatat sebagai state error
  banner; metric gagal menampilkan `Tidak tersedia`, bukan angka nol yang menyesatkan.
- State no active period dan empty score/mentoring memiliki pesan yang berbeda; link action tetap
  menuju halaman yang scope-aware.

File diubah:

- `src/app/(app)/dashboard/page.tsx`
- `docs/DEVELOPER_GUIDE.md`

Migrasi: `NONE`

Test gate:

- `npm.cmd test -- --run` -> PASS, 5 file dan 25 test.
- `npm.cmd run test:security` -> PASS, role/branch/RLS/RPC regression lulus.
- `npm.cmd run typecheck` -> PASS.
- `npm.cmd run lint` -> PASS tanpa warning/error.
- `npm.cmd run build` -> PASS, dashboard role-aware terkompilasi.
- `supabase.cmd db lint --local` -> PASS, tidak ada schema error/warning.
- `supabase.cmd migration list --local` -> PASS, local/remote sampai `0049` sinkron.
- `git diff --check` -> PASS; warning LF/CRLF Git tidak menunjukkan whitespace error.

Bukti keamanan/integritas: metric query manager/supervisor menggunakan branch assignment, admin
memiliki cakupan global, permission menentukan action/link, dan nilai error tidak diubah menjadi 0.

Risiko tersisa: tidak ada browser E2E untuk visual role matrix; health cron invocation dan notification
dedupe menjadi scope M6.1/M6.2.

Step berikutnya: M6.1 - Cron Aman Dan Idempotent.

## 13. Milestone M6 - API, Cron, Performa, Dan Observability

### M6.1 - Cron Aman Dan Idempotent

Status: `COMPLETE`

Agent: Codex

Mulai: 2026-08-09 17:35 WIB

- Gunakan POST dan secret hanya melalui header.
- Tolak secret kosong; korelasikan invocation ID pada response dan log.
- Tambahkan dedupe key/unique constraint per recipient, type, entity, dan period.
- Urutkan score history berdasarkan tanggal period, bukan UUID.
- Recipient harus active, mempunyai permission notifications, dan berada pada branch terkait.

Implementasi selesai pada M6.1:

- `src/lib/cron/auth.ts` memvalidasi secret header dengan perbandingan constant-time, membuat
  invocation ID yang bounded, dan menolak konfigurasi/supplied secret kosong.
- `/api/cron/periods` dan `/api/cron/notifications` sekarang POST-only tanpa query secret,
  mengembalikan invocation ID, serta mencatat start/success/failure.
- Migrasi `0050_notification_dedupe.sql` dan `0051_notification_dedupe_constraint.sql` menambah
  metadata entity/period serta constraint unik `notification.dedupe_key`; notification cron memakai
  insert idempotent `ON CONFLICT DO NOTHING`.
- Recipient notification dibatasi pada user aktif dengan permission `notifications`; manager dan
  supervisor dibatasi assignment branch, sedangkan admin mendapat cakupan global.
- Low-score history diurutkan berdasarkan `period.start_date`.

Test gate:

- `supabase.cmd migration up --local` -> PASS, migrasi `0050` dan `0051` diterapkan.
- `npm.cmd test -- --run` -> PASS, 6 file dan 27 test termasuk cron auth.
- `npm.cmd run test:security` -> PASS, termasuk regression unique notification dedupe.
- `npm.cmd run typecheck` -> PASS.
- `npm.cmd run lint` -> PASS tanpa warning/error.
- `npm.cmd run build` -> PASS, seluruh route cron terkompilasi.
- `supabase.cmd db lint --local` -> PASS tanpa schema error/warning.
- `supabase.cmd migration list --local` -> PASS, local/remote sampai `0051` sinkron.
- `git diff --check` -> PASS; warning LF/CRLF Git tidak menunjukkan whitespace error.

Bukti keamanan/integritas: secret di query string ditolak, secret kosong ditolak, secret header
valid diterima, duplicate `dedupe_key` tidak membuat row kedua, dan recipient lintas branch tidak
dipilih oleh notification cron.

Risiko tersisa: belum ada tabel invocation durable atau rate limit terdistribusi; retry dijaga oleh
dedupe key dan observability lanjutan menjadi scope M6.4.

Selesai: 2026-08-09 17:38 WIB

### M6.2 - Notification Center

Status: `COMPLETE`

Agent: Codex

Mulai: 2026-08-09 17:39 WIB

- Tambahkan unread count di header, pagination, mark-all-read, retry, dan deep-link payload.
- Optimistic update hanya commit jika API berhasil atau rollback jika gagal.
- Card interaktif harus dapat digunakan dengan keyboard.

Implementasi selesai pada M6.2:

- `GET /api/notifications` sekarang memakai cursor keyset `(created_at desc, id desc)`, limit
  1-100, `nextCursor`, `hasMore`, dan unread count; query tetap user-scoped.
- `POST /api/notifications/read-all` melakukan update atomik hanya untuk notification milik user
  aktif. PATCH item memvalidasi UUID dan tidak membocorkan row user lain.
- Header menampilkan unread badge dan menerima update count setelah mark-read/mark-all tanpa
  memuat seluruh feed. Halaman memiliki skeleton, empty state, retry, load-more, dan error state.
- Deep-link hanya dibentuk dari `entity_type`/UUID yang tervalidasi ke route internal assessment,
  cashier, atau outlet. Payload tidak dipakai sebagai arbitrary redirect.
- Migration `0052_notification_feed_index.sql` menambahkan index `(user_id, created_at desc, id desc)`.

Test gate:

- `supabase.cmd migration up --local` -> PASS, migration `0052` diterapkan.
- `npm.cmd test -- --run` -> PASS, 7 file dan 29 test termasuk notification cursor.
- `npm.cmd run test:security` -> PASS, notification RLS own-row select/update dan dedupe lulus.
- `npm.cmd run typecheck` -> PASS.
- `npm.cmd run lint` -> PASS tanpa warning/error.
- `npm.cmd run build` -> PASS, route notifications/read-all terkompilasi.
- `supabase.cmd db lint --local` -> PASS tanpa schema error/warning.
- `supabase.cmd migration list --local` -> PASS, local/remote sampai `0052` sinkron.
- `git diff --check` -> PASS; warning LF/CRLF Git tidak menunjukkan whitespace error.

Bukti keamanan/integritas: API dan RLS membatasi data ke `user_id` session, mark-all memakai satu
statement update, deep-link menolak ID non-UUID, dan kegagalan API tidak mengubah state baca.

Risiko tersisa: belum ada browser E2E untuk verifikasi badge dan keyboard pada semua viewport; feed
dan error contract menjadi input M8.

Selesai: 2026-08-09 17:43 WIB

### M6.3 - Pagination Dan Search

Status: `COMPLETE`

Agent: Codex

Mulai: 2026-08-09 17:44 WIB

- Tambahkan pagination/filter server untuk cashier, users, invites, branches/outlets, dan history.
- Gunakan cursor untuk feed yang berubah dan offset hanya untuk data admin yang stabil.
- Signing avatar dilakukan hanya untuk row pada page aktif.

Implementasi selesai pada M6.3:

- Cashier, branch, user, branch detail/outlet, dan outlet detail/cashier sekarang memakai page
  bounded dengan search server-side; query tidak lagi mengambil seluruh list.
- API GET cashier/branch/outlet memvalidasi `limit`, `page`, UUID scope, dan filter wildcard; response
  mengembalikan `page`, `limit`, `total`, dan `hasMore`.
- Invite, mentoring, leaderboard, dan notification mempertahankan cursor untuk feed yang berubah.
- `PaginationControls` mempertahankan query filter; signed avatar hanya dibuat dari cashier page aktif.
- Helper `src/lib/pagination.ts` dan migration `0053_list_pagination_indexes.sql` menstandardisasi
  range serta index ordering/scope.

Test gate:

- `supabase.cmd migration up --local` -> PASS, migration `0053` diterapkan.
- `npm.cmd test -- --run` -> PASS, 8 file dan 31 test termasuk helper pagination.
- `npm.cmd run test:security` -> PASS, role/branch/RLS regression lulus.
- `npm.cmd run typecheck` -> PASS.
- `npm.cmd run lint` -> PASS tanpa warning/error.
- `npm.cmd run build` -> PASS, page/API pagination terkompilasi.
- `supabase.cmd db lint --local` -> PASS tanpa schema error/warning.
- `supabase.cmd migration list --local` -> PASS, local/remote sampai `0053` sinkron.
- `git diff --check` -> PASS; warning LF/CRLF Git tidak menunjukkan whitespace error.

Bukti performa/integritas: semua list memiliki bound page/range, wildcard filter di-escape, scope
role tetap diterapkan sebelum response, dan signed URL tidak dibuat untuk row di luar page aktif.

Risiko tersisa: history placement/status di halaman detail cashier masih bounded berdasarkan kebutuhan
detail dan belum memiliki feed cursor terpisah; mentoring history sudah cursor-based dan M8 akan
menambah E2E untuk page/filter.

Selesai: 2026-08-09 17:51 WIB

### M6.4 - Error, Logging, Dan Security Headers

Status: `COMPLETE`

Agent: Codex

Mulai: 2026-08-09 17:52 WIB

- Standardisasi `{ error: { code, message, requestId } }`.
- Log detail server-side, tampilkan pesan aman ke user.
- Tambahkan CSP, frame-ancestors, nosniff, Referrer-Policy, dan Permissions-Policy.
- Tambahkan rate limit setup, invite accept, upload, dan endpoint sensitif.
- Integrasikan error monitoring tanpa mengirim PII/token.

Implementasi selesai pada M6.4:

- `withApiRoute` menormalkan error string/nested menjadi `{ code, message, requestId }`, menyaring
  pesan teknis, membatasi karakter request/invocation ID, dan mempertahankan `invocationId` cron.
- `next.config.mjs` memasang CSP, frame-ancestors, nosniff, X-Frame-Options, Referrer-Policy,
  Permissions-Policy, dan X-Permitted-Cross-Domain-Policies.
- `src/lib/security/rate-limit.ts` menambahkan limiter best-effort per process pada setup, invite
  accept/create, dan upload avatar dengan `Retry-After`; client form membaca nested error aman.

Test gate:

- `node.exe -e ...next.config.mjs...` -> PASS, seluruh security header terdaftar dan CSP terbentuk.
- `npm.cmd test -- --run` -> PASS, 9 file dan 33 test termasuk rate limit.
- `npm.cmd run test:security` -> PASS, seluruh role/branch/RLS/RPC regression.
- `npm.cmd run typecheck` -> PASS.
- `npm.cmd run lint` -> PASS tanpa warning/error.
- `npm.cmd run build` -> PASS, seluruh route dan konfigurasi Next terkompilasi.
- `supabase.cmd db lint --local` -> PASS tanpa schema error/warning.
- `supabase.cmd migration list --local` -> PASS, local/remote sampai `0053` sinkron.
- `git diff --check` -> PASS; warning LF/CRLF Git tidak menunjukkan whitespace error.

Bukti keamanan/integritas: rate limit menolak request setelah quota, ID header tidak menerima karakter
control, error Postgres/Supabase tidak diteruskan ke client, dan CSP melarang object/frame/form
external. HTTP smoke server tidak dapat dijalankan karena kebijakan eksekusi background process pada
environment; verifikasi runtime production tetap wajib di staging.

Risiko tersisa: limiter in-memory tidak cukup untuk multi-instance; tambahkan edge/distributed rate
limit dan monitoring PII-safe pada deployment. CSP memakai `unsafe-inline` untuk kompatibilitas Next
dan harus dievaluasi kembali saat nonce-based rendering tersedia.

Selesai: 2026-08-09 17:57 WIB

## 14. Milestone M7 - UI, Aksesibilitas, Dan Navigasi

### M7.1 - Form Dan Dialog Accessibility

Status: `COMPLETE`

Agent: Codex

Mulai: 2026-08-09 17:58 WIB

- `Input`, `Select`, dan `Textarea` membuat ID stabil otomatis dengan `useId`.
- Hubungkan error/helper melalui `aria-describedby`.
- Gunakan dialog library teruji atau implementasikan focus trap, Escape, initial/restore focus,
  body scroll lock, dan safe async close.
- Aktifkan browser zoom kembali.

Implementasi selesai pada M7.1:

- `Input`, `Select`, dan `Textarea` memakai `useId` saat caller tidak memberi ID, menghubungkan
  label, `aria-invalid`, dan error melalui `aria-describedby`/`role=alert`.
- `Modal` memiliki `aria-labelledby`, initial focus, focus trap Tab/Shift+Tab, Escape, restore focus,
  body scroll lock, backdrop close, dan dialog focus fallback. Confirm/async dialog tidak dapat ditutup
  Escape saat sedang loading.
- Viewport tidak lagi memblokir browser zoom; preflight period juga menahan close saat async action.

Test gate:

- `npm.cmd test -- --run` -> PASS, 9 file dan 33 test.
- `npm.cmd run test:security` -> PASS.
- `npm.cmd run typecheck` -> PASS.
- `npm.cmd run lint` -> PASS tanpa warning/error.
- `npm.cmd run build` -> PASS, seluruh form/dialog terkompilasi.
- `supabase.cmd db lint --local` -> PASS tanpa schema error/warning.
- `supabase.cmd migration list --local` -> PASS, local/remote sampai `0053` sinkron.
- `git diff --check` -> PASS; warning LF/CRLF Git tidak menunjukkan whitespace error.

Bukti accessibility: ID form stabil pada render server/client, error helper dapat dibaca assistive
technology, fokus tidak keluar dari modal, dan fokus trigger dipulihkan setelah close.

Risiko tersisa: belum ada browser E2E otomatis untuk keyboard matrix; M8 akan menambahkan Playwright.

Selesai: 2026-08-09 18:01 WIB

### M7.2 - Navigation Dan Loading

Status: `COMPLETE`

Agent: Codex

Mulai: 2026-08-09 18:02 WIB

- Hapus blanket skeleton jika tidak mewakili layout halaman.
- Buat skeleton per-route hanya untuk data yang benar-benar belum tersedia.
- Pertahankan header/bottom nav tanpa remount.
- Prefetch route utama secara terukur dan cegah stale request menimpa state baru.
- Motion wajib menghormati reduced motion.

Implementasi selesai pada M7.2:

- Menghapus `src/app/(app)/loading.tsx` dan `src/components/ui/PageSkeleton.tsx` agar navigasi tidak
  menampilkan skeleton global yang menutupi shell atau content halaman sebelumnya.
- Skeleton tetap berada di komponen yang memiliki fetch client sendiri, seperti notification,
  mentoring, dan list data; header/bottom navigation tetap dimiliki `AppShellClient`.
- `src/app/(app)/template.tsx` memakai `useReducedMotion` dari Motion sehingga transition route
  menjadi tanpa animasi saat user meminta reduced motion.
- Link shell utama diberi `prefetch` eksplisit; fetch unread count tetap memiliki AbortController dan
  cleanup listener sehingga shell tidak melakukan duplicate fetch setiap perubahan pathname.

Test gate:

- `npm.cmd test` -> PASS, 9 file dan 33 test.
- `npm.cmd run test:security` -> PASS.
- `npm.cmd run typecheck` -> PASS.
- `npm.cmd run lint` -> PASS tanpa warning/error.
- `npm.cmd run build` -> PASS, route app terkompilasi tanpa global loading segment.
- `supabase.cmd db lint --local` -> PASS tanpa schema error/warning.
- `supabase.cmd migration list --local` -> PASS, local/remote sampai `0053` sinkron.
- `git diff --check` -> PASS; warning LF/CRLF Git tidak menunjukkan whitespace error.

Bukti navigasi: tidak ada referensi `PageSkeleton` atau `loading.tsx` tersisa di `src`; shell tetap
berada di luar `template` route. Browser navigation smoke belum dapat dijalankan karena environment
menolak background process, sehingga staging/browser verification tetap menjadi gate M8.

Risiko tersisa: transition Motion masih menggunakan client template remount sesuai App Router; tidak
ada loader global untuk route yang lambat. Route dengan server response lambat akan mempertahankan UI
sebelumnya sampai response siap, sesuai keputusan UX, dan M7.3 melanjutkan audit responsive shell.

Selesai: 2026-08-09 18:01 WIB

### M7.3 - Responsive Shell

Status: `COMPLETE`

Agent: Codex

Mulai: 2026-08-09 18:02 WIB

- Pertahankan bottom nav pada mobile dengan `env(safe-area-inset-bottom)`.
- Gunakan sidebar/top navigation dan content width lebih luas pada desktop.
- Pastikan permission toggle tidak menggeser urutan navigasi utama secara membingungkan.
- Verifikasi text panjang, 200% zoom, keyboard, dan viewport sempit.

Implementasi selesai pada M7.3:

- `AppShellClient` memakai shell fluid dengan `max-w-7xl` pada desktop, sidebar 240px pada `md`,
  dan bottom navigation hanya pada mobile; permission filtering tetap memakai satu `visibleNavItems`
  yang sama sehingga urutan menu tidak berubah antar breakpoint.
- Main content memakai `min-w-0` dan area kerja lebih luas; nav item memiliki `aria-current`, icon
  tidak shrink, dan label tidak memaksa overflow horizontal.
- Bottom nav memakai `env(safe-area-inset-bottom)`, minimum height stabil, padding content yang
  sesuai, serta tetap mempertahankan fixed positioning pada mobile.
- Header desktop tetap menyediakan notifikasi dan logout; brand/sidebar hanya ditampilkan pada
  breakpoint yang sesuai sehingga tidak ada duplikasi kontrol yang membingungkan.

Test gate:

- `npm.cmd test` -> PASS, 9 file dan 33 test.
- `npm.cmd run test:security` -> PASS.
- `npm.cmd run typecheck` -> PASS.
- `npm.cmd run lint` -> PASS tanpa warning/error.
- `npm.cmd run build` -> PASS, shell responsive terkompilasi.
- `supabase.cmd db lint --local` -> PASS tanpa schema error/warning.
- `supabase.cmd migration list --local` -> PASS, local/remote sampai `0053` sinkron.
- `git diff --check` -> PASS; warning LF/CRLF Git tidak menunjukkan whitespace error.

Bukti layout: Tailwind build menerima kelas breakpoint, safe-area, `min-w-0`, dan navigation aria;
permission-filtered nav dirender dari sumber item yang sama pada sidebar dan bottom nav.

Risiko tersisa: browser viewport/keyboard smoke belum dapat dijalankan pada environment ini karena
background process ditolak; M8 Playwright wajib memverifikasi 375px, 768px, desktop, 200% zoom, dan
safe-area device nyata.

Selesai: 2026-08-09 18:03 WIB

### M7.4 - UI State Konsisten

Status: `COMPLETE`

Agent: Codex

Mulai: 2026-08-09 18:04 WIB

- Ganti spinner tersisa sesuai pola skeleton/progress yang disepakati.
- Sediakan retry untuk error jaringan.
- Standarkan toast, empty state, destructive confirmation, dan disabled/loading state.
- Perbaiki tab dengan arrow-key navigation dan relasi `tab`/`tabpanel` lengkap.

Implementasi selesai pada M7.4:

- `Toast` mempertahankan auto-dismiss dan animasi exit, menyediakan tombol close berlabel, memakai
  pointer-events yang benar, dan menghormati reduced motion; caller tetap mengontrol state toast.
- Infinite-list loading memakai `Spinner` bersama; spinner/pulse dihentikan secara praktis pada
  `prefers-reduced-motion`, sementara inline action spinner tetap menunjukkan state async tombol.
- `UserSettingsTabs` dan `CashierDetailTabs` menggunakan roving `tabIndex`, ArrowLeft/Right/Up/Down,
  Home/End, `aria-selected`, `aria-controls`, dan panel `aria-labelledby`/focusable.
- Existing retry, empty state, confirm dialog, dan disabled/loading contracts dipertahankan; tidak ada
  perubahan pada payload API atau permission behavior.

Test gate:

- `npm.cmd test` -> PASS, 9 file dan 33 test.
- `npm.cmd run test:security` -> PASS.
- `npm.cmd run typecheck` -> PASS.
- `npm.cmd run lint` -> PASS tanpa warning/error.
- `npm.cmd run build` -> PASS, overlay, tabs, dan list feedback terkompilasi.
- `supabase.cmd db lint --local` -> PASS tanpa schema error/warning.
- `git diff --check` -> PASS; warning LF/CRLF Git tidak menunjukkan whitespace error.

Bukti UI state: semua toast tetap punya timer cleanup, close manual masuk ke exit phase sebelum
unmount, tab hanya menempatkan tab aktif pada tab sequence, dan keyboard navigation tidak memicu
scroll/default action.

Risiko tersisa: belum ada DOM-level accessibility test atau browser smoke; M8 Playwright wajib
memeriksa toast lifecycle, tab keyboard matrix, focus, dan reduced-motion pada browser nyata.

Selesai: 2026-08-09 18:07 WIB

### M7.5 - PWA Aman

Status: `COMPLETE`

Agent: Codex

Mulai: 2026-08-09 18:08 WIB

- Hapus service worker lama atau ubah agar hanya cache asset publik statis.
- Jangan cache navigation privat, API, signed URL, atau storage image.
- Verifikasi logout tidak meninggalkan data user pada Cache Storage.

Implementasi selesai pada M7.5:

- `public/sw.js` sekarang hanya cache asset publik (`manifest`, logo, icon, dan `/_next/static/`);
  navigation, API, signed URL, storage image, dan cross-origin request tidak pernah di-intercept.
- Cache worker diberi namespace/version baru dan activate handler menghapus cache lama milik aplikasi,
  sehingga cache navigation dari worker versi sebelumnya tidak tertinggal setelah update.
- `ServiceWorkerRegistration` hanya mendaftarkan worker pada production, memakai `updateViaCache: none`,
  dan kegagalan registration tidak memblokir aplikasi.
- `src/proxy.ts` memberi `private, no-store, Vary: Cookie` pada route terautentikasi dan redirect auth,
  mengurangi risiko browser/proxy menyimpan response privat.

Test gate:

- `node.exe --check public/sw.js` -> PASS.
- `npm.cmd test` -> PASS, 9 file dan 33 test.
- `npm.cmd run test:security` -> PASS.
- `npm.cmd run typecheck` -> PASS.
- `npm.cmd run lint` -> PASS tanpa warning/error.
- `npm.cmd run build` -> PASS, registration client dan proxy terkompilasi.
- `supabase.cmd db lint --local` -> PASS tanpa schema error/warning.
- `git diff --check` -> PASS; warning LF/CRLF Git tidak menunjukkan whitespace error.

Bukti PWA security: allowlist worker tidak mencakup route atau `/api/`; hanya response same-origin,
`basic`, dan `ok` untuk asset publik yang boleh masuk cache. Cache prefix lama dihapus saat activate.

Risiko tersisa: service worker/browser cache hanya dapat diverifikasi penuh di browser production;
M8.3 wajib menguji update worker, logout, Cache Storage, offline asset, private route, dan multi-tab.

Selesai: 2026-08-09 18:10 WIB

## 15. Milestone M8 - Release Hardening

### M8.1 - Automated Test Coverage

Status: `COMPLETE`

Agent: Codex
Mulai: 2026-08-09 18:11 WIB
Selesai: 2026-08-09 18:37 WIB

- Unit: permission dependency, redirect, scoring, pagination, cursor, cron, notification, rate
  limit, dan avatar validation.
- API contract: enam protected endpoint diuji tanpa session dan wajib mengembalikan JSON `401`
  dengan `error.code=UNAUTHENTICATED` serta `requestId`.
- RLS/integration: security regression SQL mencakup role matrix, inactive user, RPC privilege,
  rollback transaction, invite, transfer, mentoring, lifecycle, scoring, period, dan notification.
- E2E: critical path authenticated untuk cashier, assessment, mentoring, leaderboard, menu,
  period surface, dan logout lulus pada Chromium desktop/mobile dengan user lokal sementara; public
  login smoke juga lulus.
- Test harness tidak memakai data production. Session harness memakai cookie SSR Supabase yang valid
  dan user sementara selalu dihapus setelah test. PWA cache boundary juga diuji pada server production
  lokal untuk desktop/mobile.

Test gate: unit 35/35, API 6/6, E2E authenticated/public/PWA 8/8 lulus pada Chromium desktop/mobile.
Risiko tersisa: concurrency production dan Lighthouse baseline menjadi pekerjaan operasional M8.3.
Step berikutnya: M8.2.

### M8.2 - CI Quality Gate

Status: `COMPLETE`

Agent: Codex
Mulai: 2026-08-09 18:25 WIB
Selesai: 2026-08-09 18:37 WIB

Workflow `.github/workflows/quality-gate.yml` menjalankan npm audit production, generated-type
verification, operations preflight, typecheck, ESLint, unit test, production build, API contract
smoke, isolated Supabase migration/db lint/security regression, dan Playwright Chromium. E2E
authenticated dapat memakai repository/environment secrets non-production; tanpa secret, public
browser smoke tetap dijalankan dan authenticated suite skip secara eksplisit.

Test gate lokal setelah workflow ditambahkan: seluruh regression gate lulus.
Risiko tersisa: secret E2E dan Supabase runner harus dikonfigurasi pada repository CI sebelum merge
protection mewajibkan authenticated path.
Step berikutnya: M8.3.

### M8.3 - Staging Dan Operational Readiness

Status: `IN_PROGRESS`

Agent: Codex
Mulai: 2026-08-09 18:38 WIB

`docs/OPERATIONS_RUNBOOK.md` sudah ditambahkan dengan release gate, backup/restore, migration
rollback, smoke test role, cron monitoring, user deactivation, secret rotation, incident response,
dan PWA cache verification. Local Supabase, generated database types, operations preflight, DB lint,
security regression, API smoke, production build, dan browser smoke sudah diverifikasi. E2E terakhir
lulus 8/8 pada Chromium desktop/mobile dengan user sementara dan cleanup terverifikasi; PWA cache
hanya memuat asset publik dan tidak menyimpan API/private route.

Belum dapat ditutup dari workspace ini: backup production nyata, restore ke staging, konfigurasi
provider/redirect production, secret manager, edge rate limit, dan smoke memakai seluruh akun role
staging. Jangan menandai COMPLETE sebelum operator mengisi bukti tersebut pada staging.

- Backup sebelum migrasi production dan restore staging: menunggu akses environment.
- Smoke seluruh role dan akun nonaktif: prosedur tersedia; eksekusi staging menunggu credential.
- Auth providers, redirect, RLS, Storage, cron, environment secret: checklist tersedia; verifikasi
  production menunggu konfigurasi target.
- Rollback migration/code dan maintenance notice: runbook tersedia.

Step berikutnya: M8.3 execution checklist oleh operator staging.

### M8.4 - Dokumentasi Final

Status: `COMPLETE`

Agent: Codex
Mulai: 2026-08-09 18:35 WIB
Selesai: 2026-08-09 19:04 WIB

`docs/DEVELOPER_GUIDE.md`, `docs/TECHNICAL_AUDIT.md`, roadmap ini, dan
`docs/OPERATIONS_RUNBOOK.md` sudah disinkronkan. Temuan historis diberi status remediasi dan residual
risk external environment dipisahkan dari bukti lokal. P1-5 generated database types sekarang
ditutup dengan generator schema, compatibility aliases, strict typecheck, dan `test:types`; operations
preflight ditambahkan melalui `test:ops`. Dependensi `@supabase/ssr` dan `@supabase/supabase-js`
diselaraskan. Tidak ada klaim backup/restore production yang belum dijalankan.

Step berikutnya: M8.3 execution checklist oleh operator staging.

## 16. Template Penyelesaian Step

Salin blok ini ke bagian `Riwayat Eksekusi Step` setelah setiap step selesai.

```markdown
### [STEP-ID] - [Judul]

- Status: COMPLETE
- Agent: [nama/model agent]
- Mulai: [YYYY-MM-DD HH:mm TZ]
- Selesai: [YYYY-MM-DD HH:mm TZ]
- Commit awal: [hash]
- Commit hasil: [hash atau NOT_COMMITTED]
- Ringkasan: [perubahan perilaku, bukan hanya daftar file]
- File diubah: [daftar]
- Migrasi: [nama atau NONE]
- Keputusan: [ADR baru/perubahan atau NONE]
- Test:
  - `[command]` -> PASS ([ringkasan])
  - `[command]` -> PASS ([ringkasan])
- Bukti keamanan/integritas: [negative test dan hasil]
- Risiko tersisa: [daftar atau NONE]
- Catatan deployment/rollback: [isi]
- Step berikutnya: [STEP-ID]
```

Jika step gagal atau diblokir, catat command gagal, output inti, percobaan yang sudah dilakukan,
dan input yang dibutuhkan. Jangan menulis `COMPLETE`.

## 17. Riwayat Eksekusi Step

### M0 - Audit Dan Baseline

- Status: `COMPLETE`
- Agent: Codex
- Selesai: 2026-08-09
- Commit awal: `72e6cb3`
- Commit hasil: `NOT_COMMITTED`
- Ringkasan: audit source, migrasi, policy live, privilege function, integritas data, UI, dan
  dependency selesai. Exploit self-role dan cross-branch assessment dibuktikan dalam transaksi
  yang di-rollback.
- Test:
  - `npm.cmd run typecheck` -> PASS
  - `npm.cmd run lint` -> PASS tanpa warning/error
  - `npm.cmd test -- --run` -> PASS, 2 file dan 16 test
  - `npm.cmd run build` -> PASS, 32 static pages/generated route analysis selesai
  - `supabase.cmd db lint --local --level warning` -> PASS tanpa schema error
  - `npm.cmd audit --omit=dev` -> FAIL SECURITY GATE, 3 high findings
- Risiko tersisa: seluruh SEC-001 sampai SEC-006 dan milestone M1-M8.
- Step berikutnya: M1.2.

### M1.1 - Kunci RPC Mutasi

- Status: `COMPLETE`
- Agent: Codex
- Mulai: 2026-08-09 14:24 WIB
- Selesai: 2026-08-09 14:32 WIB
- Commit awal: `72e6cb3`
- Commit hasil: `NOT_COMMITTED`
- File diubah: `src/app/api/periods/route.ts`, `src/app/api/periods/[id]/close/route.ts`,
  `supabase/migrations/0026_lockdown_period_rpc.sql`, dan dokumen ini.
- Bukti security: `PUBLIC`, `anon`, dan `authenticated` tidak lagi memiliki EXECUTE; trigger tetap
  dapat memanggil rekalkulasi; service-role positive path berhasil.
- Test: typecheck, lint, unit test 16/16, build, DB lint, migration list, privilege SQL, trigger,
  dan service-role positive test semuanya lulus.
- Risiko tersisa: test HTTP admin end-to-end masih menjadi bagian M1.5.
- Step berikutnya: M1.2.

### M1.2 - Tutup Self Role Escalation Dan User Nonaktif

- Status: `COMPLETE`
- Agent: Codex
- Mulai: 2026-08-09 14:33 WIB
- Selesai: 2026-08-09 14:42 WIB
- Commit awal: `72e6cb3`
- Commit hasil: `NOT_COMMITTED`
- File diubah: `supabase/migrations/0027_lockdown_user_access.sql`,
  `src/app/api/users/[id]/route.ts`, `src/app/api/storage/cashier-avatar/route.ts`,
  `src/components/settings/UserManagementList.tsx`,
  `src/lib/storage/cashier-avatar.ts`, `src/components/cashiers/CashierAvatar.tsx`,
  `src/app/(app)/settings/users/page.tsx`, dan dokumen ini.
- Bukti security: direct `users` UPDATE dicabut dari `authenticated`; RPC admin hanya untuk
  `service_role`; restrictive active-user guard menutup public tables dan Storage untuk akun nonaktif.
- Bukti audit: perubahan user menghasilkan actor, action, entity, timestamp, before, dan after.
- Test: migration up, DB lint, migration list, privilege SQL, rollback security test, typecheck,
  lint, unit test 16/16, build, dan diff check semuanya lulus.
- Risiko tersisa: HTTP admin E2E masih menjadi bagian M1.5; M1.3 belum dikerjakan.
- Step berikutnya: M1.3.

### M1.3 - Ganti Policy Write Permissive

- Status: `COMPLETE`
- Agent: Codex
- Mulai: 2026-08-09 14:48 WIB
- Selesai: 2026-08-09 14:57 WIB
- Commit awal: `72e6cb3`
- Commit hasil: `NOT_COMMITTED`
- File diubah: `supabase/migrations/0028_operation_level_write_policies.sql`,
  `src/app/api/deductions/[id]/route.ts`, dan dokumen ini.
- Bukti security: empat policy `FOR ALL USING(true)` dihapus; operation-level policy menegakkan
  permission, active entity, branch/outlet access, parent relationship, dan periode open.
- Test: migration up, DB lint, SQL security matrix rollback, typecheck, lint, unit test 16/16, build,
  dan diff check semuanya lulus.
- Risiko tersisa: HTTP E2E masih menjadi bagian M1.5; scope kolom dan leaderboard menjadi M1.4.
- Step berikutnya: M1.4.

### M1.4 - Tutup Kebocoran Leaderboard Dan Scope Kolom

- Status: `COMPLETE`
- Agent: Codex
- Mulai: 2026-08-09 15:00 WIB
- Selesai: 2026-08-09 15:11 WIB
- Commit awal: `72e6cb3`
- Commit hasil: `NOT_COMMITTED`
- File diubah: `supabase/migrations/0029_leaderboard_and_column_scope.sql`,
  `src/app/api/cashiers/[id]/route.ts`, `src/app/api/cashiers/[id]/transfer/route.ts`,
  `src/app/api/outlets/[id]/route.ts`, dan dokumen ini.
- Bukti security: leaderboard sekarang branch-scoped; direct authenticated update hanya memiliki
  column grant `name` pada cashier/outlet.
- Bukti flow: route name-only tetap memakai client session, sedangkan status/transfer/branch-sensitive
  mutation dipindahkan ke service-role setelah admin guard.
- Test: migration up, DB lint, privilege SQL, leaderboard isolation rollback, forbidden-column rollback,
  typecheck, lint, unit test 16/16, build, dan diff check semuanya lulus.
- Risiko tersisa: HTTP E2E role matrix menjadi M1.5; dependency high menjadi M1.6.
- Step berikutnya: M1.5.

## 18. Catatan Handoff Aktif

Agent berikutnya harus memulai dari M8.3 execution checklist dan tidak mengulang audit umum.

Kondisi terakhir:

- Worktree memiliki perubahan M1.1 sampai M7.5 dan dokumen roadmap yang belum di-commit.
- Supabase lokal berjalan, migrasi `0053` sudah diterapkan, dan DB lint lulus tanpa warning.
- Terdapat data assessment lintas beberapa cabang; jangan reset tanpa izin.
- RPC periode dan RPC user mutation terverifikasi hanya executable oleh `service_role`; `PUBLIC`,
  `anon`, dan `authenticated` ditolak.
- Route open/close period sudah memakai `createAdminClient()` setelah admin guard.
- Endpoint `PATCH /api/users/[id]` memakai `requireAdmin()` lalu `admin_update_user`.
- Restrictive `active_user_guard` menutup akses akun nonaktif di public tables dan Storage.
- Policy operasi assessment/deduction/mentoring sudah tidak permissive.
- Leaderboard sudah branch-scoped dan client hanya mendapat column grant name-only untuk cashier/outlet.
- `npm.cmd run test:security` tersedia dan lulus; fixture deterministic selalu di-rollback.
- `npm.cmd run test:types` lulus; `src/types/database.ts` berasal dari generated schema lokal dan
  tidak lagi memakai placeholder `Database = any`.
- `npm.cmd run test:ops` lulus untuk preflight CI/non-production dan synthetic production; secret
  tidak dicetak dan service-role tetap server-only.
- Supabase local saat ini melaporkan external email dan Google provider `false`; ini konfigurasi
  intentional untuk local signup control. Authenticated browser gate lokal memakai session harness;
  provider production wajib diverifikasi operator pada M8.3.
- Dependency production high/critical sudah tertutup; `npm audit --omit=dev` lulus.
- Next 16 memakai `src/proxy.ts`, ESLint CLI flat config, dan `tsconfig.json` automatic JSX runtime.
- Implementasi M1.1 sampai M1.6, M2.1-M2.4, dan M3.1-M3.5 selesai; M3 COMPLETE.
- Migration `0030` sudah diterapkan dan Auth local sudah direstart tanpa reset database.
- Email signup local nonaktif; global signup tetap aktif untuk mendukung external OAuth invite.
- Invite lifecycle atomik pada RPC `0031`; setup race-safe pada RPC `0032/0033`; API auth wrapper dan
  OAuth allowlist M2.4 sudah lulus smoke.
- Avatar bucket `cashier-photos` sekarang private dengan batas 2 MB dan allowlist MIME gambar; upload
  memakai versioned path serta validator `sharp`.
- M3.1 sampai M3.5 selesai dan seluruh gate masing-masing lulus; M3 COMPLETE.
- M4.1 selesai: category/detail writes memakai RPC service-role, direct authenticated writes ditutup,
  proposed total dikunci advisory transaction lock, dan `open_period` memiliki configuration preflight.
- M4.2 selesai: snapshot category/detail metadata menjadi source of truth untuk assessment dan recalc;
  live config tidak mengubah periode lama.
- M4.3 selesai: cashier-period completion, partial score denominator, dashboard/cron completion flow,
  dan RLS completion sudah diuji.
- M4.4 selesai: period roster, mid-period admin RPC, historical placement snapshot, closed leaderboard
  source, selector period, dan migration `0046` sudah diuji.
- M4.5 selesai: unique open period, tanggal/overlap preflight, incomplete override admin dengan audit
  reason, idempotent close, cron rollover guard, dan migration `0047/0048` sudah diuji.
- M4.6 selesai: regresi scoring desimal/floor, snapshot config, missing assessment, inactive detail,
  cashier lifecycle, transfer, duplicate close, dan historical rank sudah lulus.
- M5.1 selesai: leaderboard query Zod validation, scope outlet/branch, period 404, closed rank snapshot,
  stale request abort, error payload normalization, dan key period-cashier sudah diuji.
- M5.2 selesai: cursor keyset, stable tie-breaker, server search, page limit, scoped CSV export,
  migration `0049`, dan cursor unit test sudah lulus.
- M5.3 selesai: dashboard admin/manager/supervisor role-aware, branch-scoped metrics, completion/score/
  invite/mentoring/unread actions, explicit error/empty state, dan build gate sudah lulus.
- M6.1 selesai: cron POST-only, header-only constant-time secret, invocation correlation, recipient
  eligibility, period-date ordering, notification dedupe metadata/constraint, idempotent inserts,
  dan migration `0050/0051` sudah diuji.
- M6.2 selesai: notification feed cursor, unread header badge, mark-all-read atomik, retry/load-more,
  internal deep-link, user-owned RLS regression, dan migration `0052` sudah diuji.
- M6.3 selesai: bounded server pagination/filter untuk cashier/user/branch/outlet, cursor feed yang
  dipertahankan untuk invite/mentoring/leaderboard/notification, page-only signed avatar, helper
  pagination, dan migration `0053` sudah diuji.
- M6.4 selesai: structured safe error, request/invocation ID validation, CSP/security headers,
  best-effort rate limit, nested client error handling, dan full quality gate sudah lulus.
- M7.1 selesai: stable form IDs/labels, error describedby, modal focus trap/Escape/restore focus,
  async close guard, browser zoom, dan full quality gate sudah lulus.
- M7.2 selesai: global route skeleton dihapus, shell tetap persisten, route transition menghormati
  reduced motion, prefetch shell eksplisit, dan full quality gate sudah lulus. Browser smoke kemudian
  diselesaikan pada M8.1 dengan server production lokal.
- M7.3 selesai: shell desktop/sidebar dan mobile/bottom-nav responsif, safe-area padding, stable
  min-width, aria-current, permission ordering, dan full quality gate sudah lulus. Browser viewport
  smoke tetap menjadi pekerjaan M8.
- M7.4 selesai: toast lifecycle/close/reduced-motion, shared inline spinner, dan keyboard tab
  semantics sudah diterapkan; full quality gate lulus. DOM/browser accessibility smoke masuk M8.
- M7.5 selesai: service worker dibatasi asset publik, cache legacy dibersihkan, registration production
  only, protected response `no-store`, dan full quality gate lulus. Browser Cache Storage smoke masuk
  M8.3.
- M8.3 local gate selesai: production-browser PWA test memverifikasi registration, `CACHE_NAME`, asset
  publik, dan exclusion API/private route; bukti staging/production eksternal tetap belum tersedia.
- M8.1 selesai: 35 unit test, API contract smoke enam endpoint, SQL/RLS regression, dan authenticated
  plus public Playwright smoke lulus tanpa data production; PWA cache boundary lulus; gate terakhir
  browser lulus 8/8.
- M8.2 selesai: `.github/workflows/quality-gate.yml` menjalankan generated-type verification,
  operations preflight, static, audit, build, API, database, RLS, dan browser/PWA gate. Authenticated
  CI membutuhkan secret user test non-production.
- M8.3 masih IN_PROGRESS: runbook tersedia, tetapi backup/restore dan verifikasi provider/secret/
  role staging-production belum dapat dilakukan tanpa akses environment.
- M8.4 selesai: developer guide, technical audit, roadmap, dan operations runbook sinkron.

Langkah berikutnya:

1. Konfigurasikan user test non-production atau session harness sebagai CI secrets.
2. Jalankan backup production dan restore ke staging sebelum migration release.
3. Jalankan smoke test admin, manager, supervisor, dan inactive user pada staging.
4. Verifikasi Auth provider/redirect, RLS, Storage private, cron secret, edge rate limit, dan PWA
   Cache Storage pada staging.
5. Isi bukti operator pada M8.3, lalu ubah statusnya menjadi `COMPLETE` hanya setelah semua check
   eksternal lulus.

## 19. Log Perubahan Dokumen

| Versi | Tanggal | Agent | Perubahan |
| --- | --- | --- | --- |
| 1.0.0 | 2026-08-09 | Codex | Dokumen awal, milestone M1-M8, test gate, dan handoff dibuat dari hasil audit terbaru |
| 1.0.1 | 2026-08-09 | Codex | M1.1 selesai: RPC dikunci, caller admin dipindah ke service-role, test gate dan handoff M1.2 dicatat |
| 1.0.2 | 2026-08-09 | Codex | M1.2 selesai: self role escalation ditutup, akun nonaktif diblokir lintas RLS/Storage, admin RPC dan audit log ditambahkan |
| 1.0.3 | 2026-08-09 | Codex | M1.3 selesai: policy write permissive diganti operation-level, parent deduction/mentoring scope dikunci, test matrix dan handoff M1.4 dicatat |
| 1.0.4 | 2026-08-09 | Codex | M1.4 selesai: leaderboard diisolasi per cabang, update cashier/outlet dibatasi name-only, mutation sensitif dipindah ke service-role route, handoff M1.5 dicatat |
| 1.0.5 | 2026-08-09 | Codex | M1.5 selesai: security regression suite SQL deterministik, role matrix, rollback cleanup, runner Docker/psql, test gate, dan handoff M1.6 dicatat |
| 1.0.6 | 2026-08-09 | Codex | M1.6 selesai: Next 16, PostCSS/Sharp aman, proxy convention, ESLint CLI flat config, production audit/build/smoke gate, residual risk dev dependency dan handoff M2.1 dicatat |
| 1.0.7 | 2026-08-09 | Codex | M2.1 selesai: pending profile, email signup local disabled, activation eksplisit setup/invite/Google, Auth restart, regression assertion, dan handoff M2.2 dicatat |
| 1.0.8 | 2026-08-09 | Codex | M2.2 selesai: consume invite atomik, revoke/regenerate/expiry, branch validation, cursor search, regression lifecycle, seluruh gate lulus, dan handoff M2.3 dicatat |
| 1.0.9 | 2026-08-09 | Codex | M2.3 selesai: setup reservation/rate-limit/finalize/release, guard admin aktif forward-only, kompensasi Auth, regression race, seluruh gate lulus, dan handoff M2.4 dicatat |
| 1.0.10 | 2026-08-09 | Codex | M2.4 selesai: seluruh API memakai JSON auth/error wrapper, protected endpoint smoke 401, OAuth origin allowlist, open-redirect test, seluruh gate lulus, dan handoff M3.1 dicatat |
| 1.0.11 | 2026-08-09 | Codex | M3.1 selesai: cashier creation dan initial history atomik, unique active-history constraint, actor/branch/permission validation, regression security, seluruh gate lulus, dan handoff M3.2 dicatat |
| 1.0.12 | 2026-08-09 | Codex | M3.2 selesai: transfer cashier atomik, row locks, effective timestamp, target validation, forward-only lint/clock correction, regression history, seluruh gate lulus, dan handoff M3.3 dicatat |
| 1.0.13 | 2026-08-09 | Codex | M3.3 selesai: mentoring session dan seluruh notes atomik, payload/date/active-cashier validation, rollback regression, UUID correction, seluruh gate lulus, dan handoff M3.4 dicatat |
| 1.0.14 | 2026-08-09 | Codex | M3.4 selesai: avatar decoder validation, private bucket limits, versioned replacement, compensating cleanup, proxy path hardening, seluruh gate lulus, dan handoff M3.5 dicatat |
| 1.0.15 | 2026-08-09 | Codex | M3.5 selesai: cashier status history, atomic deactivation/reactivation, placement consistency, parent deactivation guards, inactive visibility isolation, admin filter, seluruh gate lulus, dan handoff M4.1 dicatat |
| 1.0.16 | 2026-08-09 | Codex | M4.1 selesai: proposed category total validation, service-role config RPC, direct-write revocation, detail constraints, open-period preflight, seluruh gate lulus, dan handoff M4.2 dicatat |
| 1.0.17 | 2026-08-09 | Codex | M4.2 selesai: snapshot metadata menjadi source of truth untuk recalc dan assessment, perubahan live tidak retroaktif, seluruh gate lulus, dan handoff M4.3 dicatat |
| 1.0.18 | 2026-08-09 | Codex | M4.3 selesai: completion status, partial score tanpa full-credit fallback, dashboard/cron integration, seluruh gate lulus, dan handoff M4.4 dicatat |
| 1.0.19 | 2026-08-09 | Codex | M4.4 selesai: roster snapshot, explicit mid-period admin flow, historical placement leaderboard, period selector, seluruh gate lulus, dan handoff M4.5 dicatat |
| 1.0.20 | 2026-08-09 | Codex | M4.5 selesai: period preflight, unique open/overlap guard, admin incomplete override dengan audit log, idempotent close, cron rollover guard, migration `0047/0048`, seluruh gate lulus, dan handoff M4.6 dicatat |
| 1.0.21 | 2026-08-09 | Codex | M4.6 selesai: regresi scoring desimal/floor, snapshot config, missing assessment, inactive cashier, transfer, duplicate close, historical rank, seluruh gate lulus, dan handoff M5.1 dicatat |
| 1.0.22 | 2026-08-09 | Codex | M5.1 selesai: leaderboard query validation, branch/outlet scope, historical rank snapshot, stale request abort, error normalization, seluruh gate lulus, dan handoff M5.2 dicatat |
| 1.0.23 | 2026-08-09 | Codex | M5.2 selesai: cursor keyset, stable tie-breaker, server search, pagination load-more, scoped CSV export, migration `0049`, seluruh gate lulus, dan handoff M5.3 dicatat |
| 1.0.24 | 2026-08-09 | Codex | M5.3 selesai: dashboard role-aware, branch-scoped metrics, completion/score/invite/mentoring/unread action, explicit error/empty state, seluruh gate lulus, dan handoff M6.1 dicatat |
| 1.0.25 | 2026-08-09 | Codex | M6.1 selesai: cron POST-only, constant-time header secret, invocation correlation, recipient eligibility, period-date ordering, notification dedupe, seluruh gate lulus, dan handoff M6.2 dicatat |
| 1.0.26 | 2026-08-09 | Codex | M6.2 selesai: notification cursor feed, unread badge, mark-all-read atomik, retry/load-more, internal deep-link, RLS regression, migration `0052`, seluruh gate lulus, dan handoff M6.3 dicatat |
| 1.0.27 | 2026-08-09 | Codex | M6.3 selesai: bounded pagination/filter domain list, cursor feed preservation, page-only signed avatar, helper pagination, migration `0053`, seluruh gate lulus, dan handoff M6.4 dicatat |
| 1.0.28 | 2026-08-09 | Codex | M6.4 selesai: structured safe error, security headers/CSP, request ID validation, best-effort rate limit, client nested error handling, seluruh gate lulus, dan handoff M7.1 dicatat |
| 1.0.29 | 2026-08-09 | Codex | M7.1 selesai: stable form IDs, describedby errors, modal focus trap/Escape/restore, async close guard, browser zoom, seluruh gate lulus, dan handoff M7.2 dicatat |
| 1.0.30 | 2026-08-09 | Codex | M7.2 selesai: global skeleton dihapus, shell persisten, reduced-motion route transition, prefetch shell, seluruh quality gate lulus, dan handoff M7.3 dicatat |
| 1.0.31 | 2026-08-09 | Codex | M7.3 selesai: responsive sidebar/bottom nav, safe-area, content width, stable nav ordering, seluruh quality gate lulus, dan handoff M7.4 dicatat |
| 1.0.32 | 2026-08-09 | Codex | M7.4 selesai: toast lifecycle, shared loading state, reduced-motion feedback, keyboard tab semantics, seluruh quality gate lulus, dan handoff M7.5 dicatat |
| 1.0.33 | 2026-08-09 | Codex | M7.5 selesai: PWA public-only cache, cache invalidation, protected no-store, registration production-only, seluruh quality gate lulus, dan handoff M8.1 dicatat |
| 1.0.34 | 2026-08-09 | Codex | M8.1 selesai: permission/unit, API contract, SQL/RLS regression, authenticated/public Playwright critical path, dan test harness tanpa data production |
| 1.0.35 | 2026-08-09 | Codex | M8.2 selesai: CI quality workflow untuk static, audit, build, API, database, RLS, dan browser gate |
| 1.0.36 | 2026-08-09 | Codex | M8.3 dimulai: operations runbook, release/backup/rollback/role/cron/secret/PWA checklist; external staging evidence masih diperlukan |
| 1.0.37 | 2026-08-09 | Codex | M8.4 diperbarui: generated database types dan compatibility aliases menutup P1-5; residual risk environment tetap dicatat |
| 1.0.38 | 2026-08-09 | Codex | Gate akhir M8.1/M8.2 diulang dan lulus: typecheck, lint, 35 unit test, build, audit production, API, DB lint, security regression, operations preflight, dan E2E 6/6; Supabase dependency diselaraskan |
| 1.0.39 | 2026-08-09 | Codex | Catatan handoff diperjelas: Supabase local mematikan external email/Google; authenticated E2E local memakai session harness dan provider production wajib diverifikasi pada M8.3 |
| 1.0.40 | 2026-08-09 | Codex | PWA cache boundary ditambahkan ke E2E/CI dan lulus 8/8 desktop/mobile; hanya asset publik tercache, API/private route tervalidasi tidak tercache |
| 1.0.41 | 2026-08-09 | Codex | Final gate diulang setelah PWA test: typecheck, lint, unit 35/35, build, audit, types, operations, DB lint, security regression, API smoke, dan E2E 8/8 lulus |
| 1.0.42 | 2026-08-09 | Codex | Instruksi PWA runbook diperjelas untuk Bash dan PowerShell; tidak ada perubahan perilaku aplikasi |
