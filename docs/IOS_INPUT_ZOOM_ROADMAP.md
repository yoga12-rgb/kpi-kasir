# Roadmap: Pencegahan Zoom Input iPhone

Dokumen ini memandu agent berikutnya memperbaiki zoom otomatis Safari iOS saat field teks difokuskan. Agent wajib memperbarui status, bukti pengujian, dan handoff setelah setiap step selesai.

## Identitas

| Field | Nilai |
| --- | --- |
| Status | `IN_PROGRESS` |
| Baseline commit | `919a8fb` |
| Dibuat | 2026-08-10 WIB |
| Ruang lingkup | Field teks pada aplikasi Next.js mobile-first |

## Masalah Dan Keputusan

Safari iPhone dapat memperbesar halaman saat `input`, `select`, atau `textarea` berukuran kurang dari `16px` menerima fokus. Aplikasi saat ini mendefinisikan `.input` dengan `text-sm` (`14px`) di `src/app/globals.css`.

Keputusan implementasi:

1. Semua field yang menerima teks harus memiliki computed font size minimal `16px` pada perangkat sentuh.
2. Jangan mematikan zoom browser melalui `user-scalable=no` atau `maximum-scale=1`.
3. Pinch-to-zoom harus tetap tersedia untuk aksesibilitas.
4. Jangan membesarkan tombol, label, chip, checkbox, atau slider hanya untuk mengatasi masalah ini.

## Kontrak Kerja Agent

Sebelum memulai:

1. Baca `AGENTS.md`, `docs/DEVELOPER_GUIDE.md`, dan dokumen ini.
2. Jalankan `git status --short`; jangan menghapus perubahan milik user.
3. Catat commit awal dan ubah hanya satu milestone menjadi `IN_PROGRESS`.
4. Baca `src/app/globals.css`, `src/components/ui/Form.tsx`, dan semua kontrol native hasil audit.

Setelah menyelesaikan satu step:

1. Jalankan test gate step tersebut dan regression gate minimum.
2. Jalankan `git diff --check` serta `git status --short`.
3. Jika seluruh gate lulus, ubah status menjadi `COMPLETE` dan isi bukti pada tabel milestone.
4. Tambahkan entri log dan perbarui `Catatan Handoff Aktif` sebelum melanjutkan step berikutnya.

## Milestone

| ID | Tujuan | Status |
| --- | --- | --- |
| IZ-1 | Inventarisasi semua field teks | `COMPLETE` |
| IZ-2 | Terapkan ukuran minimum 16px pada perangkat sentuh | `COMPLETE` |
| IZ-3 | Verifikasi perangkat dan build production | `IN_PROGRESS` |

## IZ-1: Inventarisasi Kontrol

**Tujuan:** memastikan setiap field teks tercakup, termasuk kontrol yang tidak memakai komponen form bersama.

**Langkah:**

1. Jalankan `rg -n '<(input|select|textarea)' src`.
2. Tandai kontrol yang memakai `Input`, `Select`, atau `Textarea` dari `src/components/ui/Form.tsx`; semuanya memakai class `.input`.
3. Tandai kontrol native dengan class tersendiri, terutama `<select>` pada `src/components/settings/UserManagementList.tsx`.
4. Abaikan checkbox, slider/range, dan tombol dari daftar field teks.
5. Catat daftar file yang harus diubah pada bagian handoff.

**Acceptance criteria:** tidak ada field teks yang luput dari inventaris dan belum ada perubahan source code di luar dokumentasi.

**Hasil inventaris:**

- `Input`, `Select`, dan `Textarea` dari `src/components/ui/Form.tsx` mencakup form utama.
- Pencarian cabang, outlet, kasir, dan pengguna memakai `.input`.
- Filter status kasir memakai `.input` tetapi menambahkan `text-xs`, sehingga perlu dipastikan override mobile menang.
- `src/components/settings/UserManagementList.tsx` memiliki `select` native dengan `text-sm`; kontrol ini perlu diubah menjadi `text-base md:text-sm`.
- Checkbox, slider/range, hidden input, dan file input tidak termasuk field teks yang memicu auto-zoom.

**Bukti IZ-1:** `rg -n '<(input|select|textarea)\\b|<Input\\b|<Select\\b|<Textarea\\b' src --glob '*.tsx' --glob '*.jsx'`.

**Test gate:** `git status --short` dan `rg -n '<(input|select|textarea)' src`.

## IZ-2: Perbaikan CSS Dan Kontrol Khusus

**Tujuan:** mencegah auto-zoom iPhone tanpa mengurangi kemampuan pengguna memperbesar halaman secara manual.

**Rancangan yang disarankan:**

1. Tambahkan override untuk `.input` setelah definisi utamanya di `src/app/globals.css`, dibatasi perangkat sentuh dengan media query `(hover: none) and (pointer: coarse)`, lalu tetapkan `font-size: 16px`.
2. Untuk kontrol native yang tidak memakai `.input`, tambahkan kelas dengan hasil setara, misalnya `text-base` pada perangkat sentuh dan `md:text-sm` hanya bila kepadatan desktop tetap diperlukan.
3. Pertahankan padding, focus ring, tipe input, `inputMode`, validasi, dan warna yang telah ada.
4. Jangan memakai `transform: scale()` atau perubahan meta viewport sebagai solusi.

**File yang mungkin berubah:**

- `src/app/globals.css`
- `src/components/settings/UserManagementList.tsx`
- File kontrol native lain yang ditemukan pada IZ-1

**Acceptance criteria:**

- Computed font size setiap field teks pada perangkat sentuh minimal `16px`.
- Tampilan desktop tidak overflow dan tetap sesuai kepadatan aplikasi.
- `metadata.viewport` tidak memiliki `user-scalable=no` atau batas `maximum-scale`.
- Kontrol non-teks tidak berubah tanpa alasan.

**Test gate:** `npm run lint`, `npm run typecheck`, `npm test`, dan `git diff --check`.

**Bukti IZ-2:** semua gate lulus; override `.input` ditambahkan setelah blok layer Tailwind dan dropdown role native diubah menjadi `text-base md:text-sm`.

## IZ-3: Verifikasi Perangkat Dan Build

**Tujuan:** membuktikan perilaku pada perangkat target, bukan hanya pemeriksaan CSS.

**Langkah:**

1. Jalankan `npm run dev`.
2. Uji halaman login, setup/invite, cabang, outlet, kasir, kategori, periode, dan pengaturan pengguna.
3. Pada Safari iPhone nyata, fokuskan setiap field teks dan ketik nilai. Halaman tidak boleh membesar otomatis maupun tertinggal dalam skala besar setelah keyboard ditutup.
4. Dengan Safari Web Inspector bila tersedia, pastikan `window.visualViewport.scale` tetap `1` saat field difokuskan.
5. Pastikan pinch-to-zoom tetap berfungsi.
6. Ambil screenshot mobile dan desktop pada halaman form terpadat untuk memeriksa overflow dan fokus keyboard.

**Acceptance criteria:**

- Tidak ada auto-zoom pada Safari iPhone.
- Pinch-to-zoom manual tetap aktif.
- Semua form utama masih dapat dikirim.
- Build production berhasil.

**Test gate:** `npm run build`, `git diff --check`, dan `git status --short`.

**Bukti IZ-3 sementara:** `npm run build` berhasil pada Next.js 16.3.0, `git diff --check` tidak menemukan whitespace error, dan tidak ditemukan `user-scalable`, `maximum-scale`, atau `minimum-scale` pada source yang diaudit.

**Sisa verifikasi:** uji manual pada iPhone Safari nyata dan pemeriksaan `window.visualViewport.scale` membutuhkan perangkat iPhone atau Safari Web Inspector.

## Bukti Dan Handoff

| Milestone | Commit | File Diubah | Bukti Pengujian | Status | Catatan |
| --- | --- | --- | --- | --- | --- |
| IZ-1 | - | - | - | `READY` | Belum dimulai |
| IZ-2 | working tree | `src/app/globals.css`, `src/components/settings/UserManagementList.tsx` | lint, typecheck, 35 unit test, diff check lulus | `COMPLETE` | Menunggu build dan uji perangkat |
| IZ-3 | working tree | `src/app/globals.css`, `src/components/settings/UserManagementList.tsx` | build lulus; diff check lulus; konfigurasi viewport aman | `IN_PROGRESS` | Uji manual iPhone Safari masih diperlukan |

## Catatan Handoff Aktif

- Penyebab yang telah dibuktikan: `.input` memakai `text-sm` di `src/app/globals.css`, sehingga ukuran teks input adalah 14px.
- `Input`, `Select`, dan `Textarea` bersama berada di `src/components/ui/Form.tsx` dan seluruhnya memakai `.input`.
- IZ-1 selesai. Kontrol native khusus pada `src/components/settings/UserManagementList.tsx` ditemukan dan menjadi target IZ-2.
- Override mobile harus berada setelah blok `@layer utilities` agar menang atas modifier `text-xs` atau `text-sm` yang ditempel pada `.input`.
- IZ-2 selesai. Uji pada iPhone Safari nyata belum tersedia di workspace dan harus dicatat sebagai batas verifikasi IZ-3.
- IZ-3 build selesai. Sebelum status akhir menjadi `COMPLETE`, buka aplikasi pada iPhone Safari, fokuskan field teks di halaman utama, dan pastikan tidak ada auto-zoom serta pinch-to-zoom tetap berfungsi.
- Perubahan lokal `supabase/config.toml` tidak terkait isu ini. Jangan menghapus atau memasukkannya ke commit perbaikan iOS tanpa instruksi user.

## Log Perubahan Dokumen

| Waktu | Agent | Perubahan |
| --- | --- | --- |
| 2026-08-10 WIB | Codex | Membuat roadmap IZ-1 sampai IZ-3. |
| 2026-08-10 WIB | Codex | Menyelesaikan audit IZ-1 dan menetapkan target kontrol native untuk IZ-2. |
| 2026-08-10 WIB | Codex | Menyelesaikan IZ-2: minimum 16px untuk input perangkat sentuh tanpa mematikan pinch-to-zoom. |
| 2026-08-10 WIB | Codex | Menjalankan build IZ-3; build lulus, verifikasi perangkat iPhone ditandai sebagai pending. |
