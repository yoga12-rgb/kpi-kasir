const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_APP_URL',
  'CRON_SECRET',
];

const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  throw new Error(`Missing required operations environment: ${missing.join(', ')}`);
}

if (process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Service role key must never use a NEXT_PUBLIC_ variable.');
}

const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
const appUrl = new URL(process.env.NEXT_PUBLIC_APP_URL);
const isProduction = process.env.NODE_ENV === 'production' || process.env.OPS_ENV === 'production';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const cronSecret = process.env.CRON_SECRET;

if (anonKey === serviceRoleKey) {
  throw new Error('Supabase anon and service-role keys must be different.');
}

if (isProduction) {
  if (supabaseUrl.protocol !== 'https:' || appUrl.protocol !== 'https:') {
    throw new Error('Production Supabase and application origins must use HTTPS.');
  }

  if (cronSecret.length < 32 || /change-me|replace|ci-|local|dev/i.test(cronSecret)) {
    throw new Error('Production CRON_SECRET must be a unique random secret of at least 32 characters.');
  }

  const allowlist = (process.env.APP_ORIGIN_ALLOWLIST ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (!allowlist.includes(appUrl.origin)) {
    throw new Error('APP_ORIGIN_ALLOWLIST must include NEXT_PUBLIC_APP_URL origin in production.');
  }
}

console.log(
  `Operations preflight passed (${isProduction ? 'production' : 'non-production'}): ` +
    `app=${appUrl.origin}, supabase=${supabaseUrl.origin}, service-role=server-only`
);
