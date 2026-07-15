/**
 * Chrono database types.
 *
 * Hand-authored to match `backend/supabase/migrations/20260713000000_initial.sql`.
 * Regenerate from a running local stack with:
 *   pnpm db:types   (supabase gen types typescript --local)
 * and keep this file's shape in sync with the migration.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppRole = 'freelancer' | 'manager' | 'admin';
export type ProjectStatus = 'active' | 'archived';
export type TimeEntryStatus = 'pending' | 'approved' | 'rejected';
export type RevenueSourceType = 'time_based' | 'recurring' | 'self_billing';
export type InvoiceStatus =
  | 'draft'
  | 'submitted'
  | 'partially_paid'
  | 'paid'
  | 'cancelled';
export type NotificationType =
  | 'time_submitted'
  | 'time_approved'
  | 'time_rejected'
  | 'invoice_paid'
  | 'invoice_partially_paid'
  | 'referral_earned'
  | 'reminder';
export type BlogArticleStatus = 'draft' | 'published';

type Timestamps = {
  created_at: string;
  updated_at: string;
  deleted: boolean;
};

export type Database = {
  public: {
    Tables: {
      blog_articles: {
        Row: {
          id: string;
          slug: string;
          content: Json;
          author: string;
          image_url: string | null;
          status: BlogArticleStatus;
          read_time: number | null;
          keywords: string[] | null;
          published_at: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          slug: string;
          content?: Json;
          author?: string;
          image_url?: string | null;
          status?: BlogArticleStatus;
          read_time?: number | null;
          keywords?: string[] | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted?: boolean;
        };
        Update: Partial<Database['public']['Tables']['blog_articles']['Insert']>;
        Relationships: [];
      };
      profiles: {
        Row: {
          user_id: string;
          full_name: string | null;
          avatar_url: string | null;
          content: Json;
          onboarded: boolean;
        } & Timestamps;
        Insert: {
          user_id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          content?: Json;
          onboarded?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted?: boolean;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
      profile_billing: {
        Row: {
          user_id: string;
          address: string | null;
          vat_id: string | null;
          business_id: string | null;
        } & Timestamps;
        Insert: {
          user_id: string;
          address?: string | null;
          vat_id?: string | null;
          business_id?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted?: boolean;
        };
        Update: Partial<Database['public']['Tables']['profile_billing']['Insert']>;
        Relationships: [];
      };
      companies: {
        Row: {
          id: string;
          slug: string | null;
          content: Json;
          currency: string;
          created_by: string | null;
          legal_name: string | null;
          address: string | null;
          vat_id: string | null;
          registration_id: string | null;
          vat_rate: number | null;
          invoice_numbering_enabled: boolean;
        } & Timestamps;
        Insert: {
          id?: string;
          slug?: string | null;
          content?: Json;
          currency?: string;
          created_by?: string | null;
          legal_name?: string | null;
          address?: string | null;
          vat_id?: string | null;
          registration_id?: string | null;
          vat_rate?: number | null;
          invoice_numbering_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted?: boolean;
        };
        Update: Partial<Database['public']['Tables']['companies']['Insert']>;
        Relationships: [];
      };
      company_members: {
        Row: {
          id: string;
          company_id: string;
          user_id: string;
          role: AppRole;
          default_hourly_rate_cents: number | null;
        } & Timestamps;
        Insert: {
          id?: string;
          company_id: string;
          user_id: string;
          role?: AppRole;
          default_hourly_rate_cents?: number | null;
          created_at?: string;
          updated_at?: string;
          deleted?: boolean;
        };
        Update: Partial<Database['public']['Tables']['company_members']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'company_members_company_id_fkey';
            columns: ['company_id'];
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
        ];
      };
      projects: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          description: string | null;
          color: string | null;
          client_name: string | null;
          status: ProjectStatus;
          budget_cents: number | null;
          default_tjm_cents: number | null;
          hours_per_day: number;
          billable_default: boolean;
          starts_on: string | null;
          ends_on: string | null;
          created_by: string | null;
          vat_rate: number | null;
        } & Timestamps;
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          description?: string | null;
          color?: string | null;
          client_name?: string | null;
          status?: ProjectStatus;
          budget_cents?: number | null;
          default_tjm_cents?: number | null;
          hours_per_day?: number;
          billable_default?: boolean;
          starts_on?: string | null;
          ends_on?: string | null;
          created_by?: string | null;
          vat_rate?: number | null;
          created_at?: string;
          updated_at?: string;
          deleted?: boolean;
        };
        Update: Partial<Database['public']['Tables']['projects']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'projects_company_id_fkey';
            columns: ['company_id'];
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
        ];
      };
      project_members: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          tjm_cents: number | null;
          role_on_project: string;
        } & Timestamps;
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          tjm_cents?: number | null;
          role_on_project?: string;
          created_at?: string;
          updated_at?: string;
          deleted?: boolean;
        };
        Update: Partial<Database['public']['Tables']['project_members']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'project_members_project_id_fkey';
            columns: ['project_id'];
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      time_entries: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          company_id: string;
          entry_date: string;
          duration_minutes: number;
          description: string | null;
          billable: boolean;
          status: TimeEntryStatus;
          approved_by: string | null;
          approved_at: string | null;
          rejection_reason: string | null;
          invoice_id: string | null;
          tags: string[];
        } & Timestamps;
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          company_id: string;
          entry_date?: string;
          duration_minutes: number;
          description?: string | null;
          billable?: boolean;
          status?: TimeEntryStatus;
          approved_by?: string | null;
          approved_at?: string | null;
          rejection_reason?: string | null;
          invoice_id?: string | null;
          tags?: string[];
          created_at?: string;
          updated_at?: string;
          deleted?: boolean;
        };
        Update: Partial<Database['public']['Tables']['time_entries']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'time_entries_project_id_fkey';
            columns: ['project_id'];
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      revenue_sources: {
        Row: {
          id: string;
          project_id: string;
          company_id: string;
          type: RevenueSourceType;
          name: string;
          active: boolean;
          starts_on: string | null;
          ends_on: string | null;
          content: Json;
          created_by: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          project_id: string;
          company_id: string;
          type: RevenueSourceType;
          name: string;
          active?: boolean;
          starts_on?: string | null;
          ends_on?: string | null;
          content?: Json;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted?: boolean;
        };
        Update: Partial<Database['public']['Tables']['revenue_sources']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'revenue_sources_project_id_fkey';
            columns: ['project_id'];
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      revenue_entries: {
        Row: {
          id: string;
          project_id: string;
          company_id: string;
          revenue_source_id: string;
          type: RevenueSourceType;
          period_month: string;
          amount_cents: number;
          auto_generated: boolean;
          notes: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          project_id: string;
          company_id: string;
          revenue_source_id: string;
          type: RevenueSourceType;
          period_month: string;
          amount_cents: number;
          auto_generated?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted?: boolean;
        };
        Update: Partial<Database['public']['Tables']['revenue_entries']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'revenue_entries_project_id_fkey';
            columns: ['project_id'];
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      project_referrals: {
        Row: {
          id: string;
          project_id: string;
          company_id: string;
          user_id: string;
          percent: number;
          starts_on: string | null;
          ends_on: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          project_id: string;
          company_id: string;
          user_id: string;
          percent: number;
          starts_on?: string | null;
          ends_on?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted?: boolean;
        };
        Update: Partial<Database['public']['Tables']['project_referrals']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'project_referrals_project_id_fkey';
            columns: ['project_id'];
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      referral_earnings: {
        Row: {
          id: string;
          project_id: string;
          company_id: string;
          referrer_id: string;
          period_month: string;
          percent: number;
          revenue_base_cents: number;
          amount_cents: number;
          settled_at: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          project_id: string;
          company_id: string;
          referrer_id: string;
          period_month: string;
          percent: number;
          revenue_base_cents: number;
          amount_cents: number;
          settled_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted?: boolean;
        };
        Update: Partial<Database['public']['Tables']['referral_earnings']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'referral_earnings_project_id_fkey';
            columns: ['project_id'];
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      invoices: {
        Row: {
          id: string;
          company_id: string;
          project_id: string;
          freelancer_id: string;
          period_month: string;
          worked_minutes: number;
          tjm_cents: number;
          hours_per_day: number;
          earned_cents: number;
          credit_brought_forward_cents: number;
          amount_due_cents: number;
          amount_paid_cents: number;
          credit_carried_forward_cents: number;
          funding_snapshot_cents: number | null;
          status: InvoiceStatus;
          submitted_at: string | null;
          submission_seq: number;
          settled_at: string | null;
          vat_rate: number | null;
          invoice_number: string | null;
          issued_on: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          company_id: string;
          project_id: string;
          freelancer_id: string;
          period_month: string;
          worked_minutes?: number;
          tjm_cents?: number;
          hours_per_day?: number;
          earned_cents?: number;
          credit_brought_forward_cents?: number;
          amount_due_cents?: number;
          amount_paid_cents?: number;
          credit_carried_forward_cents?: number;
          funding_snapshot_cents?: number | null;
          status?: InvoiceStatus;
          submitted_at?: string | null;
          submission_seq?: number;
          settled_at?: string | null;
          vat_rate?: number | null;
          invoice_number?: string | null;
          issued_on?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted?: boolean;
        };
        Update: Partial<Database['public']['Tables']['invoices']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'invoices_project_id_fkey';
            columns: ['project_id'];
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          company_id: string;
          user_id: string;
          type: NotificationType;
          title: string;
          body: string | null;
          data: Json;
          read_at: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          company_id: string;
          user_id: string;
          type: NotificationType;
          title: string;
          body?: string | null;
          data?: Json;
          read_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted?: boolean;
        };
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'notifications_company_id_fkey';
            columns: ['company_id'];
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
        ];
      };
      device_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          platform: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          platform?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['device_tokens']['Insert']>;
        Relationships: [];
      };
      company_invites: {
        Row: {
          id: string;
          company_id: string;
          email: string;
          role: AppRole;
          token: string;
          invited_by: string | null;
          expires_at: string;
          accepted_at: string | null;
          accepted_by: string | null;
          revoked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          email: string;
          role?: AppRole;
          token?: string;
          invited_by?: string | null;
          expires_at?: string;
          accepted_at?: string | null;
          accepted_by?: string | null;
          revoked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['company_invites']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'company_invites_company_id_fkey';
            columns: ['company_id'];
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
        ];
      };
      invoice_payments: {
        Row: {
          id: string;
          invoice_id: string;
          company_id: string;
          amount_cents: number;
          paid_on: string;
          method: string | null;
          note: string | null;
          recorded_by: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          invoice_id: string;
          company_id: string;
          amount_cents: number;
          paid_on?: string;
          method?: string | null;
          note?: string | null;
          recorded_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted?: boolean;
        };
        Update: Partial<Database['public']['Tables']['invoice_payments']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'invoice_payments_invoice_id_fkey';
            columns: ['invoice_id'];
            referencedRelation: 'invoices';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_log: {
        Row: {
          id: string;
          company_id: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          detail: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          actor_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          detail?: Json;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['audit_log']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      recognize_project_revenue: {
        Args: { p_project_id: string; p_period: string };
        Returns: undefined;
      };
      settle_project_month: {
        Args: { p_project_id: string; p_period: string };
        Returns: undefined;
      };
      is_company_member: { Args: { cid: string }; Returns: boolean };
      is_company_manager: { Args: { cid: string }; Returns: boolean };
      is_company_admin: { Args: { cid: string }; Returns: boolean };
      accept_company_invite: { Args: { p_token: string }; Returns: string };
    };
    Enums: {
      app_role: AppRole;
      project_status: ProjectStatus;
      time_entry_status: TimeEntryStatus;
      revenue_source_type: RevenueSourceType;
      invoice_status: InvoiceStatus;
      notification_type: NotificationType;
      blog_article_status: BlogArticleStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

// Convenience helpers (Supabase-style)
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];
