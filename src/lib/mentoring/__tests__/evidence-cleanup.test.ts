import { describe, expect, it } from 'vitest';
import { classifyEvidenceCleanupAbort } from '../evidence-cleanup';

describe('mentoring evidence cleanup', () => {
  it('classifies a successful abort as removed', () => {
    expect(classifyEvidenceCleanupAbort(true, null)).toBe('removed');
  });

  it('treats a row removed by another invocation as idempotent', () => {
    expect(classifyEvidenceCleanupAbort(false, null)).toBe('already_removed');
  });

  it.each(['pending', 'ready'])('keeps an existing %s row as a failure', (status) => {
    expect(classifyEvidenceCleanupAbort(false, status)).toBe('failed');
  });
});
