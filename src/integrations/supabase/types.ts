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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          target_key: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          target_key?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          target_key?: string | null
          target_type?: string
        }
        Relationships: []
      }
      affiliate_events: {
        Row: {
          commission_amount: number
          created_at: string
          id: string
          meta: Json | null
          payment_id: string | null
          referred_id: string
          referrer_id: string
          status: Database["public"]["Enums"]["affiliate_event_status"]
          updated_at: string
        }
        Insert: {
          commission_amount?: number
          created_at?: string
          id?: string
          meta?: Json | null
          payment_id?: string | null
          referred_id: string
          referrer_id: string
          status?: Database["public"]["Enums"]["affiliate_event_status"]
          updated_at?: string
        }
        Update: {
          commission_amount?: number
          created_at?: string
          id?: string
          meta?: Json | null
          payment_id?: string | null
          referred_id?: string
          referrer_id?: string
          status?: Database["public"]["Enums"]["affiliate_event_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      caption_exports: {
        Row: {
          caption_reels: string | null
          caption_tiktok: string | null
          created_at: string
          hashtags: Json | null
          id: string
          project_id: string
          short_description: string | null
          thumbnail_text: string | null
        }
        Insert: {
          caption_reels?: string | null
          caption_tiktok?: string | null
          created_at?: string
          hashtags?: Json | null
          id?: string
          project_id: string
          short_description?: string | null
          thumbnail_text?: string | null
        }
        Update: {
          caption_reels?: string | null
          caption_tiktok?: string | null
          created_at?: string
          hashtags?: Json | null
          id?: string
          project_id?: string
          short_description?: string | null
          thumbnail_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "caption_exports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      concepts: {
        Row: {
          angle_type: Database["public"]["Enums"]["angle_type"]
          big_idea: string | null
          created_at: string
          cta: string | null
          hook: string | null
          id: string
          is_selected: boolean
          project_id: string
          score: number | null
          title: string
          why_it_works: string | null
        }
        Insert: {
          angle_type: Database["public"]["Enums"]["angle_type"]
          big_idea?: string | null
          created_at?: string
          cta?: string | null
          hook?: string | null
          id?: string
          is_selected?: boolean
          project_id: string
          score?: number | null
          title: string
          why_it_works?: string | null
        }
        Update: {
          angle_type?: Database["public"]["Enums"]["angle_type"]
          big_idea?: string | null
          created_at?: string
          cta?: string | null
          hook?: string | null
          id?: string
          is_selected?: boolean
          project_id?: string
          score?: number | null
          title?: string
          why_it_works?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "concepts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_ledger: {
        Row: {
          balance_after: number
          created_at: string
          delta: number
          id: string
          payment_id: string | null
          project_id: string | null
          reason: string
          user_id: string
        }
        Insert: {
          balance_after: number
          created_at?: string
          delta: number
          id?: string
          payment_id?: string | null
          project_id?: string | null
          reason: string
          user_id: string
        }
        Update: {
          balance_after?: number
          created_at?: string
          delta?: number
          id?: string
          payment_id?: string | null
          project_id?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          credit_pack_code: string | null
          currency: string
          id: string
          idempotency_key: string
          meta: Json | null
          order_type: Database["public"]["Enums"]["order_type"]
          payment_method: string | null
          plan_code: string | null
          provider: string
          provider_txn_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          credit_pack_code?: string | null
          currency?: string
          id?: string
          idempotency_key: string
          meta?: Json | null
          order_type: Database["public"]["Enums"]["order_type"]
          payment_method?: string | null
          plan_code?: string | null
          provider: string
          provider_txn_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          credit_pack_code?: string | null
          currency?: string
          id?: string
          idempotency_key?: string
          meta?: Json | null
          order_type?: Database["public"]["Enums"]["order_type"]
          payment_method?: string | null
          plan_code?: string | null
          provider?: string
          provider_txn_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          code: string
          created_at: string
          credits: number
          currency: string
          features: Json
          id: string
          is_active: boolean
          name: string
          price: number
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          credits?: number
          currency?: string
          features?: Json
          id?: string
          is_active?: boolean
          name: string
          price?: number
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          credits?: number
          currency?: string
          features?: Json
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
        }
        Relationships: []
      }
      product_intelligence: {
        Row: {
          category: Database["public"]["Enums"]["product_category"] | null
          confidence_score: number | null
          created_at: string
          id: string
          objections: Json | null
          pain_points: Json | null
          price_band: Database["public"]["Enums"]["price_band"] | null
          product_name: string | null
          project_id: string
          raw_response: Json | null
          recommended_package_fit: Json | null
          target_buyer: string | null
          trust_signals: Json | null
          use_context: Json | null
          usp_list: Json | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["product_category"] | null
          confidence_score?: number | null
          created_at?: string
          id?: string
          objections?: Json | null
          pain_points?: Json | null
          price_band?: Database["public"]["Enums"]["price_band"] | null
          product_name?: string | null
          project_id: string
          raw_response?: Json | null
          recommended_package_fit?: Json | null
          target_buyer?: string | null
          trust_signals?: Json | null
          use_context?: Json | null
          usp_list?: Json | null
        }
        Update: {
          category?: Database["public"]["Enums"]["product_category"] | null
          confidence_score?: number | null
          created_at?: string
          id?: string
          objections?: Json | null
          pain_points?: Json | null
          price_band?: Database["public"]["Enums"]["price_band"] | null
          product_name?: string | null
          project_id?: string
          raw_response?: Json | null
          recommended_package_fit?: Json | null
          target_buyer?: string | null
          trust_signals?: Json | null
          use_context?: Json | null
          usp_list?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "product_intelligence_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          affiliate_code: string | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string
          id: string
          referred_by: string | null
          updated_at: string
        }
        Insert: {
          affiliate_code?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          referred_by?: string | null
          updated_at?: string
        }
        Update: {
          affiliate_code?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          referred_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_assets: {
        Row: {
          asset_type: string
          created_at: string
          file_name: string
          file_size: number
          file_url: string
          id: string
          project_id: string
          sort_order: number
        }
        Insert: {
          asset_type: string
          created_at?: string
          file_name: string
          file_size?: number
          file_url: string
          id?: string
          project_id: string
          sort_order?: number
        }
        Update: {
          asset_type?: string
          created_at?: string
          file_name?: string
          file_size?: number
          file_url?: string
          id?: string
          project_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          category: Database["public"]["Enums"]["product_category"]
          created_at: string
          id: string
          language: string
          manual_notes: string | null
          package_type: Database["public"]["Enums"]["package_type"]
          source_url: string | null
          status: Database["public"]["Enums"]["project_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["product_category"]
          created_at?: string
          id?: string
          language?: string
          manual_notes?: string | null
          package_type: Database["public"]["Enums"]["package_type"]
          source_url?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["product_category"]
          created_at?: string
          id?: string
          language?: string
          manual_notes?: string | null
          package_type?: Database["public"]["Enums"]["package_type"]
          source_url?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prompts: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          package_type: Database["public"]["Enums"]["package_type"] | null
          updated_at: string
          version: number
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          package_type?: Database["public"]["Enums"]["package_type"] | null
          updated_at?: string
          version?: number
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          package_type?: Database["public"]["Enums"]["package_type"] | null
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      renders: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_code: string | null
          error_message: string | null
          id: string
          last_fail_reason: string | null
          output_url: string | null
          project_id: string
          provider: string | null
          render_mode: Database["public"]["Enums"]["render_mode"]
          status: Database["public"]["Enums"]["render_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          last_fail_reason?: string | null
          output_url?: string | null
          project_id: string
          provider?: string | null
          render_mode?: Database["public"]["Enums"]["render_mode"]
          status?: Database["public"]["Enums"]["render_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          last_fail_reason?: string | null
          output_url?: string | null
          project_id?: string
          provider?: string | null
          render_mode?: Database["public"]["Enums"]["render_mode"]
          status?: Database["public"]["Enums"]["render_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "renders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      scripts: {
        Row: {
          created_at: string
          cta: string | null
          duration_sec: number
          id: string
          package_type: Database["public"]["Enums"]["package_type"]
          project_id: string
          scene_cards: Json | null
          script_text: string | null
        }
        Insert: {
          created_at?: string
          cta?: string | null
          duration_sec?: number
          id?: string
          package_type: Database["public"]["Enums"]["package_type"]
          project_id: string
          scene_cards?: Json | null
          script_text?: string | null
        }
        Update: {
          created_at?: string
          cta?: string | null
          duration_sec?: number
          id?: string
          package_type?: Database["public"]["Enums"]["package_type"]
          project_id?: string
          scene_cards?: Json | null
          script_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scripts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      service_health_logs: {
        Row: {
          checked_at: string
          id: string
          meta: Json | null
          response_time_ms: number | null
          service_name: string
          service_url: string
          status: string
        }
        Insert: {
          checked_at?: string
          id?: string
          meta?: Json | null
          response_time_ms?: number | null
          service_name: string
          service_url: string
          status: string
        }
        Update: {
          checked_at?: string
          id?: string
          meta?: Json | null
          response_time_ms?: number | null
          service_name?: string
          service_url?: string
          status?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      usage_logs: {
        Row: {
          created_at: string
          credits_used: number
          id: string
          meta: Json | null
          project_id: string | null
          step_name: string
          trace_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_used?: number
          id?: string
          meta?: Json | null
          project_id?: string | null
          step_name: string
          trace_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          credits_used?: number
          id?: string
          meta?: Json | null
          project_id?: string | null
          step_name?: string
          trace_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visual_packs: {
        Row: {
          aspect_ratio: string
          asset_plan: Json | null
          created_at: string
          id: string
          music_hint: string | null
          overlay_list: Json | null
          project_id: string
          render_mode: Database["public"]["Enums"]["render_mode"]
          subtitle_text: string | null
        }
        Insert: {
          aspect_ratio?: string
          asset_plan?: Json | null
          created_at?: string
          id?: string
          music_hint?: string | null
          overlay_list?: Json | null
          project_id: string
          render_mode?: Database["public"]["Enums"]["render_mode"]
          subtitle_text?: string | null
        }
        Update: {
          aspect_ratio?: string
          asset_plan?: Json | null
          created_at?: string
          id?: string
          music_hint?: string | null
          overlay_list?: Json | null
          project_id?: string
          render_mode?: Database["public"]["Enums"]["render_mode"]
          subtitle_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visual_packs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      lookup_affiliate_referrer: { Args: { ref_code: string }; Returns: string }
    }
    Enums: {
      affiliate_event_status: "pending" | "approved" | "paid" | "rejected"
      angle_type: "pain_first" | "review_trust" | "offer_conversion"
      app_role: "admin" | "moderator" | "user"
      order_type: "plan_subscription" | "credit_pack"
      overlay_style: "headline" | "price" | "badge" | "cta"
      package_type: "quick_ads" | "review_video" | "conversion_video"
      payment_status: "pending" | "paid" | "failed" | "refunded"
      price_band: "low" | "mid" | "high"
      product_category: "beauty" | "fashion" | "home" | "other"
      project_status:
        | "draft"
        | "analyzing"
        | "concept_ready"
        | "script_ready"
        | "render_queued"
        | "rendering"
        | "completed"
        | "failed"
      render_mode: "draft_local" | "draft_local_tts" | "premium_cloud"
      render_status:
        | "queued"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
      tts_mode: "local" | "cloud"
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
  public: {
    Enums: {
      affiliate_event_status: ["pending", "approved", "paid", "rejected"],
      angle_type: ["pain_first", "review_trust", "offer_conversion"],
      app_role: ["admin", "moderator", "user"],
      order_type: ["plan_subscription", "credit_pack"],
      overlay_style: ["headline", "price", "badge", "cta"],
      package_type: ["quick_ads", "review_video", "conversion_video"],
      payment_status: ["pending", "paid", "failed", "refunded"],
      price_band: ["low", "mid", "high"],
      product_category: ["beauty", "fashion", "home", "other"],
      project_status: [
        "draft",
        "analyzing",
        "concept_ready",
        "script_ready",
        "render_queued",
        "rendering",
        "completed",
        "failed",
      ],
      render_mode: ["draft_local", "draft_local_tts", "premium_cloud"],
      render_status: [
        "queued",
        "processing",
        "completed",
        "failed",
        "cancelled",
      ],
      tts_mode: ["local", "cloud"],
    },
  },
} as const
