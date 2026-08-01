export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_profiles: {
        Row: {
          created_at: string
          display_name: string
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          id: boolean
          maintenance_message: string | null
          maintenance_mode: boolean
          max_reprints: number
          reservation_minutes: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: boolean
          maintenance_message?: string | null
          maintenance_mode?: boolean
          max_reprints?: number
          reservation_minutes?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: boolean
          maintenance_message?: string | null
          maintenance_mode?: boolean
          max_reprints?: number
          reservation_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      participant_tracking_code_aliases: {
        Row: {
          created_at: string
          document_number: string
          document_type: Database["public"]["Enums"]["participant_document_type"]
          tracking_code: string
        }
        Insert: {
          created_at?: string
          document_number: string
          document_type: Database["public"]["Enums"]["participant_document_type"]
          tracking_code: string
        }
        Update: {
          created_at?: string
          document_number?: string
          document_type?: Database["public"]["Enums"]["participant_document_type"]
          tracking_code?: string
        }
        Relationships: []
      }
      participant_tracking_codes: {
        Row: {
          created_at: string
          document_number: string
          document_type: Database["public"]["Enums"]["participant_document_type"]
          tracking_code: string
        }
        Insert: {
          created_at?: string
          document_number: string
          document_type: Database["public"]["Enums"]["participant_document_type"]
          tracking_code: string
        }
        Update: {
          created_at?: string
          document_number?: string
          document_type?: Database["public"]["Enums"]["participant_document_type"]
          tracking_code?: string
        }
        Relationships: []
      }
      purchase_requests: {
        Row: {
          created_at: string
          dni: string
          document_type: Database["public"]["Enums"]["participant_document_type"]
          expires_at: string
          full_name: string
          id: string
          payment_proof_deleted_at: string | null
          payment_proof_path: string
          phone: string
          raffle_id: string
          rejection_reason: string | null
          requested_quantity: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["purchase_request_status"]
          tracking_code: string
          updated_at: string
          whatsapp: string
        }
        Insert: {
          created_at?: string
          dni: string
          document_type?: Database["public"]["Enums"]["participant_document_type"]
          expires_at: string
          full_name: string
          id?: string
          payment_proof_deleted_at?: string | null
          payment_proof_path: string
          phone: string
          raffle_id: string
          rejection_reason?: string | null
          requested_quantity: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["purchase_request_status"]
          tracking_code: string
          updated_at?: string
          whatsapp: string
        }
        Update: {
          created_at?: string
          dni?: string
          document_type?: Database["public"]["Enums"]["participant_document_type"]
          expires_at?: string
          full_name?: string
          id?: string
          payment_proof_deleted_at?: string | null
          payment_proof_path?: string
          phone?: string
          raffle_id?: string
          rejection_reason?: string | null
          requested_quantity?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["purchase_request_status"]
          tracking_code?: string
          updated_at?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requests_raffle_id_fkey"
            columns: ["raffle_id"]
            isOneToOne: false
            referencedRelation: "raffles"
            referencedColumns: ["id"]
          },
        ]
      }
      raffle_winners: {
        Row: {
          confirmed_at: string
          confirmed_by: string | null
          created_at: string
          id: string
          raffle_id: string
          ticket_id: string
        }
        Insert: {
          confirmed_at?: string
          confirmed_by?: string | null
          created_at?: string
          id?: string
          raffle_id: string
          ticket_id: string
        }
        Update: {
          confirmed_at?: string
          confirmed_by?: string | null
          created_at?: string
          id?: string
          raffle_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "raffle_winners_raffle_id_fkey"
            columns: ["raffle_id"]
            isOneToOne: true
            referencedRelation: "raffles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raffle_winners_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      raffles: {
        Row: {
          closed_at: string | null
          closes_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          draw_at: string | null
          id: string
          image_path: string | null
          name: string
          prizes: Json
          starts_at: string | null
          status: Database["public"]["Enums"]["raffle_status"]
          ticket_price: number
          total_tickets: number
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          draw_at?: string | null
          id?: string
          image_path?: string | null
          name: string
          prizes?: Json
          starts_at?: string | null
          status?: Database["public"]["Enums"]["raffle_status"]
          ticket_price: number
          total_tickets: number
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          draw_at?: string | null
          id?: string
          image_path?: string | null
          name?: string
          prizes?: Json
          starts_at?: string | null
          status?: Database["public"]["Enums"]["raffle_status"]
          ticket_price?: number
          total_tickets?: number
          updated_at?: string
        }
        Relationships: []
      }
      ticket_prints: {
        Row: {
          id: string
          print_sequence: number
          print_type: Database["public"]["Enums"]["ticket_print_type"]
          printed_at: string
          printed_by: string | null
          reason: string | null
          ticket_id: string
        }
        Insert: {
          id?: string
          print_sequence: number
          print_type: Database["public"]["Enums"]["ticket_print_type"]
          printed_at?: string
          printed_by?: string | null
          reason?: string | null
          ticket_id: string
        }
        Update: {
          id?: string
          print_sequence?: number
          print_type?: Database["public"]["Enums"]["ticket_print_type"]
          printed_at?: string
          printed_by?: string | null
          reason?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_prints_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assigned_at: string
          frozen_at: string | null
          id: string
          origin_ticket_id: string | null
          purchase_request_id: string
          raffle_id: string
          reassigned_at: string | null
          reassigned_by: string | null
          ticket_number: number
          ticket_status: Database["public"]["Enums"]["ticket_lifecycle_status"]
        }
        Insert: {
          assigned_at?: string
          frozen_at?: string | null
          id?: string
          origin_ticket_id?: string | null
          purchase_request_id: string
          raffle_id: string
          reassigned_at?: string | null
          reassigned_by?: string | null
          ticket_number: number
          ticket_status?: Database["public"]["Enums"]["ticket_lifecycle_status"]
        }
        Update: {
          assigned_at?: string
          frozen_at?: string | null
          id?: string
          origin_ticket_id?: string | null
          purchase_request_id?: string
          raffle_id?: string
          reassigned_at?: string | null
          reassigned_by?: string | null
          ticket_number?: number
          ticket_status?: Database["public"]["Enums"]["ticket_lifecycle_status"]
        }
        Relationships: [
          {
            foreignKeyName: "tickets_origin_ticket_id_fkey"
            columns: ["origin_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_raffle_id_fkey"
            columns: ["raffle_id"]
            isOneToOne: false
            referencedRelation: "raffles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_raffle: {
        Args: { p_admin_user_id: string; p_raffle_id: string }
        Returns: {
          closed_at: string | null
          closes_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          draw_at: string | null
          id: string
          image_path: string | null
          name: string
          prizes: Json
          starts_at: string | null
          status: Database["public"]["Enums"]["raffle_status"]
          ticket_price: number
          total_tickets: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "raffles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approve_purchase_request: {
        Args: { p_admin_user_id: string; p_purchase_request_id: string }
        Returns: {
          ticket_id: string
          ticket_number: number
        }[]
      }
      assert_active_admin: {
        Args: { p_admin_user_id: string }
        Returns: undefined
      }
      cancel_raffle: {
        Args: { p_admin_user_id: string; p_raffle_id: string }
        Returns: {
          closed_at: string | null
          closes_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          draw_at: string | null
          id: string
          image_path: string | null
          name: string
          prizes: Json
          starts_at: string | null
          status: Database["public"]["Enums"]["raffle_status"]
          ticket_price: number
          total_tickets: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "raffles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      check_purchase_request_rate_limit: {
        Args: { p_fingerprint_hash: string }
        Returns: {
          allowed: boolean
          daily_window_count: number
          retry_after_seconds: number
          short_window_count: number
        }[]
      }
      check_rate_limit: {
        Args: {
          p_daily_limit: number
          p_fingerprint_hash: string
          p_short_limit: number
        }
        Returns: {
          allowed: boolean
          daily_window_count: number
          retry_after_seconds: number
          short_window_count: number
        }[]
      }
      close_raffle: {
        Args: { p_admin_user_id: string; p_raffle_id: string }
        Returns: {
          closed_at: string | null
          closes_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          draw_at: string | null
          id: string
          image_path: string | null
          name: string
          prizes: Json
          starts_at: string | null
          status: Database["public"]["Enums"]["raffle_status"]
          ticket_price: number
          total_tickets: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "raffles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_purchase_request: {
        Args: {
          p_dni: string
          p_document_type: string
          p_full_name: string
          p_payment_proof_path: string
          p_phone: string
          p_request_id: string
          p_requested_quantity: number
          p_whatsapp: string
        }
        Returns: {
          expires_at: string
          raffle_id: string
          request_id: string
          tracking_code: string
        }[]
      }
      create_raffle: {
        Args: {
          p_admin_user_id: string
          p_closes_at: string
          p_description: string
          p_draw_at: string
          p_image_path?: string
          p_name: string
          p_prizes?: Json
          p_starts_at: string
          p_ticket_price: number
          p_total_tickets: number
        }
        Returns: {
          closed_at: string | null
          closes_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          draw_at: string | null
          id: string
          image_path: string | null
          name: string
          prizes: Json
          starts_at: string | null
          status: Database["public"]["Enums"]["raffle_status"]
          ticket_price: number
          total_tickets: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "raffles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_payment_proof: {
        Args: { p_admin_user_id: string; p_request_id: string }
        Returns: {
          already_deleted: boolean
          payment_proof_path: string
        }[]
      }
      delete_raffle: {
        Args: { p_admin_user_id: string; p_raffle_id: string }
        Returns: {
          deleted_requests: number
          deleted_tickets: number
          image_path: string
          payment_proof_paths: string[]
          prize_image_paths: string[]
          raffle_name: string
          raffle_status: Database["public"]["Enums"]["raffle_status"]
        }[]
      }
      expire_purchase_requests: { Args: never; Returns: number }
      generate_tracking_code: { Args: never; Returns: string }
      get_public_ticket_document:
        | {
            Args: { p_dni: string }
            Returns: {
              dni: string
              full_name: string
              purchased_at: string
              raffle_name: string
              request_id: string
              ticket_numbers: number[]
            }[]
          }
        | {
            Args: { p_dni: string; p_tracking_code: string }
            Returns: {
              dni: string
              full_name: string
              purchased_at: string
              raffle_name: string
              request_id: string
              ticket_numbers: number[]
              ticket_status: Database["public"]["Enums"]["ticket_lifecycle_status"]
            }[]
          }
        | {
            Args: {
              p_dni: string
              p_document_type: string
              p_tracking_code: string
            }
            Returns: {
              dni: string
              full_name: string
              purchased_at: string
              raffle_id: string
              raffle_name: string
              request_id: string
              ticket_numbers: number[]
              ticket_status: Database["public"]["Enums"]["ticket_lifecycle_status"]
            }[]
          }
      list_payment_proofs_for_retention: {
        Args: { p_retention_days?: number }
        Returns: {
          payment_proof_path: string
          request_id: string
        }[]
      }
      normalize_document_number: { Args: { p_value: string }; Returns: string }
      normalize_raffle_prizes: { Args: { p_prizes: Json }; Returns: Json }
      normalize_tracking_code: { Args: { p_value: string }; Returns: string }
      purge_rate_limits: {
        Args: { p_retention_days?: number }
        Returns: number
      }
      reassign_frozen_ticket: {
        Args: {
          p_admin_user_id: string
          p_source_ticket_id: string
          p_target_raffle_id: string
        }
        Returns: {
          reassigned_ticket_id: string
          reassigned_ticket_number: number
          source_ticket_id: string
          target_raffle_name: string
        }[]
      }
      register_raffle_winner: {
        Args: {
          p_admin_user_id: string
          p_raffle_id: string
          p_ticket_number: number
        }
        Returns: {
          confirmed_at: string
          confirmed_by: string | null
          created_at: string
          id: string
          raffle_id: string
          ticket_id: string
        }
        SetofOptions: {
          from: "*"
          to: "raffle_winners"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_ticket_print: {
        Args: {
          p_admin_user_id: string
          p_reason?: string
          p_ticket_id: string
        }
        Returns: {
          max_reprints: number
          print_id: string
          print_sequence: number
          print_type: Database["public"]["Enums"]["ticket_print_type"]
          printed_at: string
          reprints_used: number
          ticket_id: string
          ticket_number: number
        }[]
      }
      reject_purchase_request: {
        Args: {
          p_admin_user_id: string
          p_purchase_request_id: string
          p_rejection_reason: string
        }
        Returns: {
          created_at: string
          dni: string
          document_type: Database["public"]["Enums"]["participant_document_type"]
          expires_at: string
          full_name: string
          id: string
          payment_proof_deleted_at: string | null
          payment_proof_path: string
          phone: string
          raffle_id: string
          rejection_reason: string | null
          requested_quantity: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["purchase_request_status"]
          tracking_code: string
          updated_at: string
          whatsapp: string
        }
        SetofOptions: {
          from: "*"
          to: "purchase_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      track_purchase_request:
        | {
            Args: { p_dni: string }
            Returns: {
              expires_at: string
              raffle_name: string
              rejection_reason: string
              request_id: string
              request_status: Database["public"]["Enums"]["purchase_request_status"]
              requested_at: string
              reviewed_at: string
              ticket_numbers: number[]
            }[]
          }
        | {
            Args: { p_dni: string; p_tracking_code: string }
            Returns: {
              expires_at: string
              raffle_name: string
              rejection_reason: string
              request_id: string
              request_status: Database["public"]["Enums"]["purchase_request_status"]
              requested_at: string
              reviewed_at: string
              ticket_numbers: number[]
            }[]
          }
        | {
            Args: {
              p_dni: string
              p_document_type: string
              p_tracking_code: string
            }
            Returns: {
              expires_at: string
              raffle_name: string
              rejection_reason: string
              request_id: string
              request_status: Database["public"]["Enums"]["purchase_request_status"]
              requested_at: string
              reviewed_at: string
              ticket_numbers: number[]
            }[]
          }
      update_raffle: {
        Args: {
          p_admin_user_id: string
          p_closes_at: string
          p_description: string
          p_draw_at: string
          p_name: string
          p_prizes?: Json
          p_raffle_id: string
          p_starts_at: string
          p_ticket_price: number
          p_total_tickets: number
        }
        Returns: {
          closed_at: string | null
          closes_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          draw_at: string | null
          id: string
          image_path: string | null
          name: string
          prizes: Json
          starts_at: string | null
          status: Database["public"]["Enums"]["raffle_status"]
          ticket_price: number
          total_tickets: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "raffles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      participant_document_type: "dni" | "cui"
      purchase_request_status: "pending" | "approved" | "rejected" | "expired"
      raffle_status: "draft" | "active" | "closed" | "cancelled"
      ticket_lifecycle_status: "active" | "frozen" | "reassigned"
      ticket_print_type: "original" | "reprint"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      participant_document_type: ["dni", "cui"],
      purchase_request_status: ["pending", "approved", "rejected", "expired"],
      raffle_status: ["draft", "active", "closed", "cancelled"],
      ticket_lifecycle_status: ["active", "frozen", "reassigned"],
      ticket_print_type: ["original", "reprint"],
    },
  },
} as const
