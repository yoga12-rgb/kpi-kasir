import { describe, expect, it } from 'vitest';
import {
  isMentoringEvidencePathFor,
  mentoringEvidenceProxyUrl,
  MENTORING_EVIDENCE_PATH,
} from '../mentoring-evidence';

const sessionId = '11111111-1111-1111-1111-111111111111';
const evidenceId = '22222222-2222-2222-2222-222222222222';

describe('mentoring evidence object paths', () => {
  it('only accepts the canonical session/evidence WebP path', () => {
    const path = `session/${sessionId}/evidence-${evidenceId}.webp`;

    expect(MENTORING_EVIDENCE_PATH.test(path)).toBe(true);
    expect(isMentoringEvidencePathFor(path, sessionId, evidenceId)).toBe(true);
    expect(isMentoringEvidencePathFor(path, evidenceId, sessionId)).toBe(false);
    expect(isMentoringEvidencePathFor(`${path}.bak`, sessionId, evidenceId)).toBe(false);
  });

  it('builds a same-origin protected delivery URL', () => {
    expect(mentoringEvidenceProxyUrl(sessionId, evidenceId)).toBe(
      `/api/mentoring-sessions/${sessionId}/evidence/${evidenceId}`
    );
  });
});
