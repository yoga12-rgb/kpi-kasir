# Testing & QA Checklist — Aplikasi KPI & Ranking Kasir Rajaklana

> Dokumen ini adalah **Testing & QA Checklist** yang disusun mengacu pada `plan.md`, `prd.md`, `technical-spec.md`, dan `milestone.md`.
> Daftar skenario pengujian untuk tiap fitur sebelum rilis. Status diisi saat eksekusi QA (✅ Lulus / ❌ Gagal / ⏳ Belum).
> Status: Draft awal — diperbarui saat pelaksanaan testing.

---

## 1. Lingkup Pengujian

| Area | Jenis | Tools |
| --- | --- | --- |
| Unit test | Normalisasi skor, perhitungan kategori/akhir, validasi zod, util periode | Vitest |
| Integration/E2E | Setup wizard, auth, flow penilaian, deduksi, mentor, leaderboard | Playwright |
| Keamanan (RLS) | Akses lintas cabang, endpoint cron, invite token | Playwright + SQL test di Supabase lokal |
| PWA | Install, offline, pull-to-refresh, app shell | Browser DevTools / Lighthouse |
| Performa | Lighthouse mobile, beban list besar | Lighthouse, manual |

---

## 2. Setup Awal & Autentikasi

| ID | Skenario | Langkah Uji | Hasil Harapan | Status |
| --- | --- | --- | --- | --- |
| QA-AUTH-01 | Setup wizard muncul saat pertama | Akses root dengan DB kosong (`app_setup.admin_created=false`) | Redirect ke `/setup`; wizard step 1 tampil | ⏳ |
| QA-AUTH-02 | Setup wizard selesai | Isi nama, email, password; step cabang/outlet; step kategori; selesai | Admin dibuat; `app_setup.admin_created=true`; redirect login | ⏳ |
| QA-AUTH-03 | Setup wizard tidak muncul lagi | Logout, akses root lagi | Langsung ke `/login`, bukan `/setup` | ⏳ |
| QA-AUTH-04 | Login email+password valid | Login admin | Masuk ke dashboard | ⏳ |
| QA-AUTH-05 | Login salah password | Input password salah | Error jelas; tidak masuk | ⏳ |
| QA-AUTH-06 | Login Google OAuth | Klik "Lanjut dengan Google" | Flow Google berhasil; akun dibuat/ditemukan; role sesuai email terdaftar | ⏳ |
| QA-AUTH-07 | Invite berhasil | Admin buat link invite (email, role manager, cabang A+B) | Token dibuat; status undangan pending | ⏳ |
| QA-AUTH-08 | Registrasi via invite | Buka link → isi data → submit | Akun dibuat; `user_branch` A+B terisi; redirect login | ⏳ |
| QA-AUTH-09 | Invite dipakai 2× | Buka link kedua kalinya setelah dipakai | Ditolak "link sudah dipakai" | ⏳ |
| QA-AUTH-10 | Invite kedaluwarsa | Buka link setelah `expires_at` lewat | Ditolak "link kedaluwarsa" | ⏳ |
| QA-AUTH-11 | Akses tanpa login | Buka halaman terproteksi tanpa session | Redirect ke `/login` | ⏳ |
| QA-AUTH-12 | Akun dinonaktifkan login | Admin nonaktifkan akun user; user coba login | Login ditolak / sesi invalid | ⏳ |

---

## 3. Master Data (Cabang / Outlet / Kasir)

| ID | Skenario | Langkah Uji | Hasil Harapan | Status |
| --- | --- | --- | --- | --- |
| QA-ORG-01 | Buat cabang | Form tambah cabang (nama, kode) | Cabang muncul di list | ⏳ |
| QA-ORG-02 | Edit cabang | Ubah nama cabang | Tersimpan; tampil nama baru | ⏳ |
| QA-ORG-03 | Nonaktifkan cabang | Nonaktifkan cabang | Tidak muncul di list aktif; data riwayat tetap ada | ⏳ |
| QA-ORG-04 | Buat outlet | Pilih cabang → tambah outlet | Outlet muncul di detail cabang | ⏳ |
| QA-ORG-05 | Pindah outlet antar cabang | Edit outlet → ubah cabang | Outlet pindah cabang | ⏳ |
| QA-ORG-06 | Nonaktifkan outlet | Nonaktifkan outlet | Tidak di list; kasir di dalamnya tetap ada di DB | ⏳ |
| QA-ORG-07 | Buat kasir | Pilih outlet → tambah kasir | Kasir muncul; `cashier_outlet_history` terisi | ⏳ |
| QA-ORG-08 | Edit kasir | Ubah nama kasir | Nama berubah di semua riwayat | ⏳ |
| QA-ORG-09 | Mutasi kasir | Pilih kasir → mutasi ke outlet lain | `outlet_id` berubah; history baru ditulis; riwayat penilaian mengikuti kasir | ⏳ |
| QA-ORG-10 | Nonaktifkan kasir | Nonaktifkan kasir | Tidak di list aktif; detail riwayat tetap bisa dibuka | ⏳ |
| QA-ORG-11 | Akses Manager/Supervisor | Login manager cabang A | Tidak bisa akses/melihat data cabang B (list kosong/403) | ⏳ |
| QA-ORG-12 | Akses Admin | Login admin | Bisa akses semua cabang | ⏳ |

---

## 4. Konfigurasi Penilaian

| ID | Skenario | Langkah Uji | Hasil Harapan | Status |
| --- | --- | --- | --- | --- |
| QA-CFG-01 | Buat kategori valid | Nama + bobot, total semua kategori 100% | Tersimpan | ⏳ |
| QA-CFG-02 | Total bobot ≠ 100% | Set bobot sehingga total 80% | Simpan ditolak; pesan "total harus 100%" | ⏳ |
| QA-CFG-03 | Buat detail Skala | Kategori → detail tipe Skala, skala maks 5 | Tersimpan; muncul di form penilaian | ⏳ |
| QA-CFG-04 | Buat detail Deduksi | Kategori → detail tipe Deduksi, poin 5 | Tersimpan; poin dipakai saat catat kejadian | ⏳ |
| QA-CFG-05 | Validasi tipe Skala tanpa skala maks | Simpan detail skala tanpa `scale_max` | Ditolak | ⏳ |
| QA-CFG-06 | Validasi tipe Deduksi tanpa poin | Simpan detail deduksi tanpa `deduction_points` | Ditolak | ⏳ |
| QA-CFG-07 | Non-retroaktif bobot | Ubah bobot kategori di periode berjalan | Skor periode berjalan tidak berubah; `category_weight_history` periode baru terisi nilai baru | ⏳ |
| QA-CFG-08 | Non-retroaktif poin deduksi | Ubah poin deduksi | Kejadian lama tetap pakai poin lama; kejadian baru pakai poin baru | ⏳ |
| QA-CFG-09 | Soft delete kategori | Nonaktifkan kategori yang sudah dipakai menilai | Tidak muncul di form periode baru; riwayat skor lama tetap utuh | ⏳ |
| QA-CFG-10 | Soft delete detail | Nonaktifkan detail yang sudah dinilai | Tidak di form baru; assessment lama tetap tersimpan | ⏳ |
| QA-CFG-11 | Akses config non-admin | Login manager → coba buka/edit config | Baca saja (tidak bisa create/update/delete) | ⏳ |

---

## 5. Penilaian & Skor

| ID | Skenario | Langkah Uji | Hasil Harapan | Status |
| --- | --- | --- | --- | --- |
| QA-ASM-01 | Input skala valid | Input 4 pada skala 0–5 | Tersimpan; normalisasi 80 | ⏳ |
| QA-ASM-02 | Input skala di luar rentang | Input 6 pada skala 0–5 | Ditolak oleh form & server | ⏳ |
| QA-ASM-03 | Input skala negatif | Input −1 | Ditolak | ⏳ |
| QA-ASM-04 | Input per kategori | Isi semua detail satu kategori sekaligus | Semua tersimpan saat submit | ⏳ |
| QA-ASM-05 | Input per detail | Isi satu detail saja | Tersimpan; skor kategori dihitung dari detail yang dinilai | ⏳ |
| QA-ASM-06 | Edit penilaian | Ubah nilai skala yang sudah ada di periode berjalan | Nilai baru tersimpan (upsert 1 baris per kasir-detail-periode) | ⏳ |
| QA-ASM-07 | Hapus penilaian | Hapus assessment skala | Skor dihitung ulang; detail jadi belum dinilai | ⏳ |
| QA-ASM-08 | Catat kejadian deduksi | Detail deduksi → catat kejadian | Log tersimpan; poin terpotong sesuai konfigurasi | ⏳ |
| QA-ASM-09 | Skor deduksi floor 0 | Catat banyak kejadian hingga total > 100 | Skor detail = 0 (tidak negatif) | ⏳ |
| QA-ASM-10 | Total poin deduksi tampil | Lihat halaman detail deduksi | Total poin, jumlah kejadian, skor akhir tampil benar | ⏳ |
| QA-ASM-11 | Kategori belum dinilai = 100 | Kasir tanpa assessment pada kategori | Skor kategori dianggap 100 dalam perhitungan | ⏳ |
| QA-ASM-12 | Skor akhir rumus | Uji contoh `milestone.md` M4 (A 90, B 90, bobot 40/60 → 90) | Hasil 90.00 | ⏳ |
| QA-ASM-13 | Edit penilaian periode tertutup | Periode closed → coba input/edit | Ditolak (terkunci) | ⏳ |
| QA-ASM-14 | Akses lintas cabang | Manager cabang A coba input penilaian kasir cabang B | Ditolak (403) | ⏳ |

---

## 6. Periode

| ID | Skenario | Langkah Uji | Hasil Harapan | Status |
| --- | --- | --- | --- | --- |
| QA-PRD-01 | Periode open otomatis | Cron/pg_cron trigger di awal bulan | Period baru dibuat; status open; skor periode kosong | ⏳ |
| QA-PRD-02 | Periode close otomatis | Cron di akhir bulan | Status closed; `leaderboard_entry` terisi; `cashier_cumulative_score` ter-update | ⏳ |
| QA-PRD-03 | Leaderboard terkunci | Buka leaderboard periode tertutup | Data snapshot tidak berubah walau assessment lama dihapus/diubah | ⏳ |
| QA-PRD-04 | Reset skor periode | Buka periode baru | Assessment periode baru kosong; skor periode berjalan = 0/terhitung ulang | ⏳ |
| QA-PRD-05 | Close manual (admin) | Admin tutup periode via pengaturan | Sama seperti otomatis; `period_log` tercatat | ⏳ |
| QA-PRD-06 | Duplikasi periode | Cron berjalan 2× dalam waktu sama | Tidak membuat period ganda (constraint/guard) | ⏳ |
| QA-PRD-07 | Akses cron tanpa secret | Panggil `/api/cron/periods` tanpa `CRON_SECRET` | 401/403 | ⏳ |

---

## 7. Pendampingan

| ID | Skenario | Langkah Uji | Hasil Harapan | Status |
| --- | --- | --- | --- | --- |
| QA-MNT-01 | Buat sesi 1 kasir | Pilih outlet, tanggal, catatan umum, 1 kasir + catatan | Sesi tersimpan; muncul di riwayat outlet & kasir | ⏳ |
| QA-MNT-02 | Buat sesi banyak kasir | Pilih 3 kasir dalam 1 sesi | Semua catatan per kasir tersimpan | ⏳ |
| QA-MNT-03 | Sesi tanpa catatan per kasir | Sesi hanya catatan umum outlet | Valid; sesi tetap tersimpan | ⏳ |
| QA-MNT-04 | Sesi tidak memengaruhi skor | Bandingkan skor kasir sebelum/sesudah input sesi | Skor tidak berubah | ⏳ |
| QA-MNT-05 | Riwayat dari sisi outlet | Buka detail outlet → tab pendampingan | Semua sesi outlet tampil | ⏳ |
| QA-MNT-06 | Riwayat dari sisi kasir | Buka detail kasir → tab pendampingan | Sesi yang melibatkan kasir tampil | ⏳ |
| QA-MNT-07 | Edit & hapus sesi | Uji update dan delete sesi | Tersimpan; log/audit sesuai | ⏳ |
| QA-MNT-08 | Akses lintas cabang | Manager cabang A coba buat sesi outlet cabang B | Ditolak (403) | ⏳ |

---

## 8. Leaderboard

| ID | Skenario | Langkah Uji | Hasil Harapan | Status |
| --- | --- | --- | --- | --- |
| QA-LB-01 | Leaderboard per outlet | Filter level outlet → pilih outlet | Ranking kasir dalam outlet benar (urut skor) | ⏳ |
| QA-LB-02 | Leaderboard per cabang | Filter level cabang → pilih cabang | Ranking semua outlet dalam cabang benar | ⏳ |
| QA-LB-03 | Leaderboard lintas cabang | Filter global | Ranking semua kasir seluruh cabang benar | ⏳ |
| QA-LB-04 | Tab akumulatif | Switch ke skor akumulatif | Ranking menurut `cashier_cumulative_score` | ⏳ |
| QA-LB-05 | Skor periode berjalan | Periksa saat periode masih open | Skor real-time dari `cashier_period_score` | ⏳ |
| QA-LB-06 | Data periode tertutup | Periksa periode closed | Data dari `leaderboard_entry` (snapshot) | ⏳ |
| QA-LB-07 | Infinite scroll | Scroll daftar panjang | Data termuat bertahap (tidak semua sekaligus) | ⏳ |
| QA-LB-08 | Export CSV | Klik export | File CSV benar: kolom rank, kasir, outlet, cabang, skor | ⏳ |
| QA-LB-09 | Batasan Manager/Supervisor | Manager cabang A lihat leaderboard | Hanya bisa filter cabang A (atau outlet di cabang A) | ⏳ |

---

## 9. Notifikasi

| ID | Skenario | Langkah Uji | Hasil Harapan | Status |
| --- | --- | --- | --- | --- |
| QA-NTF-01 | Reminder belum dinilai | Kasir tanpa penilaian di periode berjalan; jalankan cron reminder | Notifikasi ke Manager/Supervisor cabang terkait | ⏳ |
| QA-NTF-02 | Reminder tidak untuk yang sudah dinilai | Kasir sudah lengkap dinilai | Tidak dapat reminder | ⏳ |
| QA-NTF-03 | Alert skor rendah berturut-turut | Kasir skor < ambang N periode beruntun (simulasi data) | Notifikasi low-score alert dibuat | ⏳ |
| QA-NTF-04 | Pusat notifikasi | Buka halaman notifikasi | List tampil; unread badge sesuai | ⏳ |
| QA-NTF-05 | Tandai dibaca | Tap notifikasi / tombol baca | `is_read=true`; badge berkurang | ⏳ |
| QA-NTF-06 | Privasi notifikasi | Login user lain | Tidak melihat notifikasi user lain | ⏳ |

---

## 10. PWA & UI/UX

| ID | Skenario | Langkah Uji | Hasil Harapan | Status |
| --- | --- | --- | --- | --- |
| QA-PWA-01 | Install PWA | Buka di mobile/desktop → install | Muncul prompt install; ikon muncul di home screen | ⏳ |
| QA-PWA-02 | App Shell offline | Muat app lalu offline; buka lagi | App shell tampil; halaman ter-cache termuat | ⏳ |
| QA-PWA-03 | Pull-to-refresh | Tarik list leaderboard/daftar kasir | Data refresh tanpa navigasi | ⏳ |
| QA-PWA-04 | Infinite scroll & lazy load | List panjang (≥100 item) | Hanya item terlihat + buffer yang di-render; scroll memuat berikutnya | ⏳ |
| QA-PWA-05 | Bottom Sheet & Modal | Buka form kasir/kategori via Bottom Sheet; konfirmasi via Modal | Tampil benar di mobile & desktop (responsive) | ⏳ |
| QA-PWA-06 | Toast feedback | Simpan data | Toast sukses/gagal muncul | ⏳ |
| QA-PWA-07 | Toggle/Switch | Toggle periode/akumulatif leaderboard | Berfungsi | ⏳ |
| QA-PWA-08 | UI netral/generik | Periksa tampilan | Tidak terkait branding spesifik; siap dikustomisasi | ⏳ |
| QA-PWA-09 | Lighthouse mobile | Audit di DevTools | Performance/PWA/Best Practices/Accessibility target ≥ 90 | ⏳ |

---

## 11. Keamanan & Integritas Data

| ID | Skenario | Langkah Uji | Hasil Harapan | Status |
| --- | --- | --- | --- | --- |
| QA-SEC-01 | RLS lintas cabang | Akses API kasir/assessment cabang lain sebagai manager | Ditolak / data tidak tampil | ⏳ |
| QA-SEC-02 | RLS write non-admin | Manager coba create/edit kategori | Ditolak | ⏳ |
| QA-SEC-03 | Service key tidak bocor | Cek bundle client / network | Tidak ada `SUPABASE_SERVICE_ROLE_KEY` di client | ⏳ |
| QA-SEC-04 | Soft delete terjaga | Nonaktifkan entitas → cek via DB | `is_active=false`; data tidak hilang | ⏳ |
| QA-SEC-05 | Unique constraint assessment | Insert 2× assessment kasir-detail-periode sama | Salah satu ditolak (upsert) | ⏳ |
| QA-SEC-06 | Validation server | Kirim payload invalid (negatif, out-of-range, bobot ≠ 100%) via API langsung | Ditolak server (bukan hanya UI) | ⏳ |
| QA-SEC-07 | Invite token acak | Periksa token | Unik, panjang cukup, tidak bisa ditebak | ⏳ |
| QA-SEC-08 | Cron aman | Akses cron endpoint | Membutuhkan secret | ⏳ |

---

## 12. Regresi & Smoke Test (Sebelum Rilis)

| ID | Skenario | Hasil Harapan | Status |
| --- | --- | --- | --- |
| QA-SMK-01 | Setup wizard → login → dashboard | Admin masuk | ⏳ |
| QA-SMK-02 | Buat cabang → outlet → kasir | Data muncul | ⏳ |
| QA-SMK-03 | Input penilaian skala + deduksi | Skor tampil benar | ⏳ |
| QA-SMK-04 | Sesi pendampingan | Tersimpan & tampil di riwayat | ⏳ |
| QA-SMK-05 | Leaderboard semua level | Ranking benar | ⏳ |
| QA-SMK-06 | Tutup periode → leaderboard terkunci & akumulatif ter-update | Konsisten | ⏳ |
| QA-SMK-07 | About page | Credit Yoga Sptriana + link Instagram tampil | ⏳ |

---

## 13. Catatan Eksekusi

- Skenario prioritas **kritis** (harus lulus sebelum release): QA-AUTH-*, QA-CFG-02/05/06/07/08, QA-ASM-*, QA-PRD-*, QA-SEC-*, QA-SMK-*.
- Hasil QA dicatat di dokumen ini (kolom Status) dan/atau di tooling (mis. test report CI).
- Regresi penuh dijalankan pada M9; smoke dijalankan sebelum Go-Live (M10).

---

## 14. Referensi

- `plan.md` — Spesifikasi Produk
- `prd.md` — Product Requirements Document (kriteria penerimaan per fitur)
- `technical-spec.md` — Spesifikasi Teknis
- `user-flow-wireframe.md` — User Flow & Wireframe
- `milestone.md` — Tahapan pengerjaan
- `development-maintenance-plan.md` — Proses development & maintenance