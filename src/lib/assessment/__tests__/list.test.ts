import { describe, expect, it } from 'vitest';
import { ASSESSMENT_LIST_PAGE_SIZE, assessmentListQuerySchema } from '@/lib/assessment/list';

describe('assessment list query', () => {
  it('uses the task queue and first page by default', () => {
    expect(assessmentListQuerySchema.parse({})).toMatchObject({
      limit: ASSESSMENT_LIST_PAGE_SIZE,
      page: 1,
      status: 'pending',
    });
  });

  it('accepts scoped completion filters', () => {
    const result = assessmentListQuerySchema.parse({
      page: '2',
      branchId: '40000000-0000-0000-0000-000000000001',
      outletId: '50000000-0000-0000-0000-000000000001',
      status: 'in_progress',
      q: '  Budi  ',
    });

    expect(result).toMatchObject({
      page: 2,
      status: 'in_progress',
      q: 'Budi',
    });
  });

  it('rejects invalid status and unsafe scope values', () => {
    expect(
      assessmentListQuerySchema.safeParse({
        status: 'unknown',
        branchId: 'not-a-uuid',
      }).success
    ).toBe(false);
  });
});
