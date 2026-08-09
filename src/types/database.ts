export type UserRole = 'admin' | 'manager' | 'supervisor';

export type DetailType = 'scale' | 'deduction';

export type PeriodStatus = 'open' | 'closed';

export type NotificationType = 'reminder_unassessed' | 'low_score_alert' | 'system';

export type Json = Record<string, unknown>;

export interface AppSetup {
  id: string;
  admin_created: boolean;
  completed_at: string | null;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Outlet {
  id: string;
  branch_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Cashier {
  id: string;
  name: string;
  outlet_id: string;
  employment_start_date: string;
  is_active: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CashierOutletHistory {
  id: string;
  cashier_id: string;
  outlet_id: string;
  started_at: string;
  ended_at: string | null;
}

export interface UserBranch {
  id: string;
  user_id: string;
  branch_id: string;
  assigned_at: string;
}

export interface Category {
  id: string;
  name: string;
  weight: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategoryWeightHistory {
  id: string;
  category_id: string;
  period_id: string;
  weight: number;
}

export interface Detail {
  id: string;
  category_id: string;
  name: string;
  type: DetailType;
  scale_max: number | null;
  deduction_points: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DetailConfigHistory {
  id: string;
  detail_id: string;
  period_id: string;
  scale_max: number | null;
  deduction_points: number | null;
}

export interface Period {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  status: PeriodStatus;
  closed_at: string | null;
  created_at: string;
}

export interface Assessment {
  id: string;
  period_id: string;
  cashier_id: string;
  detail_id: string;
  scale_value: number | null;
  normalized_score: number;
  assessed_by: string;
  assessed_at: string;
}

export interface DeductionEvent {
  id: string;
  assessment_id: string;
  note: string | null;
  points: number;
  occurred_at: string;
  created_by: string;
  created_at: string;
}

export interface CashierPeriodScore {
  id: string;
  period_id: string;
  cashier_id: string;
  total_score: number;
  category_scores: Json;
  is_locked: boolean;
  updated_at: string;
}

export interface LeaderboardEntry {
  id: string;
  period_id: string;
  cashier_id: string;
  outlet_id: string;
  branch_id: string;
  total_score: number;
  category_scores: Json;
  rank_outlet: number | null;
  rank_branch: number | null;
  rank_global: number | null;
}

export interface CashierCumulativeScore {
  id: string;
  cashier_id: string;
  cumulative_score: number;
  periods_count: number;
  updated_at: string;
}

export interface MentoringSession {
  id: string;
  outlet_id: string;
  conducted_by: string;
  visited_date: string;
  note_outlet: string | null;
  created_at: string;
  updated_at: string;
}

export interface MentoringCashierNote {
  id: string;
  session_id: string;
  cashier_id: string;
  note: string;
}

export interface Invite {
  id: string;
  invite_name: string;
  email: string | null;
  role: UserRole;
  token: string;
  branch_ids: string[];
  expires_at: string;
  used_at: string | null;
  accepted_user_id: string | null;
  created_by: string;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  payload: Json | null;
  is_read: boolean;
  created_at: string;
}

export interface PeriodLog {
  id: string;
  action: string;
  period_id: string | null;
  performed_by: string | null;
  detail: Json | null;
  created_at: string;
}

/**
 * Skema database dibuat longgar (`any`) untuk tahap development.
 * Tipe entitas (Branch, Outlet, Cashier, dll.) tetap diekspor di atas untuk
 * autocomplete & penggunaan manual. Generated types dari Supabase CLI
 * (`supabase gen types typescript`) dapat menggantikan ini saat DB siap.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
