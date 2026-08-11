# Operations Runbook

Runbook ini berlaku untuk staging dan production aplikasi KPI Kasir Rajaklana. Semua langkah yang
mengubah database atau secret harus dilakukan oleh operator yang berwenang dan dicatat bersama
waktu, environment, dan request ID.

## Release Gate

Sebelum deploy, pastikan:

- `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, dan `npm audit --omit=dev --audit-level=high` lulus.
- `supabase db lint --local --level warning` dan `npm run test:security` lulus pada database disposable.
- `npm run test:ops` lulus pada CI/non-production; jalankan ulang dengan `OPS_ENV=production` pada
  environment target production.
- API smoke mengembalikan JSON `401` terstruktur untuk request tanpa session.
- Playwright critical path lulus dengan user test non-production.
- Backup production tervalidasi dan rollback migration/code sudah ditentukan.

## Environment And Secrets

Required values:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- `NEXT_PUBLIC_APP_URL` dan `APP_ORIGIN_ALLOWLIST` dengan origin HTTPS production yang tepat.
- `CRON_SECRET` yang random, panjang, dan tidak digunakan ulang pada environment lain.
- Google provider hanya jika OAuth digunakan; provider, client ID, secret, dan callback harus cocok
  di Supabase Auth dan origin allowlist.

`SUPABASE_SERVICE_ROLE_KEY` hanya boleh berada pada server/CI secret store. Jangan memasukkannya ke
Client Component, log, URL, screenshot, atau issue.

`npm run test:ops` tidak melakukan mutation atau network request. Pada production jalankan dengan
environment target yang sudah dimuat, lalu pastikan `APP_ORIGIN_ALLOWLIST` memuat origin aplikasi.

### Staging Aktif

Status 2026-08-12 01:38 WIB:

- Supabase staging: `kpi-kasir-staging` (`fkanacflupmyuohkjque`), region `ap-northeast-2`.
- Migrasi staging: lokal/remote sinkron `0001..0058`; dry-run up-to-date dan remote DB lint nol
  temuan.
- Bucket `mentoring-evidence`: private, maksimum 358400 byte, hanya `image/webp`.
- Production `gxnlhtqnfgcbkfqoxpoa` sudah menerima migration `0058` secara additive pada 2026-08-12.
  Verifikasi read-only setelah push mengonfirmasi tabel `public.mentoring_evidence`, bucket private
  `mentoring-evidence` dengan limit 358400 byte dan MIME `image/webp`, serta RPC
  `reserve_mentoring_evidence`, `finalize_mentoring_evidence`, dan `abort_mentoring_evidence`.
- Vercel Preview branch `staging` commit `8045dab` berhasil dideploy; seluruh quality gate lokal dan
  build Vercel lulus.
- Preview tetap dilindungi Vercel Authentication; gunakan Protection Bypass for Automation untuk
  smoke terotomasi, bukan mematikan proteksi atau membagikan kredensial admin.
- Protection bypass tervalidasi dari `.env.local` yang diabaikan Git. Flag-off smoke lulus: API
  tanpa session `401`, API authenticated `200`, lima route inti, sesi `201`, evidence 0, dan cleanup
  admin sintetis 1->1.
- Flag-on smoke lulus: picker ter-hydrate, session/upload `201`, private WebP delivery `200`, private
  cache policy, ETag/conditional `304`, gallery/lightbox, metadata limit, dan object Storage valid.
  Cleanup akhir menyisakan nol profil/sesi/evidence sintetis dan mempertahankan baseline milik user:
  1 user, 1 branch, 1 outlet, 1 sesi, serta 2 evidence. Gunakan listing Storage setelah jeda singkat
  untuk verifikasi remove, bukan download langsung yang dapat melihat respons transien.
- Role/scope matrix lulus: admin/manager/supervisor, owner/same-branch, cross-branch, assignment
  revoked, inactive account, non-owner upload, RLS metadata, dan direct private Storage denial.
- Concurrency/failure matrix lulus: empat upload paralel menghasilkan `201,201,201,409`; kuota tepat
  tiga row/object; retry dedupe `200`; fake image `422`; MIME invalid `415`; oversize `413`; dan
  cleanup terotorisasi menghapus tepat satu stale pending sintetis tanpa menyentuh ready evidence.
- WebKit 26.5 lulus pada Desktop Safari dan emulasi iPhone 13 untuk empat route (`200`), skeleton
  thumbnail/lightbox, image load, tanpa horizontal overflow, serta font input mobile minimum `16px`.
  Error `_rsc`/`sw.js` akibat Preview Protection dicatat terpisah; error aplikasi lain tetap fatal.
- Sensitive `CRON_SECRET` Preview dirotasi tanpa dicetak dan deployment lama diredeploy. Manual
  authorized cleanup pada branch alias dan deployment unik masing-masing `200`, dengan
  scanned/removed/failed/remaining `0/0/0/0`.
- Backlog cleanup 101 row lulus dalam batch `100` lalu `1`. Dua invocation bersamaan pada enam row
  juga lulus: total removed `6`, already-removed `6`, failed `0`, remaining sintetis `0`, dan
  baseline staging pulih.
- Audit read-only Supabase production masih melaporkan `backups: null` dan `pitr_enabled: false`.
  Migration `0058` dilakukan sebagai rollout additive atas instruksi operator, tetapi production
  tetap belum memiliki restore point yang dapat dibuktikan dan release gate backup/PITR belum lulus.

Environment Vercel Preview memakai URL dan API key dari staging, origin deployment Preview,
`CRON_SECRET` khusus staging, serta `MENTORING_EVIDENCE_UPLOAD_ENABLED=true` untuk validasi saat ini.
Vercel Production juga sudah memiliki `MENTORING_EVIDENCE_UPLOAD_ENABLED=true` dan redeploy terbaru
berstatus `Ready` pada alias `https://kpi-kasir.vercel.app`. Smoke publik production: `/login` `200`
dan endpoint evidence yang aktif merespons guard method `405`, bukan `503` feature disabled.
Untuk rollback upload tanpa migrasi destruktif, set flag environment yang sesuai kembali `false`
dan redeploy. Setup singleton dan remote anon/RPC smoke sudah lulus. Jangan mencatat nilai key,
bypass token, atau secret di dokumen ini.

### External Release Gates

Production tetap `BLOCKED` sampai operator menyelesaikan langkah berikut:

1. Pada iPhone fisik, buka Preview Safari dan login dengan akun staging. Uji pemilihan dari Camera
   dan Photo Library, upload maksimal tiga foto, skeleton thumbnail/lightbox, close/navigation
   lightbox, input form tanpa zoom, rotasi portrait/landscape, dan tidak ada overflow. Catat model,
   versi iOS, format file yang diterima, durasi upload, hasil, serta screenshot tanpa PII.
2. Audit CLI 2026-08-12 menemukan production belum memiliki physical backup/PITR yang dapat dipakai.
   Aktifkan backup pada plan yang mendukung atau siapkan logical dump resmi Supabase CLI. Catat jenis
   backup, timestamp, retention window, plan, dan operator; jangan kirim database password atau
   service-role key.
3. Setelah backup tersedia, gunakan `Restore to a New Project` untuk physical backup atau restore
   logical dump ke project disposable. Verifikasi Auth dan tabel penting. Jangan restore di atas
   production.
4. Restore-to-new-project tidak menyalin object atau konfigurasi Storage. Uji prosedur recovery
   Storage secara terpisah: inventaris bucket/object, buat ulang bucket private dan limitnya, salin
   hanya fixture non-PII ke target disposable, lalu verifikasi akses API/RLS. Jangan menganggap clone
   database sebagai backup foto.
5. Konfirmasi kebijakan v1: evidence bersifat opsional, ready evidence tidak memiliki tombol delete,
   dan tidak dihapus otomatis. Tetapkan masa retensi bisnis sebelum rollout bila kebijakan ini tidak
   diterima.

Catatan bukti iPhone yang harus dikembalikan operator:

| Field                     | Nilai operator |
| ------------------------- | -------------- |
| Model iPhone              |                |
| Versi iOS/Safari          |                |
| Camera berhasil           | Ya/Tidak       |
| Photo Library berhasil    | Ya/Tidak       |
| Format input aktual       |                |
| Jumlah/ukuran upload      |                |
| Skeleton/lightbox         | Lulus/Gagal    |
| Zoom input/overflow       | Lulus/Gagal    |
| Rotasi portrait/landscape | Lulus/Gagal    |
| Durasi dan catatan        |                |

## Backup, Migration, And Rollback

1. Catat release SHA, migration terakhir, operator, dan waktu maintenance.
2. Buat backup/PITR marker sebelum `supabase db push`; verifikasi timestamp/status backup dapat
   dibaca dari dashboard dan catat retention window. Jika hasil CLI masih `backups: null` atau
   `pitr_enabled: false`, hentikan release sebelum migration production.
3. Push migration ke staging, lalu jalankan smoke semua role: admin, manager, supervisor, dan akun
   nonaktif.
4. Uji restore backup staging/production ke database disposable. Verifikasi users, branch scope,
   roster historis, score, mentoring evidence metadata, dan notification feed. Jangan melakukan
   restore drill di atas project production. Jalankan recovery Storage sebagai drill terpisah karena
   restore database ke project baru tidak menyalin bucket/object.
5. Push migration production dalam urutan repository. Jangan menjalankan `supabase db reset` pada
   production.
6. Jika gagal, hentikan traffic mutasi, simpan log/request ID, rollback code ke SHA sebelumnya,
   kemudian ikuti prosedur restore yang disetujui DBA. Jangan menghapus migration yang sudah
   diterapkan.

## Smoke Test Per Role

- Admin: setup/user management, outlet/cashier, role permission, period preflight/close, dashboard.
- Manager: hanya branch yang ditugaskan, cashier/outlet sesuai permission toggle, assessment,
  mentoring, leaderboard, notification.
- Supervisor: hanya operasi yang diaktifkan dan branch scope yang ditugaskan.
- Inactive user: redirect/login denial dan tidak dapat membaca atau menulis data/Storage.

Uji juga invite baru, invite expired/revoked, upload avatar private, transfer cashier, assessment
incomplete, closed-period leaderboard, dan logout pada setiap release yang menyentuh domain tersebut.

## Cron And Monitoring

Jadwalkan `POST /api/cron/periods` dan `POST /api/cron/notifications` dengan header
`x-cron-secret`. Vercel Cron mengirim `Authorization: Bearer <CRON_SECRET>`; format ini juga
diterima oleh endpoint. Jadwalkan `GET /api/cron/mentoring-evidence-cleanup` untuk membersihkan
row `pending` dan object yang stale lebih dari dua jam. Cleanup diproses batch maksimal 100 row,
tidak pernah menghapus evidence `ready`, dan hanya menerima path object dengan format canonical.
Response `alreadyRemoved` berarti invocation lain telah lebih dulu menyelesaikan row yang sama dan
bukan kegagalan. `failed` tetap harus nol; nilai di atas nol memerlukan investigasi dan rerun.
Simpan `x-invocation-id`, status, durasi, dan response `requestId` pada log. Retry hanya untuk
kegagalan transient. Dedupe notification, closed-period operation, dan cleanup pending harus tetap
idempotent.

Vercel Cron terjadwal memanggil URL deployment production. Gunakan Preview hanya untuk manual route
smoke dengan Bearer secret yang benar; setelah rollout, periksa Settings > Cron Jobs dan runtime logs
production untuk memastikan scheduler benar-benar memanggil endpoint tanpa redirect.

Alert minimum:

- lonjakan `401`, `403`, `429`, dan `5xx`;
- cron tidak berjalan atau menghasilkan error berulang;
- kegagalan migration/build atau signed avatar URL;
- perubahan role/status user di luar change window.

Manual cleanup verification (staging first): gunakan `GET /api/cron/mentoring-evidence-cleanup`
dengan `Authorization: Bearer $CRON_SECRET` dan simpan `x-invocation-id` serta response counts.
Validasi 2026-08-12 setelah rotasi secret menghasilkan `200` pada branch alias dan deployment unik;
keduanya melaporkan scanned/removed/failed/remaining `0/0/0/0`.
Validasi commit `8045dab` memproses backlog 101 row dalam dua request:
scanned/removed/alreadyRemoved/failed/remaining `100/100/0/0/1`, lalu `1/1/0/0/0`. Dua request
bersamaan pada enam row menghasilkan total removed/alreadyRemoved/failed `6/6/0` dan remaining `0`.
Query read-only untuk capacity dan backlog:

```sql
select status, count(*) as objects, coalesce(sum(byte_size), 0) as bytes
from public.mentoring_evidence
group by status
order by status;

select count(*) as stale_pending
from public.mentoring_evidence
where status = 'pending'
  and created_at < now() - interval '2 hours';
```

Jangan menghapus row `ready` atau object Storage secara manual untuk mengatasi backlog. Investigasi
request ID/invocation ID dan jalankan cleanup ulang setelah error Storage transient pulih.

## User Deactivation And Secret Rotation

Untuk menonaktifkan user, gunakan User Management dengan alasan audit. Verifikasi session baru,
RLS, API, dan Storage menolak akun tersebut; jangan menghapus history operasional.

Untuk rotasi secret, siapkan secret baru di secret manager, deploy, jalankan cron smoke, revoke
secret lama setelah overlap window, lalu pastikan tidak ada secret yang muncul di log. Rotasi
Supabase keys mengikuti prosedur dashboard Supabase dan harus diikuti redeploy server.

## PWA Cache Verification

Service worker hanya boleh cache asset publik. Gate otomatis `E2E_PWA=true npm run test:e2e` (PowerShell:
`$env:E2E_PWA='true'; npm run test:e2e`) pada production server memverifikasi registration, Cache Storage, asset publik, serta exclusion HTML
terautentikasi dan response `/api/*`. Setelah deploy, verifikasi juga signed Storage URL/foto kasir,
logout, login ulang, multi-tab, update worker, dan offline loading asset publik. Jika cache lama
tersisa, naikkan `CACHE_NAME` pada `public/sw.js` dan deploy ulang.

## Incident Checklist

1. Catat waktu, environment, release SHA, actor, endpoint, `requestId`, dan `invocationId`.
2. Batasi atau hentikan operasi yang memperbesar dampak; jangan mengubah bukti audit.
3. Reproduksi di staging dengan data sintetis.
4. Perbaiki code/migration melalui review dan quality gate.
5. Validasi rollback/restore, lalu dokumentasikan root cause dan corrective action.

## Referensi Operasional

- [Supabase Restore to a New Project](https://supabase.com/docs/guides/platform/clone-project)
- [Supabase Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Vercel Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
