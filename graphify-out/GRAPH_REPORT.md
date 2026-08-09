# Graph Report - kpi-kasir-v2  (2026-08-09)

## Corpus Check
- 162 files · ~67,915 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 802 nodes · 1577 edges · 43 communities (38 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- createClient
- Button.tsx
- utils.ts
- guards.ts
- dependencies
- database.ts
- devDependencies
- MentoringList.tsx
- createAdminClient
- compilerOptions
- category.ts
- normalize.ts
- middleware.ts
- extends
- app/layout.tsx
- next.config.mjs
- postcss.config.mjs
- sw.js
- tailwind.config.ts
- Spesifikasi Teknis — Aplikasi KPI & Ranking Kasir Rajaklana
- outlets/[id]/page.tsx
- User Flow & Wireframe — Aplikasi KPI & Ranking Kasir Rajaklana
- P2 - Risiko Menengah
- Developer Guide
- PRD — Aplikasi KPI & Ranking Kasir Rajaklana
- Development & Maintenance Plan — Aplikasi KPI & Ranking Kasir Rajaklana
- requireAdmin
- 2. Detail Tiap Milestone
- Testing & QA Checklist — Aplikasi KPI & Ranking Kasir Rajaklana
- server.ts
- Spesifikasi Produk: Aplikasi KPI & Ranking Kasir — Rajaklana
- categories/[id]/route.ts
- login/page.tsx
- mentoring-sessions/route.ts
- .prettierrc.json
- KPI Kasir Rajaklana
- 8. Alur Kerja Utama
- 3. Role & Hak Akses
- assessments/route.ts

## God Nodes (most connected - your core abstractions)
1. `createClient()` - 104 edges
2. `requirePermission()` - 53 edges
3. `cn()` - 29 edges
4. `requireRole()` - 25 edges
5. `createAdminClient()` - 24 edges
6. `Button` - 22 edges
7. `Card()` - 21 edges
8. `getErrorMessage()` - 21 edges
9. `getRolePermissions()` - 19 edges
10. `hasPermission()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `AboutPage()` --calls--> `requireUser()`  [EXTRACTED]
  src/app/(app)/about/page.tsx → src/lib/auth/guards.ts
- `NewBranchPage()` --calls--> `requireRole()`  [EXTRACTED]
  src/app/(app)/branches/new/page.tsx → src/lib/auth/guards.ts
- `NotificationsPage()` --calls--> `requirePermission()`  [EXTRACTED]
  src/app/(app)/notifications/page.tsx → src/lib/auth/guards.ts
- `GET()` --calls--> `createClient()`  [EXTRACTED]
  src/app/api/categories/route.ts → src/lib/supabase/server.ts
- `LoginPage()` --calls--> `createClient()`  [EXTRACTED]
  src/app/login/page.tsx → src/lib/supabase/server.ts

## Import Cycles
- None detected.

## Communities (43 total, 5 thin omitted)

### Community 0 - "createClient"
Cohesion: 0.19
Nodes (11): branchSchema, GET(), POST(), detailSchema, GET(), POST(), GET(), GET() (+3 more)

### Community 1 - "Button.tsx"
Cohesion: 0.07
Nodes (42): CashierAssessmentPage(), dynamic, NewBranchPage(), AssessmentForm(), CategoryWithDetails, LoginFormInner(), BranchEditForm(), BranchForm() (+34 more)

### Community 2 - "utils.ts"
Cohesion: 0.06
Nodes (58): dynamic, CashierDetailPage(), dynamic, MentoringDetailPage(), NotificationsPage(), CategoryDetailPage(), CategoriesPage(), PeriodsPage() (+50 more)

### Community 3 - "guards.ts"
Cohesion: 0.12
Nodes (17): deductionSchema, POST(), cashierSchema, GET(), POST(), DELETE(), PATCH(), GET() (+9 more)

### Community 4 - "dependencies"
Cohesion: 0.05
Nodes (40): clsx, date-fns, lucide-react, motion, next, dependencies, clsx, date-fns (+32 more)

### Community 5 - "database.ts"
Cohesion: 0.07
Nodes (30): requireBranchAccess(), requireCashierAccess(), getUserBranches(), SessionUser, AppNotification, AppSetup, Assessment, Branch (+22 more)

### Community 6 - "devDependencies"
Cohesion: 0.07
Nodes (27): autoprefixer, eslint, eslint-config-next, devDependencies, autoprefixer, eslint, eslint-config-next, @playwright/test (+19 more)

### Community 7 - "MentoringList.tsx"
Cohesion: 0.12
Nodes (13): DataListProps, BranchOption, fetchSessions(), Filters, getRelation(), MentoringList(), MentoringSessionItem, OutletOption (+5 more)

### Community 8 - "createAdminClient"
Cohesion: 0.15
Nodes (24): GET(), GET(), acceptSchema, POST(), GET(), inviteSchema, POST(), GET() (+16 more)

### Community 9 - "compilerOptions"
Cohesion: 0.07
Nodes (26): dom, dom.iterable, esnext, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts, **/*.tsx (+18 more)

### Community 10 - "category.ts"
Cohesion: 0.38
Nodes (5): calculateCategoryScore(), calculateFinalScore(), CategoryScoreInput, CategoryScoreResult, FinalScoreInput

### Community 11 - "normalize.ts"
Cohesion: 0.67
Nodes (4): normalizeDeduction(), normalizeDetail(), normalizeScale(), NormalizeScaleInput

### Community 12 - "middleware.ts"
Cohesion: 0.40
Nodes (5): config, CookieToSet, isPublicPath(), middleware(), publicPaths

### Community 13 - "extends"
Cohesion: 0.50
Nodes (3): extends, next/core-web-vitals, next/typescript

### Community 21 - "Spesifikasi Teknis — Aplikasi KPI & Ranking Kasir Rajaklana"
Cohesion: 0.04
Nodes (46): 10. Referensi, 1. Ringkasan Arsitektur, 2. Keputusan Teknis (ADR Ringkas), 3.1 Tabel Master, 3.2 Konfigurasi Penilaian, 3.3 Periode & Penilaian, 3.4 Skor Tersimpan (Snapshot), 3.5 Pendampingan (+38 more)

### Community 22 - "outlets/[id]/page.tsx"
Cohesion: 0.13
Nodes (25): ALLOWED_EXT, getCashierBranch(), hasBranchAccess(), POST(), BranchDetailPage(), DashboardPage(), MenuPage(), OutletDetailPage() (+17 more)

### Community 23 - "User Flow & Wireframe — Aplikasi KPI & Ranking Kasir Rajaklana"
Cohesion: 0.06
Nodes (35): 10. Halaman About, 11. Matriks Alur vs Role, 12. Referensi, 1.1 App Shell — Layout Dasar (Mobile), 1.2 Menu per Role, 1. Struktur Navigasi Umum (App Shell), 2.1 Alur, 2.2 Wireframe: Halaman `/setup` (Onboarding Wizard) (+27 more)

### Community 24 - "P2 - Risiko Menengah"
Cohesion: 0.06
Nodes (31): 1. Evidence, 2. Ringkasan Arsitektur, 3. Findings Prioritas, 4. Hal yang Sudah Baik, 5. Roadmap Rekomendasi, 6. Kesimpulan, P0-1: User dapat menaikkan role sendiri melalui RLS, P0-2: Policy write permisif masih aktif pada tabel operasional (+23 more)

### Community 25 - "Developer Guide"
Cohesion: 0.06
Nodes (31): 10. Alur Fitur Penting, 11. Setup Development, 12. Database Workflow, 13. Testing dan Quality Gates, 14. Deployment, 15. Troubleshooting, 16. Developer Checklist, 1. Tujuan Produk (+23 more)

### Community 26 - "PRD — Aplikasi KPI & Ranking Kasir Rajaklana"
Cohesion: 0.07
Nodes (29): 10. Risiko & Mitigasi, 11. Referensi & Dokumen Terkait, 1. Ringkasan Eksekutif, 2.1 Tujuan Produk, 2.2 Metrik Kesuksesan, 2. Tujuan & Metrik Kesuksesan, 3.1 In Scope (MVP), 3.2 Out of Scope (+21 more)

### Community 27 - "Development & Maintenance Plan — Aplikasi KPI & Ranking Kasir Rajaklana"
Cohesion: 0.08
Nodes (25): 10. Kontak & Referensi, 11. Checklist Implementasi (Status Aktual), 12. Referensi, 1.1 Prinsip Kerja, 1.2 Alur Kerja Harian Agent, 1. Strategi Development, 2.1 Arsitektur Environment Lokal, 2.2 Prasyarat (+17 more)

### Community 28 - "requireAdmin"
Cohesion: 0.12
Nodes (17): DELETE(), PATCH(), updateSchema, DELETE(), PATCH(), updateSchema, POST(), transferSchema (+9 more)

### Community 29 - "2. Detail Tiap Milestone"
Cohesion: 0.11
Nodes (17): 1. Ringkasan Tahapan, 2. Detail Tiap Milestone, 3. Kriteria Penolakan Rilis (Release Gates), 4. Backlog Opsional (Pasca-MVP), 5. Referensi, M0 — Foundation & Setup, M10 — Deploy & Rilis, M1 — Database & Auth (+9 more)

### Community 30 - "Testing & QA Checklist — Aplikasi KPI & Ranking Kasir Rajaklana"
Cohesion: 0.13
Nodes (15): 10. PWA & UI/UX, 11. Keamanan & Integritas Data, 12. Regresi & Smoke Test (Sebelum Rilis), 13. Catatan Eksekusi, 14. Referensi, 1. Lingkup Pengujian, 2. Setup Awal & Autentikasi, 3. Master Data (Cabang / Outlet / Kasir) (+7 more)

### Community 31 - "server.ts"
Cohesion: 0.24
Nodes (9): dynamic, GET(), LeaderboardRow, AssessmentPage(), CashiersPage(), dynamic, NewMentoringPage(), getCashierAvatarUrls() (+1 more)

### Community 32 - "Spesifikasi Produk: Aplikasi KPI & Ranking Kasir — Rajaklana"
Cohesion: 0.17
Nodes (12): 10. Leaderboard, 11. UI/UX, 12. Kebutuhan Teknis, 13. Dokumen yang Harus Dibuat AI Agent Sebelum Development, 1. Ringkasan Produk, 2. Struktur Entitas, 4. Autentikasi & Manajemen Akun, 5. Konfigurasi Penilaian (+4 more)

### Community 33 - "categories/[id]/route.ts"
Cohesion: 0.26
Nodes (9): DELETE(), PATCH(), updateSchema, categorySchema, GET(), POST(), SupabaseClient, validateCategoryWeightChange() (+1 more)

### Community 34 - "login/page.tsx"
Cohesion: 0.21
Nodes (8): AboutPage(), LoginPage(), metadata, metadata, SetupPage(), LoginForm(), BrandLogo(), SetupWizard()

### Community 35 - "mentoring-sessions/route.ts"
Cohesion: 0.27
Nodes (9): cursorSchema, dateSchema, decodeCursor(), encodeCursor(), GET(), getAccessibleBranchIds(), listQuerySchema, POST() (+1 more)

### Community 36 - ".prettierrc.json"
Cohesion: 0.25
Nodes (7): plugins, printWidth, semi, singleQuote, tabWidth, trailingComma, prettier-plugin-tailwindcss

### Community 37 - "KPI Kasir Rajaklana"
Cohesion: 0.25
Nodes (8): Commands, Documentation, High-Level Modules, KPI Kasir Rajaklana, Quick Start, Release Gate, Stack, Status

### Community 39 - "8. Alur Kerja Utama"
Cohesion: 0.40
Nodes (5): 8.1 Setup Awal, 8.2 Operasional Harian, 8.3 Penutupan Periode, 8.4 Notifikasi, 8. Alur Kerja Utama

### Community 40 - "3. Role & Hak Akses"
Cohesion: 0.50
Nodes (4): 3. Role & Hak Akses, Administrator, Kasir, Manager & Supervisor

### Community 41 - "assessments/route.ts"
Cohesion: 0.67
Nodes (3): assessmentSchema, PATCH(), POST()

## Knowledge Gaps
- **386 isolated node(s):** `next/core-web-vitals`, `next/typescript`, `semi`, `singleQuote`, `tabWidth` (+381 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createClient()` connect `createClient` to `categories/[id]/route.ts`, `Button.tsx`, `guards.ts`, `mentoring-sessions/route.ts`, `utils.ts`, `login/page.tsx`, `database.ts`, `createAdminClient`, `assessments/route.ts`, `outlets/[id]/page.tsx`, `requireAdmin`, `server.ts`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Why does `Spesifikasi Teknis — Aplikasi KPI & Ranking Kasir Rajaklana` connect `Spesifikasi Teknis — Aplikasi KPI & Ranking Kasir Rajaklana` to `README.md`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `Developer Guide` connect `Developer Guide` to `README.md`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `next/core-web-vitals`, `next/typescript`, `semi` to the rest of the system?**
  _386 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Button.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06672519754170325 - nodes in this community are weakly interconnected._
- **Should `utils.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06022282445046673 - nodes in this community are weakly interconnected._
- **Should `guards.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12433862433862433 - nodes in this community are weakly interconnected._