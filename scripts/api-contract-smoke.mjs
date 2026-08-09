const baseUrl = process.env.API_SMOKE_BASE_URL?.replace(/\/$/, '');

if (!baseUrl) {
  console.log('API contract smoke dilewati: set API_SMOKE_BASE_URL ke server test untuk menjalankannya.');
  process.exit(0);
}

const protectedRoutes = [
  '/api/branches',
  '/api/cashiers',
  '/api/leaderboard',
  '/api/mentoring-sessions',
  '/api/notifications',
  '/api/periods',
];

for (const path of protectedRoutes) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: 'manual' });
  const contentType = response.headers.get('content-type') ?? '';
  const payload = await response.json().catch(() => null);

  if (response.status !== 401 || !contentType.includes('application/json')) {
    throw new Error(`${path}: expected JSON 401, received ${response.status} (${contentType})`);
  }

  if (payload?.error?.code !== 'UNAUTHENTICATED' || typeof payload?.error?.requestId !== 'string') {
    throw new Error(`${path}: invalid normalized error payload`);
  }
}

console.log(`API contract smoke passed: ${protectedRoutes.length} protected routes return normalized 401.`);
