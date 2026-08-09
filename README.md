# KPI Kasir Rajaklana

Aplikasi internal untuk mengelola penilaian performa kasir, skor periode,
leaderboard, pendampingan outlet, struktur cabang, dan undangan pengguna.

## Status

Build lokal saat ini berhasil, tetapi aplikasi belum boleh dianggap production-ready.
Lihat [Technical Audit](docs/TECHNICAL_AUDIT.md), terutama blocker keamanan P0.

## Stack

- Next.js App Router 15.x, React 19, TypeScript strict
- Supabase Auth, PostgreSQL, Row Level Security, dan Storage
- Tailwind CSS, `lucide-react`, `motion`, `react-easy-crop`
- Vitest untuk unit test dan Playwright untuk rencana E2E

## Quick Start

Prasyarat: Node.js 20 LTS, npm, Docker Desktop, dan Supabase CLI.

```bash
npm install
copy .env.example .env.local
supabase start
supabase status
supabase db reset
npm run dev
```

Buka `http://localhost:3000`. Nilai URL dan key Supabase lokal ke `.env.local`.
Jangan pernah memasukkan service-role key ke kode client atau repository.

## Commands

| Command                                                         | Tujuan                                    |
| --------------------------------------------------------------- | ----------------------------------------- |
| `npm run dev`                                                   | Development server                        |
| `npm run typecheck`                                             | Pemeriksaan TypeScript                    |
| `npm run lint`                                                  | ESLint Next.js                            |
| `npm test`                                                      | Unit test Vitest                          |
| `npm run build`                                                 | Production build                          |
| `npm run test:e2e`                                              | Playwright, setelah folder `e2e` tersedia |
| `supabase db reset`                                             | Reset DB lokal, migrasi, dan seed         |
| `supabase gen types typescript --local > src/types/database.ts` | Generate tipe DB                          |

## Documentation

- [Developer Guide](docs/DEVELOPER_GUIDE.md): setup, arsitektur, alur fitur, API, database,
  testing, deployment, dan troubleshooting.
- [Technical Audit](docs/TECHNICAL_AUDIT.md): temuan, risiko, bukti, dan prioritas perbaikan.
- [Product specification](plan.md)
- [PRD](prd.md)
- [Technical specification](technical-spec.md)
- [Testing checklist](testing-qa-checklist.md)
- [Development and maintenance plan](development-maintenance-plan.md)

## High-Level Modules

- Setup awal, login email/password, Google OAuth, dan invite sekali pakai.
- Role `admin`, `manager`, dan `supervisor` dengan permission yang dapat ditoggle.
- Cabang, outlet, kasir, foto profil, tanggal mulai kerja, status aktif, dan riwayat mutasi.
- Kategori/detail penilaian dengan tipe skala dan deduksi.
- Periode bulanan, perhitungan skor PostgreSQL, skor kumulatif, dan leaderboard.
- Pendampingan outlet dengan catatan per kasir dan cursor-based infinite scroll.
- Notifikasi reminder dan alert skor rendah.

## Release Gate

Sebelum produksi, wajib lulus:

1. Perbaikan blocker keamanan di audit.
2. Migrasi database dan RLS diuji pada staging terpisah.
3. E2E untuk setup, invite, isolasi cabang, penilaian, foto, periode, dan mentoring.
4. `npm run typecheck`, `npm run lint`, `npm test`, dan `npm run build`.
5. Backup database, konfigurasi cron, smoke test, dan rollback plan.
