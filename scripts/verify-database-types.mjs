import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/types/database.ts', import.meta.url), 'utf8');
const requiredMarkers = [
  'export type Database = {',
  '      branch: {',
  '      users: {',
  '      admin_update_user: {',
];

if (source.includes('export type Database = any') || source.includes('export type Database = unknown')) {
  throw new Error('Generated Supabase Database type must not fall back to any/unknown.');
}

for (const marker of requiredMarkers) {
  if (!source.includes(marker)) {
    throw new Error(`Generated Supabase Database type is missing marker: ${marker}`);
  }
}

console.log('Generated Supabase Database types verified.');
