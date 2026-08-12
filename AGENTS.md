<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Changelog Requirement

Setiap perubahan yang berdampak pada pengguna wajib memperbarui changelog sebelum pekerjaan
dianggap selesai.

- Sumber update UI: `src/content/updates.ts`.
- Dokumentasi developer: `docs/CHANGELOG.md`.
- Roadmap implementasi: `docs/CHANGELOG_ROADMAP.md` bila perubahan menyentuh mekanisme release.
- Gunakan kategori `Added`, `Changed`, `Fixed`, `Performance`, atau `Security`.
- Sertakan versi, tanggal, dan ringkasan dampak yang terlihat oleh pengguna.
- Jalankan `npm run test:changelog`, `npm run lint`, `npm run typecheck`, `npm run test`, dan
  `npm run build` sebelum menyatakan pekerjaan selesai.
- Jangan menulis secret, token, data pengguna, atau detail insiden sensitif ke changelog.
- Perubahan internal murni boleh tidak masuk UI, tetapi harus dicatat di `docs/CHANGELOG.md`
  bila mengubah operasi, deployment, security, atau kontrak developer.
