import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guards';
import { MAX_MENTORING_EVIDENCE_INPUT_BYTES } from '@/lib/mentoring/evidence-constants';
import { withApiRoute } from '@/lib/api/route';
import { createAdminClient } from '@/lib/supabase/server';
import {
  isMentoringEvidencePathFor,
  mentoringEvidenceProxyUrl,
  MENTORING_EVIDENCE_BUCKET,
} from '@/lib/storage/mentoring-evidence';
import {
  canonicalizeMentoringEvidence,
  MentoringEvidenceValidationError,
} from '@/lib/storage/mentoring-evidence-validation';
import type { Json, MentoringEvidence } from '@/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_REQUEST_BYTES = MAX_MENTORING_EVIDENCE_INPUT_BYTES + 64 * 1024;

type SessionScope = {
  conducted_by: string;
  id: string;
  outlet:
    | {
        branch_id: string;
        branch: { is_active: boolean } | { is_active: boolean }[] | null;
        is_active: boolean;
      }
    | {
        branch_id: string;
        branch: { is_active: boolean } | { is_active: boolean }[] | null;
        is_active: boolean;
      }[]
    | null;
  outlet_id: string;
};

type EvidenceRpcPayload = {
  evidence?: MentoringEvidence;
  was_existing?: boolean;
};

function relation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function asEvidenceRpcPayload(value: Json | null): EvidenceRpcPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const payload = value as { evidence?: unknown; was_existing?: unknown };
  if (
    !payload.evidence ||
    typeof payload.evidence !== 'object' ||
    Array.isArray(payload.evidence)
  ) {
    return null;
  }
  return {
    evidence: payload.evidence as MentoringEvidence,
    was_existing: payload.was_existing === true,
  };
}

function evidenceResponse(evidence: MentoringEvidence, sessionId: string) {
  return {
    id: evidence.id,
    sessionId: evidence.session_id,
    sortOrder: evidence.sort_order,
    status: evidence.status,
    mimeType: evidence.mime_type,
    byteSize: evidence.byte_size,
    width: evidence.width,
    height: evidence.height,
    createdAt: evidence.created_at,
    readyAt: evidence.ready_at,
    url: mentoringEvidenceProxyUrl(sessionId, evidence.id),
  };
}

function rpcErrorStatus(message: string) {
  if (/maksimal|duplicate|sedang diupload/i.test(message)) return 409;
  if (/permission|actor|akses|hanya pencatat|tidak dapat menyelesaikan/i.test(message)) return 403;
  if (/sesi pendampingan|tidak ditemukan/i.test(message)) return 404;
  return 400;
}

async function abortPendingRow(
  adminSupabase: Awaited<ReturnType<typeof createAdminClient>>,
  evidenceId: string
) {
  const { data: aborted, error: abortError } = await adminSupabase.rpc('abort_mentoring_evidence', {
    p_evidence_id: evidenceId,
  });

  if (abortError || aborted !== true) {
    console.error('Mentoring evidence reservation abort failed', {
      evidenceId,
      abortFailed: Boolean(abortError),
    });
  }
}

async function compensateReservation(
  adminSupabase: Awaited<ReturnType<typeof createAdminClient>>,
  evidenceId: string,
  objectPath: string
) {
  const { error: removeError } = await adminSupabase.storage
    .from(MENTORING_EVIDENCE_BUCKET)
    .remove([objectPath]);

  if (removeError) {
    // Keep the pending row so the cleanup cron can retry object removal safely.
    console.error('Mentoring evidence object rollback failed', { evidenceId });
    return;
  }

  await abortPendingRow(adminSupabase, evidenceId);
}

async function getSessionScope(
  adminSupabase: Awaited<ReturnType<typeof createAdminClient>>,
  sessionId: string
) {
  const { data, error } = await adminSupabase
    .from('mentoring_session')
    .select(
      'id, outlet_id, conducted_by, outlet!inner(branch_id, is_active, branch!inner(is_active))'
    )
    .eq('id', sessionId)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as SessionScope | null;
}

async function handlePOST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requirePermission('mentoring');
  if (process.env.MENTORING_EVIDENCE_UPLOAD_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Upload bukti foto belum diaktifkan' }, { status: 503 });
  }

  const { id: sessionId } = await params;
  if (!UUID.test(sessionId)) {
    return NextResponse.json({ error: 'Sesi pendampingan tidak valid' }, { status: 400 });
  }

  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: 'Ukuran request terlalu besar' }, { status: 413 });
  }

  const adminSupabase = await createAdminClient();
  const session = await getSessionScope(adminSupabase, sessionId);
  const outlet = relation(session?.outlet);
  const branch = relation(outlet?.branch);
  if (!session || !outlet || !branch || !outlet.is_active || !branch.is_active) {
    return NextResponse.json({ error: 'Sesi pendampingan tidak ditemukan' }, { status: 404 });
  }
  if (profile.role !== 'admin' && session.conducted_by !== profile.id) {
    return NextResponse.json(
      { error: 'Hanya pencatat sesi yang dapat menambahkan bukti foto' },
      { status: 403 }
    );
  }
  if (profile.role !== 'admin') {
    const { data: assignment, error: assignmentError } = await adminSupabase
      .from('user_branch')
      .select('branch_id')
      .eq('user_id', profile.id)
      .eq('branch_id', outlet.branch_id)
      .maybeSingle();
    if (assignmentError) throw assignmentError;
    if (!assignment) {
      return NextResponse.json({ error: 'Tidak memiliki akses ke cabang sesi' }, { status: 403 });
    }
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'File foto tidak ditemukan' }, { status: 400 });
  }
  if (file.size > MAX_MENTORING_EVIDENCE_INPUT_BYTES) {
    return NextResponse.json({ error: 'Ukuran file maksimal 1 MB' }, { status: 413 });
  }

  let canonical;
  try {
    canonical = await canonicalizeMentoringEvidence(
      Buffer.from(await file.arrayBuffer()),
      file.type || undefined
    );
  } catch (error) {
    if (error instanceof MentoringEvidenceValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const { data: reservationData, error: reservationError } = await adminSupabase.rpc(
    'reserve_mentoring_evidence',
    {
      p_session_id: sessionId,
      p_actor_id: profile.id,
      p_content_sha256: canonical.contentSha256,
      p_byte_size: canonical.byteSize,
      p_width: canonical.width,
      p_height: canonical.height,
    }
  );
  if (reservationError) {
    return NextResponse.json(
      { error: reservationError.message },
      { status: rpcErrorStatus(reservationError.message) }
    );
  }

  const reservation = asEvidenceRpcPayload(reservationData);
  if (!reservation?.evidence) {
    throw new Error('Reservation bukti foto mengembalikan data tidak valid');
  }

  const evidence = reservation.evidence;
  if (!isMentoringEvidencePathFor(evidence.object_path, sessionId, evidence.id)) {
    if (!reservation.was_existing) {
      await abortPendingRow(adminSupabase, evidence.id);
    }
    throw new Error('Path bukti foto tidak valid');
  }

  if (reservation.was_existing) {
    if (evidence.status !== 'ready') {
      return NextResponse.json(
        { error: 'Foto yang sama sedang diproses. Coba lagi sebentar.' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { evidence: evidenceResponse(evidence, sessionId), deduplicated: true },
      { status: 200 }
    );
  }

  const { error: uploadError } = await adminSupabase.storage
    .from(MENTORING_EVIDENCE_BUCKET)
    .upload(evidence.object_path, canonical.buffer, {
      cacheControl: '0',
      contentType: canonical.mimeType,
      upsert: false,
    });
  if (uploadError) {
    await compensateReservation(adminSupabase, evidence.id, evidence.object_path);
    return NextResponse.json({ error: 'Gagal menyimpan bukti foto' }, { status: 502 });
  }

  const { data: finalized, error: finalizeError } = await adminSupabase.rpc(
    'finalize_mentoring_evidence',
    {
      p_actor_id: profile.id,
      p_byte_size: canonical.byteSize,
      p_content_sha256: canonical.contentSha256,
      p_evidence_id: evidence.id,
      p_height: canonical.height,
      p_width: canonical.width,
    }
  );
  if (finalizeError || !finalized) {
    await compensateReservation(adminSupabase, evidence.id, evidence.object_path);
    return NextResponse.json({ error: 'Bukti foto belum dapat diselesaikan' }, { status: 502 });
  }

  return NextResponse.json(
    { evidence: evidenceResponse(finalized, sessionId), deduplicated: false },
    { status: 201 }
  );
}

export const POST = withApiRoute(handlePOST, {
  rateLimit: { name: 'mentoring-evidence-upload', limit: 12, windowMs: 15 * 60_000 },
});
