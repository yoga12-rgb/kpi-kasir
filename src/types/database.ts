export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      app_setup: {
        Row: {
          admin_created: boolean;
          completed_at: string | null;
          id: string;
          setup_attempt_count: number;
          setup_attempt_window_at: string | null;
          setup_claim_id: string | null;
          setup_claimed_at: string | null;
        };
        Insert: {
          admin_created?: boolean;
          completed_at?: string | null;
          id?: string;
          setup_attempt_count?: number;
          setup_attempt_window_at?: string | null;
          setup_claim_id?: string | null;
          setup_claimed_at?: string | null;
        };
        Update: {
          admin_created?: boolean;
          completed_at?: string | null;
          id?: string;
          setup_attempt_count?: number;
          setup_attempt_window_at?: string | null;
          setup_claim_id?: string | null;
          setup_claimed_at?: string | null;
        };
        Relationships: [];
      };
      assessment: {
        Row: {
          assessed_at: string;
          assessed_by: string;
          cashier_id: string;
          detail_id: string;
          id: string;
          normalized_score: number;
          period_id: string;
          scale_value: number | null;
        };
        Insert: {
          assessed_at?: string;
          assessed_by: string;
          cashier_id: string;
          detail_id: string;
          id?: string;
          normalized_score?: number;
          period_id: string;
          scale_value?: number | null;
        };
        Update: {
          assessed_at?: string;
          assessed_by?: string;
          cashier_id?: string;
          detail_id?: string;
          id?: string;
          normalized_score?: number;
          period_id?: string;
          scale_value?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'assessment_assessed_by_fkey';
            columns: ['assessed_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assessment_cashier_id_fkey';
            columns: ['cashier_id'];
            isOneToOne: false;
            referencedRelation: 'cashier';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assessment_detail_id_fkey';
            columns: ['detail_id'];
            isOneToOne: false;
            referencedRelation: 'detail';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assessment_period_id_fkey';
            columns: ['period_id'];
            isOneToOne: false;
            referencedRelation: 'period';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          after_data: Json | null;
          before_data: Json | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          after_data?: Json | null;
          before_data?: Json | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          after_data?: Json | null;
          before_data?: Json | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_log_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      branch: {
        Row: {
          code: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          updated_at: string;
        };
        Insert: {
          code?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          updated_at?: string;
        };
        Update: {
          code?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cashier: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          employment_start_date: string;
          id: string;
          is_active: boolean;
          name: string;
          outlet_id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          employment_start_date?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          outlet_id: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          employment_start_date?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          outlet_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cashier_outlet_id_fkey';
            columns: ['outlet_id'];
            isOneToOne: false;
            referencedRelation: 'outlet';
            referencedColumns: ['id'];
          },
        ];
      };
      cashier_cumulative_score: {
        Row: {
          cashier_id: string;
          cumulative_score: number;
          id: string;
          periods_count: number;
          updated_at: string;
        };
        Insert: {
          cashier_id: string;
          cumulative_score?: number;
          id?: string;
          periods_count?: number;
          updated_at?: string;
        };
        Update: {
          cashier_id?: string;
          cumulative_score?: number;
          id?: string;
          periods_count?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cashier_cumulative_score_cashier_id_fkey';
            columns: ['cashier_id'];
            isOneToOne: true;
            referencedRelation: 'cashier';
            referencedColumns: ['id'];
          },
        ];
      };
      cashier_outlet_history: {
        Row: {
          cashier_id: string;
          ended_at: string | null;
          id: string;
          outlet_id: string;
          started_at: string;
        };
        Insert: {
          cashier_id: string;
          ended_at?: string | null;
          id?: string;
          outlet_id: string;
          started_at?: string;
        };
        Update: {
          cashier_id?: string;
          ended_at?: string | null;
          id?: string;
          outlet_id?: string;
          started_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cashier_outlet_history_cashier_id_fkey';
            columns: ['cashier_id'];
            isOneToOne: false;
            referencedRelation: 'cashier';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cashier_outlet_history_outlet_id_fkey';
            columns: ['outlet_id'];
            isOneToOne: false;
            referencedRelation: 'outlet';
            referencedColumns: ['id'];
          },
        ];
      };
      cashier_period_completion: {
        Row: {
          assessed_details: number;
          cashier_id: string;
          completed_at: string | null;
          id: string;
          period_id: string;
          status: string;
          total_details: number;
          updated_at: string;
        };
        Insert: {
          assessed_details?: number;
          cashier_id: string;
          completed_at?: string | null;
          id?: string;
          period_id: string;
          status?: string;
          total_details?: number;
          updated_at?: string;
        };
        Update: {
          assessed_details?: number;
          cashier_id?: string;
          completed_at?: string | null;
          id?: string;
          period_id?: string;
          status?: string;
          total_details?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cashier_period_completion_cashier_id_fkey';
            columns: ['cashier_id'];
            isOneToOne: false;
            referencedRelation: 'cashier';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cashier_period_completion_period_id_fkey';
            columns: ['period_id'];
            isOneToOne: false;
            referencedRelation: 'period';
            referencedColumns: ['id'];
          },
        ];
      };
      cashier_period_roster: {
        Row: {
          avatar_path: string | null;
          branch_id: string;
          branch_name: string;
          cashier_id: string;
          cashier_name: string;
          created_at: string;
          eligible_from: string;
          entry_reason: string;
          id: string;
          outlet_id: string;
          outlet_name: string;
          period_id: string;
        };
        Insert: {
          avatar_path?: string | null;
          branch_id: string;
          branch_name: string;
          cashier_id: string;
          cashier_name: string;
          created_at?: string;
          eligible_from: string;
          entry_reason?: string;
          id?: string;
          outlet_id: string;
          outlet_name: string;
          period_id: string;
        };
        Update: {
          avatar_path?: string | null;
          branch_id?: string;
          branch_name?: string;
          cashier_id?: string;
          cashier_name?: string;
          created_at?: string;
          eligible_from?: string;
          entry_reason?: string;
          id?: string;
          outlet_id?: string;
          outlet_name?: string;
          period_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cashier_period_roster_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branch';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cashier_period_roster_cashier_id_fkey';
            columns: ['cashier_id'];
            isOneToOne: false;
            referencedRelation: 'cashier';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cashier_period_roster_outlet_id_fkey';
            columns: ['outlet_id'];
            isOneToOne: false;
            referencedRelation: 'outlet';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cashier_period_roster_period_id_fkey';
            columns: ['period_id'];
            isOneToOne: false;
            referencedRelation: 'period';
            referencedColumns: ['id'];
          },
        ];
      };
      cashier_period_score: {
        Row: {
          cashier_id: string;
          category_scores: Json;
          id: string;
          is_locked: boolean;
          period_id: string;
          total_score: number;
          updated_at: string;
        };
        Insert: {
          cashier_id: string;
          category_scores?: Json;
          id?: string;
          is_locked?: boolean;
          period_id: string;
          total_score?: number;
          updated_at?: string;
        };
        Update: {
          cashier_id?: string;
          category_scores?: Json;
          id?: string;
          is_locked?: boolean;
          period_id?: string;
          total_score?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cashier_period_score_cashier_id_fkey';
            columns: ['cashier_id'];
            isOneToOne: false;
            referencedRelation: 'cashier';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cashier_period_score_period_id_fkey';
            columns: ['period_id'];
            isOneToOne: false;
            referencedRelation: 'period';
            referencedColumns: ['id'];
          },
        ];
      };
      cashier_status_history: {
        Row: {
          cashier_id: string;
          changed_by: string | null;
          created_at: string;
          effective_at: string;
          id: string;
          is_active: boolean;
          reason: string;
        };
        Insert: {
          cashier_id: string;
          changed_by?: string | null;
          created_at?: string;
          effective_at: string;
          id?: string;
          is_active: boolean;
          reason: string;
        };
        Update: {
          cashier_id?: string;
          changed_by?: string | null;
          created_at?: string;
          effective_at?: string;
          id?: string;
          is_active?: boolean;
          reason?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cashier_status_history_cashier_id_fkey';
            columns: ['cashier_id'];
            isOneToOne: false;
            referencedRelation: 'cashier';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cashier_status_history_changed_by_fkey';
            columns: ['changed_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      category: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          updated_at: string;
          weight: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          updated_at?: string;
          weight?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          updated_at?: string;
          weight?: number;
        };
        Relationships: [];
      };
      category_weight_history: {
        Row: {
          category_id: string;
          category_name: string | null;
          id: string;
          period_id: string;
          weight: number;
        };
        Insert: {
          category_id: string;
          category_name?: string | null;
          id?: string;
          period_id: string;
          weight: number;
        };
        Update: {
          category_id?: string;
          category_name?: string | null;
          id?: string;
          period_id?: string;
          weight?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'category_weight_history_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'category';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'category_weight_history_period_id_fkey';
            columns: ['period_id'];
            isOneToOne: false;
            referencedRelation: 'period';
            referencedColumns: ['id'];
          },
        ];
      };
      deduction_event: {
        Row: {
          assessment_id: string;
          created_at: string;
          created_by: string;
          id: string;
          note: string | null;
          occurred_at: string;
          points: number;
        };
        Insert: {
          assessment_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          note?: string | null;
          occurred_at?: string;
          points: number;
        };
        Update: {
          assessment_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          note?: string | null;
          occurred_at?: string;
          points?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'deduction_event_assessment_id_fkey';
            columns: ['assessment_id'];
            isOneToOne: false;
            referencedRelation: 'assessment';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'deduction_event_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      detail: {
        Row: {
          category_id: string;
          created_at: string;
          deduction_points: number | null;
          id: string;
          is_active: boolean;
          name: string;
          scale_max: number | null;
          type: Database['public']['Enums']['detail_type'];
          updated_at: string;
        };
        Insert: {
          category_id: string;
          created_at?: string;
          deduction_points?: number | null;
          id?: string;
          is_active?: boolean;
          name: string;
          scale_max?: number | null;
          type: Database['public']['Enums']['detail_type'];
          updated_at?: string;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          deduction_points?: number | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          scale_max?: number | null;
          type?: Database['public']['Enums']['detail_type'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'detail_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'category';
            referencedColumns: ['id'];
          },
        ];
      };
      detail_config_history: {
        Row: {
          category_id: string | null;
          deduction_points: number | null;
          detail_id: string;
          detail_name: string | null;
          detail_type: Database['public']['Enums']['detail_type'] | null;
          id: string;
          period_id: string;
          scale_max: number | null;
        };
        Insert: {
          category_id?: string | null;
          deduction_points?: number | null;
          detail_id: string;
          detail_name?: string | null;
          detail_type?: Database['public']['Enums']['detail_type'] | null;
          id?: string;
          period_id: string;
          scale_max?: number | null;
        };
        Update: {
          category_id?: string | null;
          deduction_points?: number | null;
          detail_id?: string;
          detail_name?: string | null;
          detail_type?: Database['public']['Enums']['detail_type'] | null;
          id?: string;
          period_id?: string;
          scale_max?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'detail_config_history_detail_id_fkey';
            columns: ['detail_id'];
            isOneToOne: false;
            referencedRelation: 'detail';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'detail_config_history_period_id_fkey';
            columns: ['period_id'];
            isOneToOne: false;
            referencedRelation: 'period';
            referencedColumns: ['id'];
          },
        ];
      };
      invite: {
        Row: {
          accepted_user_id: string | null;
          branch_ids: string[];
          created_at: string;
          created_by: string;
          email: string | null;
          expires_at: string;
          id: string;
          invite_name: string;
          revoked_at: string | null;
          revoked_by: string | null;
          role: Database['public']['Enums']['user_role'];
          token: string;
          used_at: string | null;
        };
        Insert: {
          accepted_user_id?: string | null;
          branch_ids?: string[];
          created_at?: string;
          created_by: string;
          email?: string | null;
          expires_at: string;
          id?: string;
          invite_name: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          role: Database['public']['Enums']['user_role'];
          token: string;
          used_at?: string | null;
        };
        Update: {
          accepted_user_id?: string | null;
          branch_ids?: string[];
          created_at?: string;
          created_by?: string;
          email?: string | null;
          expires_at?: string;
          id?: string;
          invite_name?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          role?: Database['public']['Enums']['user_role'];
          token?: string;
          used_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'invite_accepted_user_id_fkey';
            columns: ['accepted_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invite_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invite_revoked_by_fkey';
            columns: ['revoked_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      leaderboard_entry: {
        Row: {
          avatar_path: string | null;
          branch_id: string;
          branch_name: string | null;
          cashier_id: string;
          cashier_name: string | null;
          category_scores: Json;
          id: string;
          outlet_id: string;
          outlet_name: string | null;
          period_id: string;
          rank_branch: number | null;
          rank_global: number | null;
          rank_outlet: number | null;
          total_score: number;
        };
        Insert: {
          avatar_path?: string | null;
          branch_id: string;
          branch_name?: string | null;
          cashier_id: string;
          cashier_name?: string | null;
          category_scores?: Json;
          id?: string;
          outlet_id: string;
          outlet_name?: string | null;
          period_id: string;
          rank_branch?: number | null;
          rank_global?: number | null;
          rank_outlet?: number | null;
          total_score: number;
        };
        Update: {
          avatar_path?: string | null;
          branch_id?: string;
          branch_name?: string | null;
          cashier_id?: string;
          cashier_name?: string | null;
          category_scores?: Json;
          id?: string;
          outlet_id?: string;
          outlet_name?: string | null;
          period_id?: string;
          rank_branch?: number | null;
          rank_global?: number | null;
          rank_outlet?: number | null;
          total_score?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'leaderboard_entry_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branch';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'leaderboard_entry_cashier_id_fkey';
            columns: ['cashier_id'];
            isOneToOne: false;
            referencedRelation: 'cashier';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'leaderboard_entry_outlet_id_fkey';
            columns: ['outlet_id'];
            isOneToOne: false;
            referencedRelation: 'outlet';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'leaderboard_entry_period_id_fkey';
            columns: ['period_id'];
            isOneToOne: false;
            referencedRelation: 'period';
            referencedColumns: ['id'];
          },
        ];
      };
      mentoring_cashier_note: {
        Row: {
          cashier_id: string;
          id: string;
          note: string;
          session_id: string;
        };
        Insert: {
          cashier_id: string;
          id?: string;
          note: string;
          session_id: string;
        };
        Update: {
          cashier_id?: string;
          id?: string;
          note?: string;
          session_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'mentoring_cashier_note_cashier_id_fkey';
            columns: ['cashier_id'];
            isOneToOne: false;
            referencedRelation: 'cashier';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'mentoring_cashier_note_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'mentoring_session';
            referencedColumns: ['id'];
          },
        ];
      };
      mentoring_evidence: {
        Row: {
          byte_size: number;
          content_sha256: string;
          created_at: string;
          created_by: string;
          height: number;
          id: string;
          mime_type: string;
          object_path: string;
          ready_at: string | null;
          session_id: string;
          sort_order: number;
          status: string;
          width: number;
        };
        Insert: {
          byte_size: number;
          content_sha256: string;
          created_at?: string;
          created_by: string;
          height: number;
          id?: string;
          mime_type?: string;
          object_path: string;
          ready_at?: string | null;
          session_id: string;
          sort_order: number;
          status?: string;
          width: number;
        };
        Update: {
          byte_size?: number;
          content_sha256?: string;
          created_at?: string;
          created_by?: string;
          height?: number;
          id?: string;
          mime_type?: string;
          object_path?: string;
          ready_at?: string | null;
          session_id?: string;
          sort_order?: number;
          status?: string;
          width?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'mentoring_evidence_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'mentoring_evidence_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'mentoring_session';
            referencedColumns: ['id'];
          },
        ];
      };
      mentoring_session: {
        Row: {
          conducted_by: string;
          created_at: string;
          id: string;
          note_outlet: string | null;
          outlet_id: string;
          updated_at: string;
          visited_date: string;
        };
        Insert: {
          conducted_by: string;
          created_at?: string;
          id?: string;
          note_outlet?: string | null;
          outlet_id: string;
          updated_at?: string;
          visited_date: string;
        };
        Update: {
          conducted_by?: string;
          created_at?: string;
          id?: string;
          note_outlet?: string | null;
          outlet_id?: string;
          updated_at?: string;
          visited_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'mentoring_session_conducted_by_fkey';
            columns: ['conducted_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'mentoring_session_outlet_id_fkey';
            columns: ['outlet_id'];
            isOneToOne: false;
            referencedRelation: 'outlet';
            referencedColumns: ['id'];
          },
        ];
      };
      notification: {
        Row: {
          body: string;
          created_at: string;
          dedupe_key: string | null;
          entity_id: string | null;
          entity_type: string | null;
          id: string;
          is_read: boolean;
          payload: Json | null;
          period_id: string | null;
          title: string;
          type: Database['public']['Enums']['notification_type'];
          user_id: string;
        };
        Insert: {
          body?: string;
          created_at?: string;
          dedupe_key?: string | null;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          is_read?: boolean;
          payload?: Json | null;
          period_id?: string | null;
          title: string;
          type?: Database['public']['Enums']['notification_type'];
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          dedupe_key?: string | null;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          is_read?: boolean;
          payload?: Json | null;
          period_id?: string | null;
          title?: string;
          type?: Database['public']['Enums']['notification_type'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_period_id_fkey';
            columns: ['period_id'];
            isOneToOne: false;
            referencedRelation: 'period';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notification_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      outlet: {
        Row: {
          branch_id: string;
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          updated_at: string;
        };
        Insert: {
          branch_id: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          updated_at?: string;
        };
        Update: {
          branch_id?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'outlet_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branch';
            referencedColumns: ['id'];
          },
        ];
      };
      period: {
        Row: {
          closed_at: string | null;
          created_at: string;
          end_date: string;
          id: string;
          label: string;
          start_date: string;
          status: Database['public']['Enums']['period_status'];
        };
        Insert: {
          closed_at?: string | null;
          created_at?: string;
          end_date: string;
          id?: string;
          label: string;
          start_date: string;
          status?: Database['public']['Enums']['period_status'];
        };
        Update: {
          closed_at?: string | null;
          created_at?: string;
          end_date?: string;
          id?: string;
          label?: string;
          start_date?: string;
          status?: Database['public']['Enums']['period_status'];
        };
        Relationships: [];
      };
      period_log: {
        Row: {
          action: string;
          created_at: string;
          detail: Json | null;
          id: string;
          performed_by: string | null;
          period_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          detail?: Json | null;
          id?: string;
          performed_by?: string | null;
          period_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          detail?: Json | null;
          id?: string;
          performed_by?: string | null;
          period_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'period_log_performed_by_fkey';
            columns: ['performed_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'period_log_period_id_fkey';
            columns: ['period_id'];
            isOneToOne: false;
            referencedRelation: 'period';
            referencedColumns: ['id'];
          },
        ];
      };
      role_permission: {
        Row: {
          enabled: boolean;
          permission: string;
          role: Database['public']['Enums']['user_role'];
          updated_at: string;
        };
        Insert: {
          enabled?: boolean;
          permission: string;
          role: Database['public']['Enums']['user_role'];
          updated_at?: string;
        };
        Update: {
          enabled?: boolean;
          permission?: string;
          role?: Database['public']['Enums']['user_role'];
          updated_at?: string;
        };
        Relationships: [];
      };
      user_branch: {
        Row: {
          assigned_at: string;
          branch_id: string;
          id: string;
          user_id: string;
        };
        Insert: {
          assigned_at?: string;
          branch_id: string;
          id?: string;
          user_id: string;
        };
        Update: {
          assigned_at?: string;
          branch_id?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_branch_branch_id_fkey';
            columns: ['branch_id'];
            isOneToOne: false;
            referencedRelation: 'branch';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_branch_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      users: {
        Row: {
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          is_active: boolean;
          role: Database['public']['Enums']['user_role'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          full_name: string;
          id: string;
          is_active?: boolean;
          role?: Database['public']['Enums']['user_role'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          role?: Database['public']['Enums']['user_role'];
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      abort_mentoring_evidence: {
        Args: { p_evidence_id: string };
        Returns: boolean;
      };
      add_cashier_to_period_roster: {
        Args: {
          p_cashier_id: string;
          p_effective_at?: string;
          p_performed_by?: string;
          p_period_id: string;
          p_reason?: string;
        };
        Returns: {
          avatar_path: string | null;
          branch_id: string;
          branch_name: string;
          cashier_id: string;
          cashier_name: string;
          created_at: string;
          eligible_from: string;
          entry_reason: string;
          id: string;
          outlet_id: string;
          outlet_name: string;
          period_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'cashier_period_roster';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_create_category: {
        Args: { p_actor_id: string; p_name: string; p_weight: number };
        Returns: {
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          updated_at: string;
          weight: number;
        };
        SetofOptions: {
          from: '*';
          to: 'category';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_create_detail: {
        Args: {
          p_actor_id: string;
          p_category_id: string;
          p_deduction_points?: number;
          p_name: string;
          p_scale_max?: number;
          p_type: Database['public']['Enums']['detail_type'];
        };
        Returns: {
          category_id: string;
          created_at: string;
          deduction_points: number | null;
          id: string;
          is_active: boolean;
          name: string;
          scale_max: number | null;
          type: Database['public']['Enums']['detail_type'];
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'detail';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_set_category_status: {
        Args: {
          p_actor_id: string;
          p_category_id: string;
          p_is_active: boolean;
          p_reason: string;
        };
        Returns: {
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          updated_at: string;
          weight: number;
        };
        SetofOptions: {
          from: '*';
          to: 'category';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_set_detail_status: {
        Args: {
          p_actor_id: string;
          p_detail_id: string;
          p_is_active: boolean;
          p_reason: string;
        };
        Returns: {
          category_id: string;
          created_at: string;
          deduction_points: number | null;
          id: string;
          is_active: boolean;
          name: string;
          scale_max: number | null;
          type: Database['public']['Enums']['detail_type'];
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'detail';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_update_category: {
        Args: {
          p_actor_id: string;
          p_category_id: string;
          p_is_active?: boolean;
          p_name?: string;
          p_weight?: number;
        };
        Returns: {
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          updated_at: string;
          weight: number;
        };
        SetofOptions: {
          from: '*';
          to: 'category';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_update_user: {
        Args: {
          p_actor_id: string;
          p_full_name?: string;
          p_is_active?: boolean;
          p_role?: Database['public']['Enums']['user_role'];
          p_target_user_id: string;
        };
        Returns: {
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          is_active: boolean;
          role: Database['public']['Enums']['user_role'];
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'users';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      close_period:
        | {
            Args: { p_performed_by?: string; p_period_id: string };
            Returns: undefined;
          }
        | {
            Args: {
              p_override_incomplete: boolean;
              p_override_reason: string;
              p_performed_by: string;
              p_period_id: string;
            };
            Returns: undefined;
          };
      compute_normalized_score: {
        Args: { p_scale_max: number; p_scale_value: number };
        Returns: number;
      };
      consume_invite: {
        Args: {
          p_email: string;
          p_full_name: string;
          p_token: string;
          p_user_id: string;
        };
        Returns: {
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          is_active: boolean;
          role: Database['public']['Enums']['user_role'];
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'users';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_cashier_with_history: {
        Args: {
          p_actor_id: string;
          p_employment_start_date: string;
          p_name: string;
          p_outlet_id: string;
        };
        Returns: {
          avatar_url: string | null;
          created_at: string;
          employment_start_date: string;
          id: string;
          is_active: boolean;
          name: string;
          outlet_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'cashier';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_mentoring_session_atomic: {
        Args: {
          p_cashier_notes: Json;
          p_conducted_by: string;
          p_note_outlet: string;
          p_outlet_id: string;
          p_visited_date: string;
        };
        Returns: {
          conducted_by: string;
          created_at: string;
          id: string;
          note_outlet: string | null;
          outlet_id: string;
          updated_at: string;
          visited_date: string;
        };
        SetofOptions: {
          from: '*';
          to: 'mentoring_session';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      current_user_role: {
        Args: never;
        Returns: Database['public']['Enums']['user_role'];
      };
      finalize_mentoring_evidence: {
        Args: {
          p_actor_id: string;
          p_byte_size: number;
          p_content_sha256: string;
          p_evidence_id: string;
          p_height: number;
          p_width: number;
        };
        Returns: {
          byte_size: number;
          content_sha256: string;
          created_at: string;
          created_by: string;
          height: number;
          id: string;
          mime_type: string;
          object_path: string;
          ready_at: string | null;
          session_id: string;
          sort_order: number;
          status: string;
          width: number;
        };
        SetofOptions: {
          from: '*';
          to: 'mentoring_evidence';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      finalize_setup: {
        Args: {
          p_claim_id: string;
          p_email: string;
          p_full_name: string;
          p_user_id: string;
        };
        Returns: {
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          is_active: boolean;
          role: Database['public']['Enums']['user_role'];
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'users';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      get_category_weight: {
        Args: { cid: string; pid: string };
        Returns: number;
      };
      get_dashboard_snapshot: { Args: never; Returns: Json };
      get_detail_config: {
        Args: { did: string; pid: string };
        Returns: {
          deduction_points: number;
          scale_max: number;
        }[];
      };
      get_period_close_preflight: {
        Args: { p_period_id: string };
        Returns: Json;
      };
      is_active_user: { Args: never; Returns: boolean };
      is_admin: { Args: never; Returns: boolean };
      open_period: {
        Args: {
          p_end_date: string;
          p_performed_by?: string;
          p_start_date: string;
        };
        Returns: {
          closed_at: string | null;
          created_at: string;
          end_date: string;
          id: string;
          label: string;
          start_date: string;
          status: Database['public']['Enums']['period_status'];
        };
        SetofOptions: {
          from: '*';
          to: 'period';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      recalculate_cashier_period_score: {
        Args: { p_cashier_id: string; p_period_id: string };
        Returns: {
          cashier_id: string;
          category_scores: Json;
          id: string;
          is_locked: boolean;
          period_id: string;
          total_score: number;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'cashier_period_score';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      regenerate_invite: {
        Args: {
          p_actor_id: string;
          p_expires_at: string;
          p_invite_id: string;
          p_new_token: string;
        };
        Returns: {
          accepted_user_id: string | null;
          branch_ids: string[];
          created_at: string;
          created_by: string;
          email: string | null;
          expires_at: string;
          id: string;
          invite_name: string;
          revoked_at: string | null;
          revoked_by: string | null;
          role: Database['public']['Enums']['user_role'];
          token: string;
          used_at: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'invite';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      release_setup: { Args: { p_claim_id: string }; Returns: boolean };
      reserve_mentoring_evidence: {
        Args: {
          p_actor_id: string;
          p_byte_size: number;
          p_content_sha256: string;
          p_height: number;
          p_session_id: string;
          p_width: number;
        };
        Returns: Json;
      };
      reserve_setup: { Args: { p_claim_id: string }; Returns: boolean };
      revoke_invite: {
        Args: { p_actor_id: string; p_invite_id: string };
        Returns: {
          accepted_user_id: string | null;
          branch_ids: string[];
          created_at: string;
          created_by: string;
          email: string | null;
          expires_at: string;
          id: string;
          invite_name: string;
          revoked_at: string | null;
          revoked_by: string | null;
          role: Database['public']['Enums']['user_role'];
          token: string;
          used_at: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'invite';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_branch_status_guarded: {
        Args: {
          p_actor_id: string;
          p_branch_id: string;
          p_is_active: boolean;
          p_reason: string;
        };
        Returns: {
          code: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'branch';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_cashier_status_atomic: {
        Args: {
          p_actor_id?: string;
          p_cashier_id: string;
          p_effective_at?: string;
          p_is_active: boolean;
          p_reason: string;
        };
        Returns: {
          avatar_url: string | null;
          created_at: string;
          employment_start_date: string;
          id: string;
          is_active: boolean;
          name: string;
          outlet_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'cashier';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_outlet_status_guarded: {
        Args: {
          p_actor_id: string;
          p_is_active: boolean;
          p_outlet_id: string;
          p_reason: string;
        };
        Returns: {
          branch_id: string;
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'outlet';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      storage_can_access_cashier_photo: {
        Args: { cashier_id: string };
        Returns: boolean;
      };
      storage_can_access_cashier_photo_path: {
        Args: { object_name: string };
        Returns: boolean;
      };
      storage_can_manage_cashier_photo_path: {
        Args: { object_name: string };
        Returns: boolean;
      };
      transfer_cashier_atomic: {
        Args: {
          p_actor_id: string;
          p_cashier_id: string;
          p_effective_at: string;
          p_target_outlet_id: string;
        };
        Returns: {
          avatar_url: string | null;
          created_at: string;
          employment_start_date: string;
          id: string;
          is_active: boolean;
          name: string;
          outlet_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'cashier';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      user_can_access_branch: { Args: { branch_id: string }; Returns: boolean };
      user_can_access_permission: {
        Args: { permission_name: string };
        Returns: boolean;
      };
      user_can_view_cashier: { Args: { cashier_id: string }; Returns: boolean };
      user_has_branch_access: { Args: { branch_id: string }; Returns: boolean };
      user_has_cashier_access: {
        Args: { cashier_id: string };
        Returns: boolean;
      };
      user_has_outlet_access: { Args: { outlet_id: string }; Returns: boolean };
      user_has_permission: {
        Args: { permission_name: string };
        Returns: boolean;
      };
    };
    Enums: {
      detail_type: 'scale' | 'deduction';
      notification_type: 'reminder_unassessed' | 'low_score_alert' | 'system';
      period_status: 'open' | 'closed';
      user_role: 'admin' | 'manager' | 'supervisor';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      detail_type: ['scale', 'deduction'],
      notification_type: ['reminder_unassessed', 'low_score_alert', 'system'],
      period_status: ['open', 'closed'],
      user_role: ['admin', 'manager', 'supervisor'],
    },
  },
} as const;

// Compatibility aliases for domain code. The Database contract above is generated from the
// current local schema; these aliases keep existing imports tied to generated rows and enums.
export type UserRole = Enums<'user_role'>;
export type DetailType = Enums<'detail_type'>;
export type PeriodStatus = Enums<'period_status'>;
export type NotificationType = Enums<'notification_type'>;

export type AppSetup = Tables<'app_setup'>;
export type UserProfile = Tables<'users'>;
export type Branch = Tables<'branch'>;
export type Outlet = Tables<'outlet'>;
export type Cashier = Tables<'cashier'>;
export type CashierOutletHistory = Tables<'cashier_outlet_history'>;
export type CashierStatusHistory = Tables<'cashier_status_history'>;
export type UserBranch = Tables<'user_branch'>;
export type Category = Tables<'category'>;
export type CategoryWeightHistory = Tables<'category_weight_history'>;
export type Detail = Tables<'detail'>;
export type DetailConfigHistory = Tables<'detail_config_history'>;
export type Period = Tables<'period'>;
export type Assessment = Tables<'assessment'>;
export type DeductionEvent = Tables<'deduction_event'>;
export type CashierPeriodScore = Tables<'cashier_period_score'>;
export type CashierPeriodCompletion = Tables<'cashier_period_completion'>;
export type CashierPeriodRoster = Tables<'cashier_period_roster'>;
export type LeaderboardEntry = Tables<'leaderboard_entry'>;
export type CashierCumulativeScore = Tables<'cashier_cumulative_score'>;
export type MentoringSession = Tables<'mentoring_session'>;
export type MentoringCashierNote = Tables<'mentoring_cashier_note'>;
export type MentoringEvidence = Tables<'mentoring_evidence'>;
export type Invite = Tables<'invite'>;
export type AppNotification = Tables<'notification'>;
export type PeriodLog = Tables<'period_log'>;
