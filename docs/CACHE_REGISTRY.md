# Cache Registry

Dokumen ini adalah daftar cache lintas-request yang diizinkan. Data yang tidak tercantum di sini
tidak boleh dimasukkan ke cache global tanpa review security dan pembaruan dokumen ini.

| Cache | Owner | Klasifikasi | Key | TTL | Tag / invalidator | Fallback |
| --- | --- | --- | --- | --- | --- | --- |
| `period-options` | `src/lib/cache/reference.ts` | Referensi global, field allowlist | `reference-period-options-v1` | 60 detik | `reference:period-options:v1`; create/close period dan cron rollover | Query berikutnya akan mengisi cache kembali; kegagalan diteruskan agar UI menampilkan state error, bukan data user lain |

## Batas keamanan

- Cache ini menggunakan service role hanya untuk data periode global yang tidak mengandung data user,
  branch, permission, atau status autentikasi. Field dibatasi ke `id`, `label`, `status`,
  `start_date`, dan `end_date`.
- Session, profil, assignment cabang, permission write, dashboard, daftar kasir, penilaian,
  notifikasi, dan avatar tidak boleh memakai cache lintas-user.
- Cache invalidation memakai `revalidateTag(tag, 'max')`. Mutation yang mengubah periode wajib
  memanggil invalidator sebelum mengembalikan sukses.
- Log `cache-miss` hanya keluar saat fungsi cache dieksekusi. Log `cache-access` keluar pada setiap
  pembacaan; keduanya tidak memuat identitas atau isi data sensitif.
