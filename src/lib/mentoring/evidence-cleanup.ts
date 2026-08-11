export type EvidenceCleanupAbortOutcome = 'removed' | 'already_removed' | 'failed';

export function classifyEvidenceCleanupAbort(
  aborted: boolean,
  remainingStatus: string | null
): EvidenceCleanupAbortOutcome {
  if (aborted) return 'removed';
  if (remainingStatus === null) return 'already_removed';
  return 'failed';
}
