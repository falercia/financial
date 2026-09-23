/**
 * Tipos do banco no formato gerado pelo Supabase CLI.
 * Regenere após cada migração com: npm run db:types
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13";
  };
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          id: number;
          metadata: Json;
          org_id: string | null;
          target_id: string | null;
          target_type: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      categories: {
        Row: {
          archived_at: string | null;
          created_at: string;
          id: string;
          kind: Database["public"]["Enums"]["expense_kind"];
          name: string;
          org_id: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      expenses: {
        Row: {
          amount_cents: number;
          category_id: string | null;
          competence_month: string;
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          id: string;
          is_private: boolean;
          org_id: string;
          owner_id: string;
          payment_method: Database["public"]["Enums"]["payment_method"];
          purchase_date: string;
          source: string;
          supplier_id: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      invitations: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          org_id: string;
          revoked_at: string | null;
          role: Database["public"]["Enums"]["org_role"];
          token_hash: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      memberships: {
        Row: {
          created_at: string;
          org_id: string;
          role: Database["public"]["Enums"]["org_role"];
          updated_at: string;
          user_id: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          plan: string;
          seat_limit: number;
          updated_at: string;
        };
        Insert: never;
        Update: {
          name?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: never;
        Update: {
          full_name?: string | null;
        };
        Relationships: [];
      };
      suppliers: {
        Row: {
          created_at: string;
          created_by: string | null;
          default_category_id: string | null;
          id: string;
          name: string;
          org_id: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: string };
      create_expense: {
        Args: {
          p_amount_cents: number;
          p_category_id?: string | null;
          p_competence_month?: string | null;
          p_description?: string | null;
          p_is_private?: boolean;
          p_org_id: string;
          p_payment_method: Database["public"]["Enums"]["payment_method"];
          p_purchase_date: string;
          p_supplier_name: string;
        };
        Returns: string;
      };
      create_invitation: {
        Args: { p_email: string; p_org_id: string; p_role: Database["public"]["Enums"]["org_role"] };
        Returns: string;
      };
      create_organization: { Args: { p_name: string }; Returns: string };
      delete_expense: { Args: { p_expense_id: string }; Returns: undefined };
      expense_month_summary: {
        Args: { p_month: string; p_org_id: string };
        Returns: { expense_count: number; hidden_private_cents: number; total_cents: number; visible_cents: number }[];
      };
      remove_member: { Args: { p_org_id: string; p_user_id: string }; Returns: undefined };
      revoke_invitation: { Args: { p_invitation_id: string }; Returns: undefined };
      update_expense: {
        Args: {
          p_amount_cents: number;
          p_category_id: string | null;
          p_competence_month: string | null;
          p_description: string | null;
          p_expense_id: string;
          p_is_private: boolean;
          p_payment_method: Database["public"]["Enums"]["payment_method"];
          p_purchase_date: string;
          p_supplier_name: string;
        };
        Returns: undefined;
      };
      update_member_role: {
        Args: { p_org_id: string; p_role: Database["public"]["Enums"]["org_role"]; p_user_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      expense_kind: "essential" | "lifestyle" | "other";
      org_role: "owner" | "admin" | "member";
      payment_method: "credit_card" | "debit_card" | "pix" | "boleto" | "cash" | "transfer" | "other";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
