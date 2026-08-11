import { NextResponse } from 'next/server';
import { withApiRoute } from '@/lib/api/route';
import { getCronContext } from '@/lib/cron/auth';
import {
  isMentoringEvidencePathFor,
  MENTORING_EVIDENCE_BUCKET,
  MENTORING_EVIDENCE_PATH,
} from '@/lib/storage/mentoring-evidence';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STALE_AFTER_MS = 2 * 60 * 60 * 1000;
const BATCH_SIZE = 100;

async function handleGET(request: Request) {
  const { authorized, invocationId } = getCronContext(request);
  if (!authorized) {
    return NextResponse.json(
      { error: 'Unauthorized', invocationId },
      { status: 401, headers: { 'x-invocation-id': invocationId } }
    );
  }

  const startedAt = Date.now();
  try {
    const supabase = await createAdminClient();
    const cutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString();
    const { data: staleRows, error: lookupError } = await supabase
      .from('mentoring_evidence')
      .select('id, session_id, object_path')
      .eq('status', 'pending')
      .lt('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (lookupError) throw lookupError;

    let removed = 0;
    let failed = 0;
    for (const row of staleRows ?? []) {
      const pathMatch = row.object_path.match(MENTORING_EVIDENCE_PATH);
      if (!pathMatch || !isMentoringEvidencePathFor(row.object_path, row.session_id, row.id)) {
        failed += 1;
        console.warn(`[cron:${invocationId}] evidence path rejected`, { evidenceId: row.id });
        continue;
      }

      const { error: removeError } = await supabase.storage
        .from(MENTORING_EVIDENCE_BUCKET)
        .remove([row.object_path]);
      if (removeError) {
        failed += 1;
        console.error(`[cron:${invocationId}] evidence object cleanup failed`, {
          evidenceId: row.id,
        });
        continue;
      }

      const { data: aborted, error: abortError } = await supabase.rpc('abort_mentoring_evidence', {
        p_evidence_id: row.id,
      });
      if (abortError || aborted !== true) {
        failed += 1;
        console.error(`[cron:${invocationId}] evidence row cleanup failed`, {
          evidenceId: row.id,
          error: Boolean(abortError),
        });
        continue;
      }
      removed += 1;
    }

    const { count: remaining, error: remainingError } = await supabase
      .from('mentoring_evidence')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lt('created_at', cutoff);
    if (remainingError) throw remainingError;

    console.info(`[cron:${invocationId}] mentoring evidence cleanup completed`, {
      scanned: staleRows?.length ?? 0,
      removed,
      failed,
      remaining: remaining ?? 0,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(
      {
        success: true,
        invocationId,
        scanned: staleRows?.length ?? 0,
        removed,
        failed,
        remaining: remaining ?? 0,
      },
      { headers: { 'x-invocation-id': invocationId } }
    );
  } catch (error) {
    console.error(`[cron:${invocationId}] mentoring evidence cleanup failed`, error);
    return NextResponse.json(
      { error: 'Gagal membersihkan bukti foto sementara', invocationId },
      { status: 500, headers: { 'x-invocation-id': invocationId } }
    );
  }
}

export const GET = withApiRoute(handleGET, { publicRoute: true });
