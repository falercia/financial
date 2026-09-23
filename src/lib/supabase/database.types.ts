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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: string };
      create_invitation: {
        Args: { p_email: string; p_org_id: string; p_role: Database["public"]["Enums"]["org_role"] };
        Returns: string;
      };
      create_organization: { Args: { p_name: string }; Returns: string };
      remove_member: { Args: { p_org_id: string; p_user_id: string }; Returns: undefined };
      revoke_invitation: { Args: { p_invitation_id: string }; Returns: undefined };
      update_member_role: {
        Args: { p_org_id: string; p_role: Database["public"]["Enums"]["org_role"]; p_user_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      org_role: "owner" | "admin" | "member";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
