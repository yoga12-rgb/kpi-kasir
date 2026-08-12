import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = packageJson.version;
const changelog = fs.readFileSync(path.join(root, 'docs', 'CHANGELOG.md'), 'utf8');
const updates = fs.readFileSync(path.join(root, 'src', 'content', 'updates.ts'), 'utf8');

const errors = [];
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  errors.push(`package.json version is not valid SemVer: ${version}`);
}
if (!changelog.includes(`## [${version}]`)) {
  errors.push(`docs/CHANGELOG.md is missing the current version ${version}`);
}
if (!updates.includes(`version: '${version}'`)) {
  errors.push(`src/content/updates.ts is missing the current version ${version}`);
}
if (!updates.includes('export const appUpdates')) {
  errors.push('src/content/updates.ts must export appUpdates');
}

if (errors.length > 0) {
  console.error('Changelog verification failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Changelog verified for version ${version}.`);
