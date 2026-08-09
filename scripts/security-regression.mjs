import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sqlPath = resolve(projectRoot, 'supabase', 'tests', 'security_regression.sql');

const containers = spawnSync(
  'docker',
  ['ps', '--filter', 'name=supabase_db_', '--format', '{{.Names}}'],
  { encoding: 'utf8' },
);

if (containers.error || containers.status !== 0) {
  console.error('Gagal menemukan Docker. Pastikan Docker Desktop dan Supabase lokal berjalan.');
  process.exit(1);
}

const container = containers.stdout.trim().split(/\r?\n/).find(Boolean);
if (!container) {
  console.error('Container Supabase lokal tidak ditemukan. Jalankan `supabase start` terlebih dahulu.');
  process.exit(1);
}

let sql;
try {
  sql = readFileSync(sqlPath, 'utf8');
} catch (error) {
  console.error(`Tidak dapat membaca ${sqlPath}:`, error);
  process.exit(1);
}

console.log(`Menjalankan security regression suite pada ${container}...`);
const result = spawnSync(
  'docker',
  [
    'exec',
    '-i',
    container,
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
    '-P',
    'pager=off',
  ],
  { input: sql, encoding: 'utf8', stdio: ['pipe', 'inherit', 'inherit'] },
);

if (result.error) {
  console.error('Gagal menjalankan psql:', result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
