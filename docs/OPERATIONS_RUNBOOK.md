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

## Backup, Migration, And Rollback

1. Catat release SHA, migration terakhir, operator, dan waktu maintenance.
2. Buat backup/PITR marker sebelum `supabase db push`; verifikasi backup dapat dibaca.
3. Push migration ke staging, lalu jalankan smoke semua role: admin, manager, supervisor, dan akun
   nonaktif.
4. Uji restore backup staging ke database disposable. Verifikasi users, branch scope, roster
   historis, score, Storage private, dan notification feed.
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
`x-cron-secret`. Simpan `x-invocation-id`, status, durasi, dan response `requestId` pada log.
Retry hanya untuk kegagalan transient. Dedupe notification dan closed-period operation harus tetap
idempotent.

Alert minimum:

- lonjakan `401`, `403`, `429`, dan `5xx`;
- cron tidak berjalan atau menghasilkan error berulang;
- kegagalan migration/build atau signed avatar URL;
- perubahan role/status user di luar change window.

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
