// Gerado por supabase/tests/generate-types.ts a partir das migrations.
// Não editar manualmente: execute `npm run db:types`.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      legal_acessorias_requests: {
        Row: {
          acessorias_company_id: string | null;
          acessorias_request_id: string;
          company_document_number: string | null;
          company_name: string | null;
          completed_at: string | null;
          department_id: string | null;
          department_name: string | null;
          due_at: string | null;
          id: string;
          last_update_at: string | null;
          office_responsible_ids: Json | null;
          office_responsibles: Json | null;
          opened_at: string | null;
          priority: string | null;
          request_type: string | null;
          requester_id: string | null;
          requester_name: string | null;
          status: string | null;
          subject: string | null;
          synced_at: string;
        };
        Insert: {
          acessorias_company_id?: string | null;
          acessorias_request_id: string;
          company_document_number?: string | null;
          company_name?: string | null;
          completed_at?: string | null;
          department_id?: string | null;
          department_name?: string | null;
          due_at?: string | null;
          id?: string;
          last_update_at?: string | null;
          office_responsible_ids?: Json | null;
          office_responsibles?: Json | null;
          opened_at?: string | null;
          priority?: string | null;
          request_type?: string | null;
          requester_id?: string | null;
          requester_name?: string | null;
          status?: string | null;
          subject?: string | null;
          synced_at: string;
        };
        Update: {
          acessorias_company_id?: string | null;
          acessorias_request_id?: string;
          company_document_number?: string | null;
          company_name?: string | null;
          completed_at?: string | null;
          department_id?: string | null;
          department_name?: string | null;
          due_at?: string | null;
          id?: string;
          last_update_at?: string | null;
          office_responsible_ids?: Json | null;
          office_responsibles?: Json | null;
          opened_at?: string | null;
          priority?: string | null;
          request_type?: string | null;
          requester_id?: string | null;
          requester_name?: string | null;
          status?: string | null;
          subject?: string | null;
          synced_at?: string;
        };
        Relationships: [];
      };
      legal_acessorias_users: {
        Row: {
          acessorias_user_id: string;
          created_at: string;
          email: string | null;
          id: string;
          name: string | null;
          status: string | null;
          synced_at: string;
          updated_at: string;
        };
        Insert: {
          acessorias_user_id: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string | null;
          status?: string | null;
          synced_at: string;
          updated_at?: string;
        };
        Update: {
          acessorias_user_id?: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string | null;
          status?: string | null;
          synced_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      legal_audit_logs: {
        Row: {
          action: string;
          created_at: string;
          entity_id: string;
          entity_type: string;
          id: string;
          new_data: Json | null;
          old_data: Json | null;
          user_id: string;
        };
        Insert: {
          action: string;
          created_at?: string;
          entity_id: string;
          entity_type: string;
          id?: string;
          new_data?: Json | null;
          old_data?: Json | null;
          user_id: string;
        };
        Update: {
          action?: string;
          created_at?: string;
          entity_id?: string;
          entity_type?: string;
          id?: string;
          new_data?: Json | null;
          old_data?: Json | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "legal_audit_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "legal_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      legal_client_responsibles: {
        Row: {
          client_id: string;
          created_at: string;
          department_id: string;
          department_name: string | null;
          id: string;
          responsible_acessorias_user_id: string | null;
          responsible_email: string | null;
          responsible_name: string | null;
          synced_at: string;
          updated_at: string;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          department_id: string;
          department_name?: string | null;
          id?: string;
          responsible_acessorias_user_id?: string | null;
          responsible_email?: string | null;
          responsible_name?: string | null;
          synced_at: string;
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          department_id?: string;
          department_name?: string | null;
          id?: string;
          responsible_acessorias_user_id?: string | null;
          responsible_email?: string | null;
          responsible_name?: string | null;
          synced_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "legal_client_responsibles_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "legal_clients";
            referencedColumns: ["id"];
          },
        ];
      };
      legal_clients: {
        Row: {
          acessorias_company_id: string;
          acessorias_updated_at: string | null;
          corporate_name: string;
          created_at: string;
          document_number: string | null;
          id: string;
          legalization_department_id: string | null;
          legalization_responsible_acessorias_user_id: string | null;
          legalization_responsible_email: string | null;
          legalization_responsible_name: string | null;
          state: string | null;
          status: string | null;
          synced_at: string;
          trade_name: string | null;
          updated_at: string;
        };
        Insert: {
          acessorias_company_id: string;
          acessorias_updated_at?: string | null;
          corporate_name: string;
          created_at?: string;
          document_number?: string | null;
          id?: string;
          legalization_department_id?: string | null;
          legalization_responsible_acessorias_user_id?: string | null;
          legalization_responsible_email?: string | null;
          legalization_responsible_name?: string | null;
          state?: string | null;
          status?: string | null;
          synced_at: string;
          trade_name?: string | null;
          updated_at?: string;
        };
        Update: {
          acessorias_company_id?: string;
          acessorias_updated_at?: string | null;
          corporate_name?: string;
          created_at?: string;
          document_number?: string | null;
          id?: string;
          legalization_department_id?: string | null;
          legalization_responsible_acessorias_user_id?: string | null;
          legalization_responsible_email?: string | null;
          legalization_responsible_name?: string | null;
          state?: string | null;
          status?: string | null;
          synced_at?: string;
          trade_name?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      legal_expirations: {
        Row: {
          cancellation_reason: string | null;
          client_id: string;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          document_name: string;
          document_number: string | null;
          expiration_date: string;
          expiration_type: Database["public"]["Enums"]["legal_expiration_type"];
          id: string;
          issue_date: string | null;
          issuer: string | null;
          notes: string | null;
          previous_expiration_id: string | null;
          quote_sent_at: string | null;
          reminder_date: string | null;
          reminder_days: number | null;
          renewal_period:
            Database["public"]["Enums"]["legal_renewal_period"] | null;
          renewed_at: string | null;
          responsible_user_id: string | null;
          status: Database["public"]["Enums"]["legal_expiration_status"];
          updated_at: string;
          updated_by: string;
        };
        Insert: {
          cancellation_reason?: string | null;
          client_id: string;
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          document_name: string;
          document_number?: string | null;
          expiration_date: string;
          expiration_type: Database["public"]["Enums"]["legal_expiration_type"];
          id?: string;
          issue_date?: string | null;
          issuer?: string | null;
          notes?: string | null;
          previous_expiration_id?: string | null;
          quote_sent_at?: string | null;
          reminder_date?: string | null;
          reminder_days?: number | null;
          renewal_period?:
            Database["public"]["Enums"]["legal_renewal_period"] | null;
          renewed_at?: string | null;
          responsible_user_id?: string | null;
          status?: Database["public"]["Enums"]["legal_expiration_status"];
          updated_at?: string;
          updated_by: string;
        };
        Update: {
          cancellation_reason?: string | null;
          client_id?: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          document_name?: string;
          document_number?: string | null;
          expiration_date?: string;
          expiration_type?: Database["public"]["Enums"]["legal_expiration_type"];
          id?: string;
          issue_date?: string | null;
          issuer?: string | null;
          notes?: string | null;
          previous_expiration_id?: string | null;
          quote_sent_at?: string | null;
          reminder_date?: string | null;
          reminder_days?: number | null;
          renewal_period?:
            Database["public"]["Enums"]["legal_renewal_period"] | null;
          renewed_at?: string | null;
          responsible_user_id?: string | null;
          status?: Database["public"]["Enums"]["legal_expiration_status"];
          updated_at?: string;
          updated_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "legal_expirations_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "legal_clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "legal_expirations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "legal_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "legal_expirations_previous_expiration_id_fkey";
            columns: ["previous_expiration_id"];
            isOneToOne: false;
            referencedRelation: "legal_expirations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "legal_expirations_responsible_user_id_fkey";
            columns: ["responsible_user_id"];
            isOneToOne: false;
            referencedRelation: "legal_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "legal_expirations_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "legal_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      legal_profiles: {
        Row: {
          active: boolean;
          created_at: string;
          email: string;
          hierarchy_level: Database["public"]["Enums"]["legal_hierarchy_level"];
          id: string;
          is_admin: boolean;
          job_title: string | null;
          manager_id: string | null;
          name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          email: string;
          hierarchy_level?: Database["public"]["Enums"]["legal_hierarchy_level"];
          id?: string;
          is_admin?: boolean;
          job_title?: string | null;
          manager_id?: string | null;
          name: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          email?: string;
          hierarchy_level?: Database["public"]["Enums"]["legal_hierarchy_level"];
          id?: string;
          is_admin?: boolean;
          job_title?: string | null;
          manager_id?: string | null;
          name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "legal_profiles_manager_id_fkey";
            columns: ["manager_id"];
            isOneToOne: false;
            referencedRelation: "legal_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      legal_settings: {
        Row: {
          description: string | null;
          key: string;
          updated_at: string;
          value: Json;
        };
        Insert: {
          description?: string | null;
          key: string;
          updated_at?: string;
          value: Json;
        };
        Update: {
          description?: string | null;
          key?: string;
          updated_at?: string;
          value?: Json;
        };
        Relationships: [];
      };
      legal_sync_logs: {
        Row: {
          created_at: string;
          error_message: string | null;
          finished_at: string | null;
          id: string;
          integration: string;
          metadata: Json | null;
          records_created: number;
          records_failed: number;
          records_received: number;
          records_updated: number;
          started_at: string;
          status: Database["public"]["Enums"]["legal_sync_status"];
          sync_type: string;
        };
        Insert: {
          created_at?: string;
          error_message?: string | null;
          finished_at?: string | null;
          id?: string;
          integration: string;
          metadata?: Json | null;
          records_created?: number;
          records_failed?: number;
          records_received?: number;
          records_updated?: number;
          started_at: string;
          status: Database["public"]["Enums"]["legal_sync_status"];
          sync_type: string;
        };
        Update: {
          created_at?: string;
          error_message?: string | null;
          finished_at?: string | null;
          id?: string;
          integration?: string;
          metadata?: Json | null;
          records_created?: number;
          records_failed?: number;
          records_received?: number;
          records_updated?: number;
          started_at?: string;
          status?: Database["public"]["Enums"]["legal_sync_status"];
          sync_type?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      legal_client_overview: {
        Row: {
          acessorias_company_id: string | null;
          active_expirations: number | null;
          corporate_name: string | null;
          document_digits: string | null;
          document_number: string | null;
          id: string | null;
          legalization_responsible_email: string | null;
          legalization_responsible_name: string | null;
          next_expiration_date: string | null;
          other_responsible_name: string | null;
          overdue_expirations: number | null;
          status: string | null;
          trade_name: string | null;
        };
        Relationships: [];
      };
      legal_expiration_list: {
        Row: {
          cancellation_reason: string | null;
          client_document_number: string | null;
          client_id: string | null;
          client_name: string | null;
          client_trade_name: string | null;
          document_name: string | null;
          document_number: string | null;
          expiration_date: string | null;
          expiration_type:
            Database["public"]["Enums"]["legal_expiration_type"] | null;
          id: string | null;
          issue_date: string | null;
          issuer: string | null;
          notes: string | null;
          responsible_user_id: string | null;
          search_text: string | null;
          status: Database["public"]["Enums"]["legal_expiration_status"] | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      legal_admin_create_profile: {
        Args: {
          target_user_id: string;
          profile_name: string;
          profile_job_title: string;
          profile_level: Database["public"]["Enums"]["legal_hierarchy_level"];
          profile_manager_id: string;
        };
        Returns: Database["public"]["Tables"]["legal_profiles"]["Row"];
      };
      legal_admin_list_profile_candidates: {
        Args: { search: string };
        Returns: {
          user_id: string;
          email: string;
          name: string;
          last_sign_in_at: string;
        }[];
      };
      legal_admin_update_profile: {
        Args: {
          target_profile_id: string;
          profile_name: string;
          profile_job_title: string;
          profile_level: Database["public"]["Enums"]["legal_hierarchy_level"];
          profile_manager_id: string;
          profile_active: boolean;
        };
        Returns: Database["public"]["Tables"]["legal_profiles"]["Row"];
      };
      legal_auth_uid: { Args: never; Returns: string };
      legal_can_access_client: {
        Args: { client_uuid: string };
        Returns: boolean;
      };
      legal_can_assign_responsible: {
        Args: { client_uuid: string; profile_uuid: string };
        Returns: boolean;
      };
      legal_complete_renewal: {
        Args: { old_id: string; payload: Json };
        Returns: Database["public"]["Tables"]["legal_expirations"]["Row"];
      };
      legal_current_profile: {
        Args: never;
        Returns: Database["public"]["Tables"]["legal_profiles"]["Row"][];
      };
      legal_current_profile_id: { Args: never; Returns: string };
      legal_delete_expiration: {
        Args: { expiration_id: string };
        Returns: undefined;
      };
      legal_get_user_scope: { Args: never; Returns: string[] };
      legal_has_global_scope: { Args: never; Returns: boolean };
      legal_is_admin: { Args: never; Returns: boolean };
      legal_period_expiration_date: {
        Args: {
          issue: string;
          period: Database["public"]["Enums"]["legal_renewal_period"];
        };
        Returns: string;
      };
      legal_renewal_period_months: {
        Args: { period: Database["public"]["Enums"]["legal_renewal_period"] };
        Returns: number;
      };
      legal_scope_emails: { Args: never; Returns: string[] };
      legal_session_is_microsoft: { Args: never; Returns: boolean };
      legal_visible_client_ids: { Args: never; Returns: string[] };
      legal_visible_profiles: {
        Args: never;
        Returns: {
          id: string;
          name: string;
          email: string;
          hierarchy_level: Database["public"]["Enums"]["legal_hierarchy_level"];
          active: boolean;
        }[];
      };
    };
    Enums: {
      legal_expiration_status:
        | "ACTIVE"
        | "RENEWING"
        | "QUOTE_SENT"
        | "RENEWED"
        | "EXPIRED"
        | "CANCELLED";
      legal_expiration_type: "CERTIDAO" | "LICENCA" | "CERTIFICADO";
      legal_hierarchy_level:
        "USER" | "LEADER" | "COORDINATOR" | "MANAGER" | "DIRECTOR" | "ADMIN";
      legal_renewal_period:
        "MONTHLY" | "BIMONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL";
      legal_sync_status: "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];
