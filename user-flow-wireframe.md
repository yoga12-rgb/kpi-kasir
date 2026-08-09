# User Flow & Wireframe — Aplikasi KPI & Ranking Kasir Rajaklana

> Dokumen ini adalah **User Flow & Wireframe** yang disusun mengacu pada `plan.md`, `prd.md`, dan `technical-spec.md`.
> Wireframe di sini berupa **low-fidelity (ASCII/teks)** sebagai acuan desain UI sebelum implementasi. UI bersifat generik/netral.
> Status: Draft awal — akan diperbarui saat implementasi UI.

---

## 1. Struktur Navigasi Umum (App Shell)

### 1.1 App Shell — Layout Dasar (Mobile)

```
┌────────────────────────────────┐
│ App Bar / Action Bar           │   ← judul halaman, aksi kontekstual
├────────────────────────────────┤
│                                │
│        (KONTEN HALAMAN)        │   ← scrollable, pull-to-refresh
│                                │
├────────────────────────────────┤
│ Bottom Navigation (mobile)     │   ← Beranda | Nilai | Leaderboard | Lainnya
└────────────────────────────────┘
```

- **App Bar**: judul, tombol aksi (tambah, filter, notifikasi).
- **Bottom Navigation** (mobile-first): Beranda (Dashboard), Nilai (Penilaian), Leaderboard, Lainnya (Menu: Pendampingan, Pengaturan, About).
- **List/Data**: komponen reusable `DataList` — lazy load, infinite scroll, filter, pull-to-refresh.

### 1.2 Menu per Role

| Menu | Administrator | Manager/Supervisor |
| --- | --- | --- |
| Dashboard | ✓ (semua cabang) | ✓ (cabang ditugaskan) |
| Setup Wizard | Hanya pertama kali | ✗ |
| Kelola Cabang/Outlet | ✓ | ✗ |
| Kelola Kasir | ✓ (semua) | ✓ (cabang ditugaskan) |
| Konfigurasi Kategori/Detail | ✓ | ✗ (baca saja) |
| Input Penilaian | ✓ | ✓ (cabang ditugaskan) |
| Kelola Deduksi | ✓ | ✓ (cabang ditugaskan) |
| Sesi Pendampingan | ✓ (semua) | ✓ (cabang ditugaskan) |
| Leaderboard | ✓ (semua level) | ✓ (level dalam cabangnya) |
| Kelola Akun & Invite | ✓ | ✗ |
| Notifikasi | ✓ | ✓ |
| About | ✓ | ✓ |

---

## 2. Flow: Setup Awal Aplikasi

### 2.1 Alur

```
[Buka aplikasi pertama kali]
        │
        ▼
[Middleware & Root page: cek app_setup.admin_created]
        │
        ├─ admin belum ada ──► [Redirect ke /setup] ─► Setup Wizard
        │
        └─ admin sudah ada ──► [Belum login ─► /login]
                              [Sudah login ─► /dashboard]
```

### 2.2 Wireframe: Halaman `/setup` (Onboarding Wizard)

```
┌────────────────────────────────┐
│ ● ● ○ ○   Setup — 1/4         │   ← StepIndicator
├────────────────────────────────┤
│  Selamat datang di             │
│  KPI Kasir Rajaklana           │
│                                │
│  Buat akun Administrator       │
│  pertama untuk memulai.        │
│                                │
│  Nama lengkap    [________]   │
│  Email           [________]   │
│  Password        [________]   │
│                                │
│         [  Lanjut  →  ]        │
└────────────────────────────────┘
```

> Langkah wizard: 1) Info admin → 2) Struktur Cabang/Outlet → 3) Kategori & Detail Penilaian → 4) Ringkasan & Selesai.
> Setelah selesai: `app_setup.admin_created = true`, redirect ke `/login`.

---

## 3. Flow: Autentikasi & Invite

### 3.1 Login

```
/login
├─ Tab: Email & Password
│   Email [____]  Password [____]  [Masuk]
│   [Lanjut dengan Google]
└─ Redirect sesuai role:
    ├─ admin → /dashboard (semua cabang)
    └─ manager/supervisor → /dashboard (cabang ditugaskan)
```

### 3.2 Invite Manager/Supervisor (oleh Administrator)

```
[Admin: Pengaturan → Undang Pengguna]
        │
        ▼
[Form: email, role (Manager/Supervisor), pilih 1+ Cabang]
        │
        ▼
[Sistem buat invite: token unik, expires_at]
        │
        ▼
[Tampilkan link invite + tombol salin. Dikirim manual oleh Admin (email/WA)]
        │
        ▼
[User buka link → /invite/[token] → form registrasi]
        │
        ├─ Email sudah terpakai? → error "Email sudah terdaftar"
        ├─ Token invalid/kedaluwarsa → halaman error invite
        └─ Sukses → akun dibuat + user_branch diisi → redirect /login
```

### 3.3 Wireframe: Halaman Undang Pengguna

```
┌────────────────────────────────┐
│ ← Pengaturan    [＋ Undang]    │
├────────────────────────────────┤
│  Undang Manager/Supervisor     │
│  Email  [_____________]        │
│  Role   (•) Manager  ( ) Supervisor │
│  Cabang [▾ Pilih cabang...]    │
│         ✓ Cabang A             │
│         ✓ Cabang B             │
│  [Buat Link Undangan]          │
│  ─────────────────────────     │
│  Link:                         │
│  https://app/.../inv/yK3x...   │
│  [Salin]  Kedaluwarsa: 7 hari  │
└────────────────────────────────┘
```

---

## 4. Flow: Kelola Struktur Organisasi

### 4.1 Kelola Cabang & Outlet (Administrator)

```
[Dashboard admin → Menu Cabang]
   ├─ List Cabang (DataList, filter, infinite scroll)
   │    ├─ Tap cabang → detail cabang
   │    │    ├─ Tab Outlet: list outlet (tap → detail outlet → kasir)
   │    │    ├─ Tab Leaderboard cabang
   │    │    └─ Aksi: Nonaktifkan cabang (konfirmasi)
   │    └─ [＋ Tambah Cabang] → form nama/kode → simpan
   └─ Detail Outlet:
        ├─ Tab Kasir: list kasir → detail kasir
        ├─ Tab Pendampingan: riwayat sesi outlet
        ├─ Leaderboard outlet
        └─ Aksi: Nonaktifkan outlet
```

### 4.2 Kelola Kasir (Admin / Manager-Supervisor di cabangnya)

```
[Outlet → Tab Kasir → ＋ Tambah Kasir]
Form: Nama [____] → Simpan → kasir masuk outlet aktif.

Detail Kasir:
├─ Info: nama, outlet aktif, status
├─ Tab Penilaian: skor periode berjalan + riwayat per periode
├─ Tab Riwayat: penilaian & pendampingan (data ikut saat mutasi)
└─ Aksi:
   ├─ Mutasi Outlet → pilih outlet baru → konfirmasi (tulis cashier_outlet_history)
   └─ Nonaktifkan → konfirmasi (riwayat tetap tersimpan)
```

### 4.3 Wireframe: Detail Kasir

```
┌────────────────────────────────┐
│ ← Kasir        [⋯ Aksi]        │
├────────────────────────────────┤
│  👤 Nama Kasir                 │
│  Outlet: Outlet A — Cabang 1   │
│  Status: Aktif                 │
│  ─────────────────────────     │
│  Skor Periode Berjalan  ▁▃▅▇   │
│  Skor Akhir        : 87.5      │
│  Kategori Kebersihan: 90       │
│  Kategori Layanan  : 85        │
│  ─────────────────────────     │
│  [Tab] Penilaian | Pendampingan│
│  (DataList riwayat)            │
└────────────────────────────────┘
```

---

## 5. Flow: Konfigurasi Penilaian (Administrator)

### 5.1 Kelola Kategori & Detail

```
[Pengaturan → Kategori Penilaian]
├─ List Kategori: nama + bobot % (DataList)
│    ├─ Tap kategori → detail: list Detail
│    │    ├─ Detail tipe Skala: nama, skala maks
│    │    ├─ Detail tipe Deduksi: nama, poin per kejadian
│    │    └─ Aksi detail: edit / nonaktifkan
│    └─ [＋ Kategori] → form: nama, bobot %
│
├─ Validasi: total bobot harus 100% → tampil indikator
│   "Total bobot: 80% — belum 100%"
│
└─ Simpan perubahan bobot/poin:
    "Perubahan berlaku mulai periode berikutnya." (info non-retroaktif)
```

### 5.2 Wireframe: Form Kategori

```
┌────────────────────────────────┐
│ ← Kategori    [Simpan]         │
├────────────────────────────────┤
│  Nama [Kebersihan & Kerapian ] │
│  Bobot (%) [ 25 ]              │
│  ─────────────────────────     │
│  Total bobot semua kategori:   │
│  100% ✓                        │
│  ℹ️ Perubahan bobot berlaku    │
│     mulai periode berikutnya.  │
└────────────────────────────────┘
```

---

## 6. Flow: Input Penilaian

### 6.1 Alur Umum

```
[Menu "Nilai" → daftar kasir yang perlu dinilai (cabang user)]
        │
        ▼
[Tap kasir → halaman penilaian kasir pada periode berjalan]
        │
        ├─ [Mode: per Kategori] → form semua detail satu kategori
        │    ├─ Detail Skala  → input angka rentang 0–skala maks (slider/stepper)
        │    └─ Detail Deduksi → tampil total poin + [＋ Catat Kejadian]
        │
        └─ [Mode: per Detail] → pilih detail → input/kejadian
        │
        ▼
[Simpan → sistem hitung ulang cashier_period_score]
        │
        ▼
[Toast "Penilaian tersimpan" + skor terbaru tampil]
```

### 6.2 Input Detail Skala

```
┌────────────────────────────────┐
│ ← Penilaian: Budi (Periode 8)  │
├────────────────────────────────┤
│ Kategori: Kebersihan (25%)     │
│  Detail: Kerapian Seragam      │
│  Skala 0 – 5                   │
│        [───●────]  4 / 5       │
│  (normalisasi otomatis: 80)    │
│                             │
│ Kategori: Layanan (25%)        │
│  ...                           │
├────────────────────────────────┤
│           [Simpan Penilaian]   │
└────────────────────────────────┘
```

### 6.3 Input Deduksi (per Kejadian)

```
┌────────────────────────────────┐
│ ← Detail: Keluhan Pelanggan    │
│  Tipe Deduksi · -5 poin/kejadian│
├────────────────────────────────┤
│  Skor awal          : 100      │
│  Total kejadian     : 2        │
│  Poin terpotong     : -10      │
│  Skor detail        : 90       │
│  ─────────────────────────     │
│  Riwayat kejadian:             │
│  • 02/08 -5 "Komplain 1"  [✕] │
│  • 05/08 -5 "Komplain 2"  [✕] │
│  ─────────────────────────     │
│  [＋ Catat Kejadian]           │
│    Catatan [______________]    │
│    Tanggal [08/08/2026]        │
│    [Tambah]                    │
└────────────────────────────────┘
```

> Poin per kejadian diambil dari konfigurasi detail (bukan input bebas). Skor tidak bisa negatif (floor 0).

---

## 7. Flow: Sesi Pendampingan

### 7.1 Alur

```
[Menu "Lainnya" → Pendampingan]
├─ List sesi (DataList: tanggal, outlet, pelaksana, filter)
│    ├─ Tap sesi → detail: catatan umum outlet + catatan per kasir
│    └─ [＋ Sesi Baru]
│
[Form Sesi Baru]
├─ Outlet [▾ pilih outlet cabang user]
├─ Tanggal [tanggal kunjungan]
├─ Catatan umum outlet (opsional) [textarea]
├─ Kasir yang didampingi (pilih 1+ kasir di outlet)
│    └─ Catatan per kasir [textarea]
└─ [Simpan → toast sukses]
```

### 7.2 Wireframe: Form Sesi Baru

```
┌────────────────────────────────┐
│ ← Pendampingan   [Simpan]      │
├────────────────────────────────┤
│  Outlet [▾ Outlet A - Cabang 1]│
│  Tanggal [08/08/2026        ]  │
│  Catatan Umum Outlet (ops.)    │
│  [____________________________] │
│  ─────────────────────────     │
│  Kasir Didampingi              │
│  ✓ Budi        [catatan____]  │
│  ✓ Siti        [catatan____]  │
│  ☐ Andi        [ - ]          │
│  ─────────────────────────     │
│  Catatan per kasir diisi       │
│  setelah kasir dicentang.      │
└────────────────────────────────┘
```

> Pendampingan tidak memengaruhi skor (murni catatan kualitatif).

---

## 8. Flow: Leaderboard

### 8.1 Alur

```
[Menu "Leaderboard"]
├─ Filter level:
│   (•) Lintas Cabang  ( ) Per Cabang  ( ) Per Outlet
├─ Filter tambahan (jika level dipilih): pilih cabang/outlet
├─ Toggle: Skor Periode | Skor Akumulatif
├─ Tampilan: daftar peringkat + skor (DataList, infinite scroll)
│    ├─ Tap kasir → detail kasir
│    └─ [Export CSV] (opsional)
└─ Periode tertutup → menampilkan snapshot period tsb
```

### 8.2 Wireframe: Leaderboard

```
┌────────────────────────────────┐
│ Leaderboard      [⤓ Export]    │
├────────────────────────────────┤
│ Level: (•)Global ( )Cabang ( )Outlet │
│ Cabang [▾ Semua Cabang]        │
│ ─────────────────────────      │
│ [Tab] Periode | Akumulatif     │
│ ─────────────────────────      │
│ 🥇 1. Budi       87.5  ▲       │
│ 🥈 2. Siti       86.0  ▼       │
│ 🥉 3. Andi       84.2  ─       │
│  4. Dewi        81.0  ▲       │
│  ... (infinite scroll)         │
└────────────────────────────────┘
```

---

## 9. Flow: Periode & Notifikasi

### 9.1 Periode (Otomatis + Manual Admin)

```
[pg_cron / cron Vercel — tiap awal bulan]
        │
        ▼
[Close periode lama]
  ├─ Isi leaderboard_entry (rank per level, snapshot)
  ├─ Update cashier_cumulative_score
  └─ status period → closed
        │
        ▼
[Buka periode baru]
  ├─ Buat period baru (label, start/end)
  ├─ Snapshot bobot & config → category_weight_history / detail_config_history
  └─ Skor periode direset (assessment periode baru kosong)

[Override manual (Admin): Pengaturan → Periode]
  └─ [Tutup Periode Sekarang] / [Buka Periode Baru] + log di period_log
```

### 9.2 Notifikasi

```
[Reminder]  "Budi belum dinilai periode Agustus" (ke Supervisor/Manager cabang)
[Low Score] "Andi skor rendah 3 periode berturut-turut"
[Pusat Notifikasi] ikon 🔔 di App Bar → list notification (is_read toggle)
```

### 9.3 Wireframe: Pusat Notifikasi

```
┌────────────────────────────────┐
│ ← Notifikasi                  │
├────────────────────────────────┤
│ 🔔 Reminder: Budi belum        │
│    dinilai periode Agu 2026    │
│    • 2 jam lalu                │
│ ⚠️ Skor rendah: Andi 3×        │
│    berturut-turut di bawah 70  │
│    • kemarin                   │
│  ... (infinite scroll)         │
└────────────────────────────────┘
```

---

## 10. Halaman About

```
┌────────────────────────────────┐
│ ← Lainnya          [About]     │
├────────────────────────────────┤
│  KPI & Ranking Kasir           │
│  Rajaklana                     │
│  Versi 1.0.0                   │
│  ─────────────────────────     │
│  Dibuat oleh:                  │
│  Yoga Sptriana                 │
│  [Instagram: @mang.agooy]     │
│  https://www.instagram.com/    │
│  mang.agooy/                   │
└────────────────────────────────┘
```

---

## 11. Matriks Alur vs Role

| Fitur | Administrator | Manager/Supervisor |
| --- | --- | --- |
| Setup wizard | ✓ (1×) | ✗ |
| Kelola Cabang/Outlet | ✓ | ✗ |
| Kelola Kasir | ✓ semua cabang | ✓ cabang ditugaskan |
| Konfigurasi Kategori/Detail | ✓ | baca saja |
| Input/edit/hapus Penilaian | ✓ semua | ✓ cabang ditugaskan |
| Catat kejadian Deduksi | ✓ | ✓ cabang ditugaskan |
| Sesi Pendampingan | ✓ semua | ✓ cabang ditugaskan |
| Leaderboard | ✓ semua level | ✓ level dalam cabangnya |
| Kelola akun & invite | ✓ | ✗ |
| Notifikasi | ✓ | ✓ |
| Tutup/buka periode manual | ✓ | ✗ |

---

## 12. Referensi

- `plan.md` — Spesifikasi Produk
- `prd.md` — Product Requirements Document
- `technical-spec.md` — Spesifikasi Teknis
- `milestone.md` — Tahapan pengerjaan
- `testing-qa-checklist.md` — Skenario pengujian
- `development-maintenance-plan.md` — Proses development & maintenance