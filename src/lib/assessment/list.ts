import { z } from 'zod';

export const ASSESSMENT_LIST_PAGE_SIZE = 25;

export const assessmentListStatusValues = [
  'pending',
  'not_started',
  'in_progress',
  'complete',
  'all',
] as const;

export type AssessmentListStatus = (typeof assessmentListStatusValues)[number];
export type AssessmentCompletionStatus = Exclude<AssessmentListStatus, 'pending' | 'all'>;

export const assessmentListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(ASSESSMENT_LIST_PAGE_SIZE),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  branchId: z.string().uuid().optional(),
  outletId: z.string().uuid().optional(),
  status: z.enum(assessmentListStatusValues).default('pending'),
  q: z.string().trim().max(100).optional(),
});

export type AssessmentListQuery = z.infer<typeof assessmentListQuerySchema>;

export interface AssessmentListItem {
  id: string;
  name: string;
  avatarSrc: string | null;
  outletId: string;
  outletName: string;
  branchId: string;
  branchName: string;
  branchCode: string | null;
  status: AssessmentCompletionStatus;
  assessedDetails: number;
  totalDetails: number;
  score: number;
}

export interface AssessmentListResponse {
  cashiers: AssessmentListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}
