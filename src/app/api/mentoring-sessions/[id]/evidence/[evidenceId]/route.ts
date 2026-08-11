import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guards';
import { withApiRoute } from '@/lib/api/route';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import {
  isMentoringEvidencePathFor,
  MENTORING_EVIDENCE_BUCKET,
} from '@/lib/storage/mentoring-evidence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function responseHeaders(etag: string) {
  return {
    'Cache-Control': 'private, no-cache',
    ETag: etag,
    Vary: 'Cookie',
    'X-Content-Type-Options': 'nosniff',
  };
}

function matchesEtag(value: string | null, etag: string) {
  if (!value) return false;
  return value
    .split(',')
    .map((candidate) => candidate.trim())
    .some((candidate) => candidate === etag || candidate === '*');
}

async function handleGET(
  request: Request,
  { params }: { params: Promise<{ id: string; evidenceId: string }> }
) {
  await requirePermission('mentoring');
  const { id: sessionId, evidenceId } = await params;
  if (!UUID.test(sessionId) || !UUID.test(evidenceId)) {
    return NextResponse.json({ error: 'Bukti foto tidak valid' }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: evidence, error: evidenceError } = await supabase
    .from('mentoring_evidence')
    .select(
      'id, session_id, object_path, content_sha256, status, mime_type, byte_size, width, height, created_at, ready_at'
    )
    .eq('id', evidenceId)
    .eq('session_id', sessionId)
    .eq('status', 'ready')
    .maybeSingle();

  if (evidenceError) throw evidenceError;
  if (!evidence || !isMentoringEvidencePathFor(evidence.object_path, sessionId, evidenceId)) {
    return NextResponse.json({ error: 'Foto tidak ditemukan' }, { status: 404 });
  }

  const etag = '"' + evidence.content_sha256 + '"';
  if (matchesEtag(request.headers.get('if-none-match'), etag)) {
    return new NextResponse(null, {
      status: 304,
      headers: responseHeaders(etag),
    });
  }

  const adminSupabase = await createAdminClient();
  const { data, error: downloadError } = await adminSupabase.storage
    .from(MENTORING_EVIDENCE_BUCKET)
    .download(evidence.object_path);
  if (downloadError || !data) {
    return NextResponse.json({ error: 'Foto tidak ditemukan' }, { status: 404 });
  }

  const headers = new Headers(responseHeaders(etag));
  headers.set('Content-Type', 'image/webp');
  headers.set('Content-Length', String(data.size));
  return new NextResponse(data, { headers });
}

export const GET = withApiRoute(handleGET);
