import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiRoute } from '@/lib/api/route';

const metricSchema = z.object({
  name: z.enum(['TTFB', 'FCP', 'LCP', 'FID', 'CLS', 'INP']),
  value: z.number().finite().min(0).max(120_000),
  rating: z.enum(['good', 'needs-improvement', 'poor']),
  navigationType: z.string().trim().max(40).optional(),
  path: z.string().trim().regex(/^\/[A-Za-z0-9_:./-]*$/).max(180),
});

async function handlePOST(request: Request) {
  if (process.env.NEXT_PUBLIC_PERFORMANCE_TELEMETRY !== 'true') {
    return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  }

  const payload = await request.json().catch(() => null);
  const parsed = metricSchema.safeParse(payload);
  if (parsed.success) {
    console.info('[web-vitals]', parsed.data);
  }

  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}

export const POST = withApiRoute(handlePOST, {
  publicRoute: true,
  rateLimit: { name: 'web-vitals', limit: 120, windowMs: 60_000 },
});
