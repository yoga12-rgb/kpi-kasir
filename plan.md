# Spesifikasi Produk: Aplikasi KPI & Ranking Kasir — Rajaklana

> Dokumen ini disusun untuk dijadikan rule/acuan bagi AI agent yang mengerjakan pengembangan aplikasi.
>
> **Catatan untuk AI agent:** anggap tidak ada pengetahuan tentang histori pengembangan aplikasi KPI sebelumnya (atau proyek lain seperti aplikasi absensi). Seluruh kebutuhan proyek ini harus dirujuk sepenuhnya dari dokumen ini sebagai sumber tunggal.

## 1. Ringkasan Produk

Aplikasi web PWA internal untuk Rajaklana yang digunakan untuk menilai performa kasir di seluruh cabang & outlet, menghasilkan skor & ranking (leaderboard), serta mencatat pendampingan lapangan oleh Manager/Supervisor.

- Standalone — tidak terintegrasi dengan aplikasi absensi
- Struktur organisasi Cabang > Outlet > Kasir sepenuhnya dinamis (tidak hardcode)
- Skala kecil, khusus untuk Rajaklana (bukan multi-tenant/SaaS)

## 2. Struktur Entitas

| Entitas                | Keterangan                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Cabang**             | Dinamis, hanya bisa dinonaktifkan (tidak dihapus permanen)                                                                            |
| **Outlet**             | Di bawah satu Cabang, dinamis, hanya bisa dinonaktifkan                                                                               |
| **Kasir**              | Di bawah satu Outlet (1 outlet per waktu), objek penilaian tanpa akun, bisa dimutasi outlet (riwayat ikut pindah), bisa dinonaktifkan |
| **User**               | Administrator / Manager / Supervisor — punya akun                                                                                     |
| **Kategori Penilaian** | Dinamis, punya bobot %                                                                                                                |
| **Detail Penilaian**   | Di bawah satu Kategori, tipe: Skala atau Deduksi                                                                                      |
| **Penilaian**          | Skor tersimpan per kasir per periode                                                                                                  |
| **Kejadian Deduksi**   | Log tiap kejadian pengurangan poin (per detail bertipe deduksi)                                                                       |
| **Sesi Pendampingan**  | Catatan kualitatif kunjungan Manager/Supervisor ke outlet                                                                             |
| **Periode Penilaian**  | Siklus tetap otomatis (misal bulanan)                                                                                                 |

## 3. Role & Hak Akses

### Administrator

- Akses semua cabang
- Kelola akun Administrator/Manager/Supervisor
- Kelola Cabang & Outlet
- Kelola Kategori & Detail Penilaian, termasuk bobot dan poin deduksi
- Lihat semua laporan, leaderboard, dan pendampingan

### Manager & Supervisor

_(hak akses identik — hanya beda label/jabatan, tidak ada perbedaan privilege)_

- Akses ke Cabang yang ditugaskan (satu akun bisa ditugaskan ke lebih dari satu Cabang)
- Tambah & kelola data Kasir di outlet cabangnya
- Input, edit, hapus Penilaian secara bebas
- Catat Sesi Pendampingan
- Lihat leaderboard & laporan sesuai cabang yang ditugaskan

### Kasir

- Tidak memiliki akun — murni objek penilaian

## 4. Autentikasi & Manajemen Akun

- Akun **Administrator pertama** dibuat lewat **setup wizard** saat aplikasi pertama kali dijalankan
- Akun **Manager/Supervisor** dibuat lewat **link invite** yang dikirim manual oleh Administrator
- Pendaftaran mendukung **Google OAuth**, selain email+password
- Satu akun Manager/Supervisor bisa ditugaskan ke lebih dari satu Cabang

## 5. Konfigurasi Penilaian

- Administrator mendefinisikan **Kategori Penilaian**, masing-masing dengan bobot % (total seluruh kategori = 100%)
- Tiap Kategori memiliki satu atau lebih **Detail Penilaian**, bertipe:
  - **Skala** — input nilai dalam rentang skala tertentu (skala ditentukan Administrator)
  - **Deduksi** — dimulai dari nilai penuh (100), dikurangi poin tetap tiap kejadian yang dicatat; poin per kejadian **dinamis, diatur Administrator** per detail (bukan hardcode); tidak boleh turun di bawah 0
- Penilaian bisa dilakukan langsung per Kategori, atau per Detail satu-satu
- Perubahan bobot Kategori / poin Deduksi **berlaku mulai periode berikutnya**, tidak retroaktif ke penilaian yang sudah tersimpan
- Kategori/Detail yang sudah pernah dipakai menilai hanya bisa **dinonaktifkan**, tidak dihapus permanen (menjaga integritas riwayat)

## 6. Perhitungan Skor

1. Tiap Detail dinormalisasi ke skala 0–100:
   - Tipe Skala → dikonversi ke persentase dari skala maksimalnya
   - Tipe Deduksi → 100 dikurangi total poin kejadian yang tercatat pada periode itu, floor di 0
2. **Skor Kategori** = rata-rata skor semua Detail dalam kategori itu (setelah dinormalisasi)
3. **Skor Akhir Kasir** = Σ (Skor Kategori × Bobot Kategori)
4. Kategori yang **belum sempat dinilai** dalam periode berjalan dianggap **skor penuh (100)**

## 7. Periode Penilaian

- Periode berjalan **otomatis sesuai jadwal tetap** (misalnya bulanan) — bukan fleksibel
- Skor periode **direset** setiap periode baru dibuka
- Skor **akumulatif** berjalan terus sepanjang waktu, tidak ikut reset

## 8. Alur Kerja Utama

### 8.1 Setup Awal

1. Akun Administrator pertama dibuat via setup wizard saat aplikasi pertama kali dijalankan
2. Administrator membuat struktur Cabang & Outlet
3. Administrator mengatur Kategori, Detail Penilaian, bobot per kategori, dan poin deduksi per detail
4. Administrator mengundang akun Manager/Supervisor via link invite, sekaligus menugaskan ke satu/lebih Cabang

### 8.2 Operasional Harian

1. Manager/Supervisor menambahkan data Kasir di outlet cabangnya
2. Supervisor/Manager menilai kasir — bisa mengisi kategori satu per satu di waktu berbeda dalam periode yang sama:
   - Detail bertipe Skala → input nilai langsung
   - Detail bertipe Deduksi → catat tiap kejadian satu per satu (bukan agregat)
3. Sistem menghitung skor kasir secara otomatis mengikuti rumus pada bagian 6
4. Manager/Supervisor mencatat **Sesi Pendampingan** kapan saja secara bebas (tidak wajib per periode):
   - Pilih outlet yang dikunjungi
   - Isi catatan umum untuk outlet dan/atau catatan spesifik per kasir (bisa lebih dari satu kasir dalam satu sesi)
5. Kasir bisa dimutasi antar outlet (riwayat penilaian & pendampingan ikut pindah bersama kasir), atau dinonaktifkan (riwayat tetap tersimpan)

### 8.3 Penutupan Periode

1. Periode ditutup otomatis sesuai jadwal
2. Skor periode itu terkunci menjadi entri leaderboard periode tersebut
3. Skor akumulatif kasir ter-update
4. Periode baru dibuka otomatis, skor periode direset

### 8.4 Notifikasi

- Reminder ke Supervisor/Manager untuk kasir yang belum dinilai dalam periode berjalan
- Alert ketika skor kasir rendah secara berturut-turut

## 9. Modul Pendampingan

- **Terpisah** dari modul Penilaian — murni catatan kualitatif, **tidak memengaruhi skor**
- Satu Sesi Pendampingan terdiri dari: outlet yang dikunjungi, pelaksana (Manager/Supervisor), tanggal, catatan umum outlet (opsional), catatan per kasir (opsional, bisa mencakup banyak kasir sekaligus)
- Riwayat pendampingan bisa dilihat dari sisi outlet maupun dari sisi masing-masing kasir

## 10. Leaderboard

- Ranking dapat difilter di semua level: per Outlet, per Cabang, atau lintas Cabang
- Menampilkan skor periode berjalan sekaligus skor akumulatif

## 11. UI/UX

- Platform: **Web PWA**, static route, menggunakan **App Shell** agar terasa instan dan selalu up-to-date
- UI mengutamakan tampilan **mobile-first**
- UI dibuat **generik** — netral, tidak terikat identitas visual/branding spesifik, sehingga mudah disesuaikan kemudian
- Komponen utama: Bottom Sheet, Toast, App Bar/Action Bar, Toggle/Switch, Modal/Pop-up, Pull-to-refresh, Onboarding Wizard
- Komponen list/data (leaderboard, riwayat penilaian, riwayat pendampingan, daftar kasir, dsb.) dibuat sebagai komponen **reusable** dengan dukungan **lazy load**, **infinite scroll**, dan **filter**, dipakai di halaman mana pun yang membutuhkan

## 12. Kebutuhan Teknis

- **Environment lokal + Docker** untuk tahap development
- Stack: **Next.js**, **Supabase**, deploy ke **Vercel**, styling dengan **Tailwind CSS**
- Dokumentasi proyek harus dibuat dan **selalu diupdate** oleh AI agent yang mengerjakan pengembangan
- Halaman **About** berisi credit ke pembuat: **Yoga Sptriana**, dengan tautan ke https://www.instagram.com/mang.agooy/

## 13. Dokumen yang Harus Dibuat AI Agent Sebelum Development

Sebelum mulai coding, AI agent yang mengerjakan proyek ini wajib menyusun dokumen-dokumen berikut terlebih dahulu, berbasis spesifikasi di dokumen ini. **Setiap dokumen dibuat sebagai file `.md` terpisah** (bukan digabung dalam satu file):

1. **PRD (Product Requirements Document)** — `prd.md` — detail kebutuhan produk, tujuan, dan ruang lingkup
2. **Dokumen Spesifikasi Teknis** — `technical-spec.md` — arsitektur sistem, skema database, API/endpoint, struktur folder proyek
3. **User Flow & Wireframe** — `user-flow-wireframe.md` — alur penggunaan tiap fitur beserta gambaran tampilan (wireframe) per role (Administrator, Manager/Supervisor)
4. **Milestone** — `milestone.md` — pembagian tahapan pengerjaan beserta target masing-masing tahap
5. **Testing & QA Checklist** — `testing-qa-checklist.md` — daftar skenario pengujian untuk tiap fitur sebelum rilis
6. **Development & Maintenance Plan** — `development-maintenance-plan.md` — rencana proses development (termasuk penggunaan environment lokal & Docker) serta rencana pemeliharaan aplikasi setelah rilis

---

_Dokumen spesifikasi produk ini menjadi acuan utama; keenam dokumen di atas disusun mengacu ke sini sebelum development teknis dimulai._
