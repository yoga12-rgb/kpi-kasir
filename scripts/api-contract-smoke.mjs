const baseUrl = process.env.API_SMOKE_BASE_URL?.replace(/\/$/, '');

if (!baseUrl) {
  console.log(
    'API contract smoke dilewati: set API_SMOKE_BASE_URL ke server test untuk menjalankannya.'
  );
  process.exit(0);
}

const protectedRequests = [
  { path: '/api/branches', method: 'GET' },
  { path: '/api/cashiers', method: 'GET' },
  { path: '/api/users', method: 'GET' },
  { path: '/api/leaderboard', method: 'GET' },
  { path: '/api/mentoring-sessions', method: 'GET' },
  {
    path: '/api/mentoring-sessions/00000000-0000-0000-0000-000000000000/evidence',
    method: 'POST',
  },
  {
    path: '/api/mentoring-sessions/00000000-0000-0000-0000-000000000000/evidence/00000000-0000-0000-0000-000000000000',
    method: 'GET',
  },
  { path: '/api/notifications', method: 'GET' },
  { path: '/api/periods', method: 'GET' },
  {
    path: '/api/categories/00000000-0000-0000-0000-000000000000/status',
    method: 'PATCH',
    body: { isActive: false, reason: 'Smoke test unauthorized request' },
  },
  {
    path: '/api/categories/00000000-0000-0000-0000-000000000000/details/00000000-0000-0000-0000-000000000000/status',
    method: 'PATCH',
    body: { isActive: false, reason: 'Smoke test unauthorized request' },
  },
];

for (const request of protectedRequests) {
  const response = await fetch(`${baseUrl}${request.path}`, {
    method: request.method,
    headers: request.body ? { 'Content-Type': 'application/json' } : undefined,
    body: request.body ? JSON.stringify(request.body) : undefined,
    redirect: 'manual',
  });
  const contentType = response.headers.get('content-type') ?? '';
  const payload = await response.json().catch(() => null);

  if (response.status !== 401 || !contentType.includes('application/json')) {
    throw new Error(
      `${request.method} ${request.path}: expected JSON 401, received ${response.status} (${contentType})`
    );
  }

  if (payload?.error?.code !== 'UNAUTHENTICATED' || typeof payload?.error?.requestId !== 'string') {
    throw new Error(`${request.method} ${request.path}: invalid normalized error payload`);
  }
}

console.log(
  `API contract smoke passed: ${protectedRequests.length} protected requests return normalized 401.`
);
