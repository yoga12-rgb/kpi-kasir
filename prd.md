# PRD — Aplikasi KPI & Ranking Kasir Rajaklana

> Dokumen ini adalah **Product Requirements Document (PRD)** yang disusun mengacu pada `plan.md` sebagai sumber tunggal spesifikasi produk.
> Status: Draft awal — akan selalu diperbarui seiring perkembangan proyek.

---

## 1. Ringkasan Eksekutif

Aplikasi web **PWA internal** untuk Rajaklana yang digunakan untuk:

1. Menilai performa kasir di seluruh cabang & outlet secara terstruktur dan terstandar.
2. Menghasilkan **skor** dan **ranking (leaderboard)** pada level outlet, cabang, maupun lintas cabang.
3. Mencatat **pendampingan lapangan** oleh Manager/Supervisor sebagai catatan kualitatif terpisah dari penilaian.

### Karakteristik Utama

| Aspek | Keputusan |
| --- | --- |
| Integrasi | Standalone, tidak terintegrasi aplikasi absensi |
| Struktur organisasi | Cabang > Outlet > Kasir, sepenuhnya dinamis (tidak hardcode) |
| Skala | Kecil, khusus internal Rajaklana (bukan multi-tenant/SaaS) |
| Platform | Web PWA, mobile-first, App Shell, static route |
| Stack | Next.js + Supabase + Vercel + Tailwind CSS |

---

## 2. Tujuan & Metrik Kesuksesan

### 2.1 Tujuan Produk

- **T1. Standarisasi penilaian** — semua kasir dinilai dengan kategori, detail, dan bobot yang konsisten.
- **T2. Transparansi performa** — skor dan ranking kasir dapat dilihat di semua level organisasi.
- **T3. Peningkatan kualitas** — mendorong perbaikan berkelanjutan melalui penilaian berkala + pendampingan lapangan.
- **T4. Efisiensi operasional** — alur input penilaian dan deduksi sederhana, mobile-first, cepat digunakan Supervisor/Manager di lapangan.

### 2.2 Metrik Kesuksesan

| Metrik | Target |
| --- | --- |
| Kelengkapan penilaian (kasir ternilai / total kasir aktif per periode) | ≥ 90% periode berjalan |
| Waktu input satu penilaian lengkap | ≤ 5 menit |
| Adopsi akun (Manager/Supervisor aktif mengisi) | ≥ 80% akun terundang |
| Keterlambatan buka/tutup periode | 0 (otomatis sistem) |
| Skor rata-rata outlet/cabang bisa dijadikan bahan perbaikan | terpantau tiap bulan |

---

## 3. Ruang Lingkup

### 3.1 In Scope (MVP)

1. Setup wizard untuk membuat akun **Administrator pertama**.
2. Autentikasi: email+password, **Google OAuth**, dan **link invite** untuk Manager/Supervisor.
3. Manajemen organisasi dinamis: **Cabang**, **Outlet**, **Kasir** (termasuk mutasi outlet & nonaktifkan).
4. Konfigurasi penilaian: **Kategori Penilaian** (bobot %), **Detail Penilaian** (tipe Skala / Deduksi, skala maks, poin deduksi per kejadian).
5. Input penilaian: per kategori sekaligus atau per detail satu-satu; deduksi dicatat per kejadian.
6. Perhitungan skor otomatis (dengan aturan non-retroaktif perubahan bobot/poin).
7. Periode penilaian otomatis (bulanan), reset skor periode, skor akumulatif berjalan.
8. Modul **Sesi Pendampingan** (terpisah dari penilaian, tidak memengaruhi skor).
9. **Leaderboard** dengan filter per outlet / per cabang / lintas cabang, menampilkan skor periode & akumulatif.
10. **Notifikasi**: reminder penilaian belum lengkap & alert skor rendah berturut-turut.
11. PWA: App Shell, installable, mobile-first.
12. Halaman **About** dengan credit ke **Yoga Sptriana** (https://www.instagram.com/mang.agooy/).

### 3.2 Out of Scope

- Integrasi dengan aplikasi absensi / sistem lain.
- Dukungan multi-tenant / SaaS (khusus Rajaklana).
- Akun untuk Kasir (kasir murni objek penilaian).
- Penghapusan permanen data penilaian, kategori, detail, cabang, outlet, kasir (hanya nonaktifkan).
- Periode penilaian fleksibel (wajib jadwal tetap otomatis, contoh: bulanan).

---

## 4. Persona & Peran

### 4.1 Administrator

- Akses **semua cabang**.
- Kelola akun Administrator/Manager/Supervisor.
- Kelola Cabang & Outlet.
- Kelola Kategori & Detail Penilaian (bobot, skala, poin deduksi).
- Lihat semua laporan, leaderboard, dan pendampingan.

### 4.2 Manager & Supervisor

- Hak akses **identik**, hanya berbeda label/jabatan (tanpa perbedaan privilege).
- Akses ke **cabang yang ditugaskan** (satu akun bisa ditugaskan ke lebih dari satu cabang).
- Tambah & kelola data Kasir di outlet cabangnya.
- Input, edit, hapus Penilaian secara bebas (di cabangnya).
- Catat Sesi Pendampingan.
- Lihat leaderboard & laporan sesuai cabang yang ditugaskan.

### 4.3 Kasir

- Tidak memiliki akun.
- Murni objek penilaian (but data: nama, outlet penempatan, status aktif).

---

## 5. Kebutuhan Fungsional

> ID format: `FR-<MODUL>-<NO>`. Prioritas: **Wajib (W)** = blockir rilis, **Penting (P)** = segera setelah MVP, **Opsional (O)** = enhancement.

### 5.1 Autentikasi & Akun (`FR-AUTH`)

| ID | Prioritas | Kebutuhan |
| --- | --- | --- |
| FR-AUTH-01 | W | Setup wizard membuat akun Administrator pertama saat aplikasi pertama dijalankan |
| FR-AUTH-02 | W | Login email+password untuk Administrator/Manager/Supervisor |
| FR-AUTH-03 | W | Login dengan Google OAuth |
| FR-AUTH-04 | W | Administrator membuat link invite untuk Manager/Supervisor (email + role + penugasan cabang) |
| FR-AUTH-05 | W | Link invite sekali pakai, punya masa kedaluwarsa |
| FR-AUTH-06 | W | Satu akun Manager/Supervisor bisa ditugaskan ke lebih dari satu Cabang |
| FR-AUTH-07 | W | Nonaktifkan akun pengguna tanpa menghapus data |
| FR-AUTH-08 | P | Reset password (email) & ubah profil |

### 5.2 Struktur Organisasi (`FR-ORG`)

| ID | Prioritas | Kebutuhan |
| --- | --- | --- |
| FR-ORG-01 | W | CRUD Cabang (nonaktifkan, tidak dihapus permanen) |
| FR-ORG-02 | W | CRUD Outlet di bawah satu Cabang (nonaktifkan, tidak dihapus permanen) |
| FR-ORG-03 | W | CRUD Kasir di bawah satu Outlet (nonaktifkan, tidak dihapus permanen) |
| FR-ORG-04 | W | Mutasi Kasir antar outlet; riwayat penilaian & pendampingan ikut pindah |
| FR-ORG-05 | P | Riwayat penempatan kasir terlihat (outlet lama → baru) |

### 5.3 Konfigurasi Penilaian (`FR-CFG`)

| ID | Prioritas | Kebutuhan |
| --- | --- | --- |
| FR-CFG-01 | W | CRUD Kategori Penilaian dengan bobot %; total seluruh kategori = 100% |
| FR-CFG-02 | W | Validasi total bobot kategori = 100% sebelum aktif |
| FR-CFG-03 | W | CRUD Detail Penilaian per Kategori, tipe **Skala** (dengan skala maks yang ditentukan admin) |
| FR-CFG-04 | W | CRUD Detail Penilaian per Kategori, tipe **Deduksi** (nilai awal 100, poin per kejadian dinamis diatur admin) |
| FR-CFG-05 | W | Perubahan bobot kategori / poin deduksi berlaku mulai **periode berikutnya** (non-retroaktif) |
| FR-CFG-06 | W | Kategori/Detail yang sudah dipakai menilai hanya bisa **dinonaktifkan**, tidak dihapus permanen |
| FR-CFG-07 | W | Kategori yang dinonaktifkan tidak ikut dihitung di periode berikutnya (riwayat tetap tersimpan) |

### 5.4 Penilaian (`FR-ASM`)

| ID | Prioritas | Kebutuhan |
| --- | --- | --- |
| FR-ASM-01 | W | Input penilaian langsung per Kategori (semua detail kategori sekaligus) |
| FR-ASM-02 | W | Input penilaian per Detail satu per satu |
| FR-ASM-03 | W | Detail Skala → input nilai dalam rentang 0–skala maks |
| FR-ASM-04 | W | Detail Deduksi → catat tiap kejadian satu per satu (poin otomatis dihitung dari konfigurasi) |
| FR-ASM-05 | W | Edit & hapus penilaian periode berjalan oleh Manager/Supervisor cabang terkait |
| FR-ASM-06 | W | Skor periode direset tiap periode baru; skor akumulatif tidak ikut reset |
| FR-ASM-07 | W | Sistem menghitung skor otomatis sesuai rumus (lihat bagian 5.6) |

### 5.5 Pendampingan (`FR-MNT`)

| ID | Prioritas | Kebutuhan |
| --- | --- | --- |
| FR-MNT-01 | W | Catat Sesi Pendampingan: outlet yang dikunjungi, pelaksana, tanggal, catatan umum outlet (opsional) |
| FR-MNT-02 | W | Catatan per kasir dalam satu sesi (bisa lebih dari satu kasir) |
| FR-MNT-03 | W | Riwayat pendampingan dapat dilihat dari sisi **outlet** maupun **kasir** |
| FR-MNT-04 | W | Pendampingan **tidak memengaruhi skor** (murni kualitatif) |
| FR-MNT-05 | P | Edit & hapus sesi pendampingan |

### 5.6 Perhitungan Skor (`FR-CALC`)

| ID | Prioritas | Kebutuhan |
| --- | --- | --- |
| FR-CALC-01 | W | Normalisasi tiap detail ke 0–100: Skala → persentase; Deduksi → 100 − total poin kejadian (floor 0) |
| FR-CALC-02 | W | Skor Kategori = rata-rata skor semua detail dalam kategori (setelah normalisasi) |
| FR-CALC-03 | W | Skor Akhir Kasir = Σ (Skor Kategori × Bobot Kategori) |
| FR-CALC-04 | W | Kategori belum dinilai dalam periode berjalan dianggap **skor penuh (100)** |
| FR-CALC-05 | W | Snapshot leaderboard periode saat periode ditutup (terkunci) |
| FR-CALC-06 | P | Perhitungan ulang (recalculate) jika data diperbaiki dalam periode berjalan |

### 5.7 Leaderboard (`FR-LB`)

| ID | Prioritas | Kebutuhan |
| --- | --- | --- |
| FR-LB-01 | W | Ranking per Outlet |
| FR-LB-02 | W | Ranking per Cabang |
| FR-LB-03 | W | Ranking lintas Cabang |
| FR-LB-04 | W | Menampilkan skor periode berjalan & skor akumulatif |
| FR-LB-05 | P | Export CSV laporan leaderboard |

### 5.8 Periode (`FR-PRD`)

| ID | Prioritas | Kebutuhan |
| --- | --- | --- |
| FR-PRD-01 | W | Periode berjalan otomatis sesuai jadwal tetap (bulanan) |
| FR-PRD-02 | W | Penutupan periode otomatis → skor terkunci jadi entri leaderboard periode |
| FR-PRD-03 | W | Pembukaan periode baru otomatis → skor periode direset, skor akumulatif ter-update |
| FR-PRD-04 | P | Override manual pembukaan/penutupan periode oleh Administrator (dengan log) |

### 5.9 Notifikasi (`FR-NTF`)

| ID | Prioritas | Kebutuhan |
| --- | --- | --- |
| FR-NTF-01 | W | Reminder ke Supervisor/Manager untuk kasir yang belum dinilai dalam periode berjalan |
| FR-NTF-02 | W | Alert ketika skor kasir rendah secara berturut-turut |
| FR-NTF-03 | P | Pusat notifikasi in-app |

---

## 6. Kebutuhan Non-Fungsional

| Kode | Kategori | Kebutuhan |
| --- | --- | --- |
| NFR-01 | Platform | Web PWA, static route, App Shell, terasa instan & selalu up-to-date |
| NFR-02 | UI/UX | Mobile-first; komponen Bottom Sheet, Toast, App Bar/Action Bar, Toggle/Switch, Modal/Pop-up, Pull-to-refresh, Onboarding Wizard |
| NFR-03 | UI/UX | UI generik/netral, tidak terikat branding spesifik, mudah disesuaikan |
| NFR-04 | List/Data | Komponen list reusable dengan lazy load, infinite scroll, dan filter (leaderboard, riwayat penilaian, riwayat pendampingan, daftar kasir, dsb.) |
| NFR-05 | Performa | Time to Interactive cepat pada jaringan seluler; data besar (list) tidak merender sekaligus |
| NFR-06 | Keamanan | Row Level Security (RLS) Supabase; akses data dibatasi per peran & penugasan cabang |
| NFR-07 | Keandalan | Periode & perhitungan skor berjalan otomatis/terjadwal tanpa intervensi manual |
| NFR-08 | Kode | Dokumentasi proyek selalu diupdate oleh AI agent yang mengerjakan |
| NFR-09 | Infra | Development lokal + Docker; produksi di Vercel + Supabase |

---

## 7. Aturan Bisnis Kunci

1. **Bobot kategori** harus total 100%. Perubahan bobot berlaku mulai periode berikutnya.
2. **Deduksi**: nilai awal 100, poin per kejadian dinamis (konfigurasi), tidak boleh turun di bawah 0.
3. **Normalisasi Skala**: nilai input ÷ skala maks × 100.
4. **Kategori belum dinilai** dalam periode berjalan → dianggap 100 (bukan 0).
5. **Skor Akhir** = Σ(Skor Kategori × Bobot Kategori).
6. **Periode** berjalan otomatis bulanan; skor periode direset; skor akumulatif berjalan terus.
7. **Soft delete** untuk Cabang/Outlet/Kasir/Kategori/Detail/user — menjaga integritas riwayat.
8. **Kasir tanpa akun** — murni objek penilaian; mutasi outlet tidak menghapus riwayat.
9. **Pendampingan** terpisah & tidak memengaruhi skor.
10. **Manager & Supervisor** punya privilege identik, dibatasi cakupan cabang yang ditugaskan.

---

## 8. Kriteria Penerimaan Ringkas per Fitur Utama

1. **Setup wizard**: saat database/user kosong, aplikasi mengarahkan ke wizard; setelah admin pertama dibuat, wizard tidak muncul lagi.
2. **Login & invite**: user undangan hanya bisa mendaftar melalui link; link kedaluwarsa ditolak; setelah daftar, akun langsung terhubung ke cabang yang ditugaskan.
3. **Konfigurasi bobot**: sistem menolak simpan jika total bobot ≠ 100%; perubahan hanya terlihat di periode baru.
4. **Input skala**: nilai di luar rentang ditolak; skor tersimpan = nilai mentah + tersimpan normalisasi.
5. **Input deduksi**: tiap kejadian bertambah sebagai log; poin total tampil; skor tidak bisa negatif.
6. **Perhitungan**: kasir dengan kategori kosong dianggap 100 untuk kategori itu, hasil perhitungan sesuai rumus contoh di technical-spec.
7. **Leaderboard**: filter level outlet/cabang/lintas-cabang berfungsi; menampilkan skor periode & akumulatif; data terkunci setelah periode ditutup.
8. **Pendampingan**: satu sesi bisa berisi banyak kasir; tidak menambah/mengurangi skor.
9. **PWA**: bisa di-install; App Shell memuat cepat; ada pull-to-refresh pada list.

---

## 9. Asumsi & Dependensi

- Tersedia akun/proyek **Supabase** untuk development dan produksi (Postgres + Auth).
- Tersedia akun **Vercel** untuk deploy.
- **Docker** tersedia untuk environment lokal (lihat `development-maintenance-plan.md`).
- Bisa menggunakan layanan **Google OAuth** (client ID/secret dikonfigurasi Administrator).
- Periode default: **bulanan** (kalender), dapat diubah konfigurasi tetapi tetap jadwal tetap.
- Data historis dari sistem KPI lama (jika ada) **tidak** dimigrasi pada rilis pertama.

---

## 10. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Perubahan bobot salah diterapkan retroaktif | Skor riwayat rusak | Aturan non-retroaktif dijamin lewat snapshot `periode_bobot`/`leaderboard` |
| Kasir belum dinilai & langsung dihitung | Skor menyesatkan | Kategori belum dinilai = 100 + reminder otomatis |
| Akun invite disalahgunakan | Akses tidak sah | Token sekali pakai, masa kedaluwarsa, hanya role Manager/Supervisor |
| Data hilang saat mutasi/soft delete | Riwayat rusak | Soft delete + riwayat penempatan; data tidak pernah dihapus permanen |
| RLS salah konfigurasi | Bocor data lintas cabang | RLS per level; uji skenario lintas-cabang di QA checklist |
| Nilai skala/deduksi di luar batas | Skor aneh | Validasi server & client; floor 0 untuk deduksi |

---

## 11. Referensi & Dokumen Terkait

- `plan.md` — Spesifikasi Produk (sumber tunggal)
- `technical-spec.md` — Spesifikasi Teknis (arsitektur, DB, API)
- `user-flow-wireframe.md` — Alur & wireframe per role
- `milestone.md` — Tahapan pengerjaan
- `testing-qa-checklist.md` — Skenario pengujian
- `development-maintenance-plan.md` — Proses development & pemeliharaan

---

_Halaman About wajib memuat credit: **Yoga Sptriana** — https://www.instagram.com/mang.agooy/_