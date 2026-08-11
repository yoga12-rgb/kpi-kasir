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

Status 2026-08-11 22:49 WIB:

- Supabase staging: `kpi-kasir-staging` (`fkanacflupmyuohkjque`), region `ap-northeast-2`.
- Migrasi staging: lokal/remote sinkron `0001..0058`; dry-run up-to-date dan remote DB lint nol
  temuan.
- Bucket `mentoring-evidence`: private, maksimum 358400 byte, hanya `image/webp`.
- Production `gxnlhtqnfgcbkfqoxpoa` tidak disentuh dan terakhir diverifikasi pada migrasi `0057`.
- Vercel Preview branch `staging` commit `5cb14ed` berhasil dideploy dan setup admin selesai.
- Preview tetap dilindungi Vercel Authentication; gunakan Protection Bypass for Automation untuk
  smoke terotomasi, bukan mematikan proteksi atau membagikan kredensial admin.
- Protection bypass tervalidasi dari `.env.local` yang diabaikan Git. Flag-off smoke lulus: API
  tanpa session `401`, API authenticated `200`, lima route inti, sesi `201`, evidence 0, dan cleanup
  admin sintetis 1->1.

Environment Vercel Preview memakai URL dan API key dari staging, origin deployment Preview,
`CRON_SECRET` khusus staging, serta `MENTORING_EVIDENCE_UPLOAD_ENABLED=false` untuk deploy pertama.
Setup singleton dan remote anon/RPC smoke sudah lulus. Jangan mencatat nilai key, bypass token, atau
secret di dokumen ini.

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
`x-cron-secret`. Vercel Cron mengirim `Authorization: Bearer <CRON_SECRET>`; format ini juga
diterima oleh endpoint. Jadwalkan `GET /api/cron/mentoring-evidence-cleanup` untuk membersihkan
row `pending` dan object yang stale lebih dari dua jam. Cleanup diproses batch maksimal 100 row,
tidak pernah menghapus evidence `ready`, dan hanya menerima path object dengan format canonical.
Simpan `x-invocation-id`, status, durasi, dan response `requestId` pada log. Retry hanya untuk
kegagalan transient. Dedupe notification, closed-period operation, dan cleanup pending harus tetap
idempotent.

Alert minimum:

- lonjakan `401`, `403`, `429`, dan `5xx`;
- cron tidak berjalan atau menghasilkan error berulang;
- kegagalan migration/build atau signed avatar URL;
- perubahan role/status user di luar change window.

Manual cleanup verification (staging first): gunakan `GET /api/cron/mentoring-evidence-cleanup`
dengan `Authorization: Bearer $CRON_SECRET` dan simpan `x-invocation-id` serta response counts.
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
