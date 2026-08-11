import {
  MAX_MENTORING_EVIDENCE_BYTES,
  MAX_MENTORING_EVIDENCE_COUNT,
  MAX_MENTORING_EVIDENCE_DIMENSION,
  MENTORING_EVIDENCE_BUCKET,
} from '@/lib/mentoring/evidence-constants';

export {
  MAX_MENTORING_EVIDENCE_BYTES,
  MAX_MENTORING_EVIDENCE_COUNT,
  MAX_MENTORING_EVIDENCE_DIMENSION,
  MENTORING_EVIDENCE_BUCKET,
};

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
export const MENTORING_EVIDENCE_PATH = new RegExp(
  '^session/(' + UUID + ')/evidence-(' + UUID + ')[.]webp$',
  'i'
);

export function mentoringEvidenceProxyUrl(sessionId: string, evidenceId: string) {
  return (
    '/api/mentoring-sessions/' +
    encodeURIComponent(sessionId) +
    '/evidence/' +
    encodeURIComponent(evidenceId)
  );
}

export function isMentoringEvidencePathFor(path: string, sessionId: string, evidenceId: string) {
  const match = path.match(MENTORING_EVIDENCE_PATH);
  return (
    match !== null &&
    match[1].toLowerCase() === sessionId.toLowerCase() &&
    match[2].toLowerCase() === evidenceId.toLowerCase()
  );
}
