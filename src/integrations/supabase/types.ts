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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      audio_latencies: {
        Row: {
          created_at: string
          direction: string
          id: string
          metadata_json: Json | null
          session_id: string | null
          stt_text_len: number | null
          t_audio_playback_ms: number | null
          t_stt_ms: number | null
          t_tts_first_byte_ms: number | null
          t_tts_total_ms: number | null
          tts_text_len: number | null
          turn_index: number | null
        }
        Insert: {
          created_at?: string
          direction: string
          id?: string
          metadata_json?: Json | null
          session_id?: string | null
          stt_text_len?: number | null
          t_audio_playback_ms?: number | null
          t_stt_ms?: number | null
          t_tts_first_byte_ms?: number | null
          t_tts_total_ms?: number | null
          tts_text_len?: number | null
          turn_index?: number | null
        }
        Update: {
          created_at?: string
          direction?: string
          id?: string
          metadata_json?: Json | null
          session_id?: string | null
          stt_text_len?: number | null
          t_audio_playback_ms?: number | null
          t_stt_ms?: number | null
          t_tts_first_byte_ms?: number | null
          t_tts_total_ms?: number | null
          tts_text_len?: number | null
          turn_index?: number | null
        }
        Relationships: []
      }
      characters: {
        Row: {
          backstory: string | null
          branch: string | null
          created_at: string | null
          id: string
          name: string
          notion_id: string | null
          personality: string | null
          system_prompt: string | null
          updated_at: string | null
        }
        Insert: {
          backstory?: string | null
          branch?: string | null
          created_at?: string | null
          id?: string
          name: string
          notion_id?: string | null
          personality?: string | null
          system_prompt?: string | null
          updated_at?: string | null
        }
        Update: {
          backstory?: string | null
          branch?: string | null
          created_at?: string | null
          id?: string
          name?: string
          notion_id?: string | null
          personality?: string | null
          system_prompt?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      embeddings: {
        Row: {
          character_id: string | null
          content: string
          created_at: string | null
          embedding: string | null
          embedding_provider: string
          embedding_v: string | null
          id: string
          source_id: string
          source_table: string
        }
        Insert: {
          character_id?: string | null
          content: string
          created_at?: string | null
          embedding?: string | null
          embedding_provider?: string
          embedding_v?: string | null
          id?: string
          source_id: string
          source_table: string
        }
        Update: {
          character_id?: string | null
          content?: string
          created_at?: string | null
          embedding?: string | null
          embedding_provider?: string
          embedding_v?: string | null
          id?: string
          source_id?: string
          source_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "embeddings_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      gameplay_steps: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          notion_id: string | null
          step_order: number | null
          trigger_condition: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          notion_id?: string | null
          step_order?: number | null
          trigger_condition?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          notion_id?: string | null
          step_order?: number | null
          trigger_condition?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      llm_usage: {
        Row: {
          completion_tokens: number | null
          cost_usd: number | null
          created_at: string
          error_message: string | null
          feature_key: string
          generation_id: string | null
          id: string
          metadata_json: Json | null
          model: string
          prompt_tokens: number | null
          request_type: string
          session_id: string | null
          status: string
          total_tokens: number | null
        }
        Insert: {
          completion_tokens?: number | null
          cost_usd?: number | null
          created_at?: string
          error_message?: string | null
          feature_key?: string
          generation_id?: string | null
          id?: string
          metadata_json?: Json | null
          model: string
          prompt_tokens?: number | null
          request_type?: string
          session_id?: string | null
          status?: string
          total_tokens?: number | null
        }
        Update: {
          completion_tokens?: number | null
          cost_usd?: number | null
          created_at?: string
          error_message?: string | null
          feature_key?: string
          generation_id?: string | null
          id?: string
          metadata_json?: Json | null
          model?: string
          prompt_tokens?: number | null
          request_type?: string
          session_id?: string | null
          status?: string
          total_tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "llm_usage_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      openrouter_cost_error_logs: {
        Row: {
          created_at: string
          error_message: string | null
          error_type: string
          generation_id: string | null
          id: string
          metadata_json: Json
          occurred_at: string
          session_id: string | null
          source: string
          status_code: number | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          error_type: string
          generation_id?: string | null
          id?: string
          metadata_json?: Json
          occurred_at?: string
          session_id?: string | null
          source?: string
          status_code?: number | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          error_type?: string
          generation_id?: string | null
          id?: string
          metadata_json?: Json
          occurred_at?: string
          session_id?: string | null
          source?: string
          status_code?: number | null
        }
        Relationships: []
      }
      rules: {
        Row: {
          category: string | null
          content: string | null
          created_at: string | null
          id: string
          notion_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          notion_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          notion_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      session_summaries: {
        Row: {
          created_at: string
          id: string
          last_turn: number
          session_id: string
          summary: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_turn?: number
          session_id: string
          summary?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_turn?: number
          session_id?: string
          summary?: string
          updated_at?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          admin_note: string | null
          branch: string | null
          conversation_log: Json | null
          duration_seconds: number | null
          ended_at: string | null
          game_over_reason: string | null
          gm_post_turn_log: Json
          id: string
          modalite_voix: string | null
          name: string | null
          narrative_end: boolean | null
          personnage_appele: string | null
          player_role: Json | null
          questionnaire_responses: Json | null
          started_at: string | null
          triggers_activated: string[] | null
          trust_level: number | null
          variante_onboarding: string | null
        }
        Insert: {
          admin_note?: string | null
          branch?: string | null
          conversation_log?: Json | null
          duration_seconds?: number | null
          ended_at?: string | null
          game_over_reason?: string | null
          gm_post_turn_log?: Json
          id?: string
          modalite_voix?: string | null
          name?: string | null
          narrative_end?: boolean | null
          personnage_appele?: string | null
          player_role?: Json | null
          questionnaire_responses?: Json | null
          started_at?: string | null
          triggers_activated?: string[] | null
          trust_level?: number | null
          variante_onboarding?: string | null
        }
        Update: {
          admin_note?: string | null
          branch?: string | null
          conversation_log?: Json | null
          duration_seconds?: number | null
          ended_at?: string | null
          game_over_reason?: string | null
          gm_post_turn_log?: Json
          id?: string
          modalite_voix?: string | null
          name?: string | null
          narrative_end?: boolean | null
          personnage_appele?: string | null
          player_role?: Json | null
          questionnaire_responses?: Json | null
          started_at?: string | null
          triggers_activated?: string[] | null
          trust_level?: number | null
          variante_onboarding?: string | null
        }
        Relationships: []
      }
      storyworld: {
        Row: {
          category: string | null
          content: string | null
          created_at: string | null
          id: string
          notion_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          notion_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          notion_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      turn_latencies: {
        Row: {
          character: string | null
          created_at: string
          gm_model: string | null
          had_fallback: boolean | null
          id: string
          max_model: string | null
          max_response_len: number | null
          metadata_json: Json | null
          rag_matches_count: number | null
          rag_top_similarity: number | null
          session_id: string | null
          t_gm_post_ms: number | null
          t_gm_pre_ms: number | null
          t_knowledge_build_ms: number | null
          t_max_first_token_ms: number | null
          t_max_llm_ms: number | null
          t_rag_query_ms: number | null
          t_rag_rewrite_ms: number | null
          t_rag_total_ms: number | null
          t_turn_total_ms: number | null
          t_validator_ms: number | null
          turn_index: number | null
          usage_total_tokens: number | null
          user_message_len: number | null
          validator_model: string | null
          voice_modality: string | null
        }
        Insert: {
          character?: string | null
          created_at?: string
          gm_model?: string | null
          had_fallback?: boolean | null
          id?: string
          max_model?: string | null
          max_response_len?: number | null
          metadata_json?: Json | null
          rag_matches_count?: number | null
          rag_top_similarity?: number | null
          session_id?: string | null
          t_gm_post_ms?: number | null
          t_gm_pre_ms?: number | null
          t_knowledge_build_ms?: number | null
          t_max_first_token_ms?: number | null
          t_max_llm_ms?: number | null
          t_rag_query_ms?: number | null
          t_rag_rewrite_ms?: number | null
          t_rag_total_ms?: number | null
          t_turn_total_ms?: number | null
          t_validator_ms?: number | null
          turn_index?: number | null
          usage_total_tokens?: number | null
          user_message_len?: number | null
          validator_model?: string | null
          voice_modality?: string | null
        }
        Update: {
          character?: string | null
          created_at?: string
          gm_model?: string | null
          had_fallback?: boolean | null
          id?: string
          max_model?: string | null
          max_response_len?: number | null
          metadata_json?: Json | null
          rag_matches_count?: number | null
          rag_top_similarity?: number | null
          session_id?: string | null
          t_gm_post_ms?: number | null
          t_gm_pre_ms?: number | null
          t_knowledge_build_ms?: number | null
          t_max_first_token_ms?: number | null
          t_max_llm_ms?: number | null
          t_rag_query_ms?: number | null
          t_rag_rewrite_ms?: number | null
          t_rag_total_ms?: number | null
          t_turn_total_ms?: number | null
          t_validator_ms?: number | null
          turn_index?: number | null
          usage_total_tokens?: number | null
          user_message_len?: number | null
          validator_model?: string | null
          voice_modality?: string | null
        }
        Relationships: []
      }
      video_triggers: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          gameplay_step_id: string | null
          id: string
          notion_id: string | null
          placeholder_text: string | null
          post_video_context: string | null
          priority: number | null
          themes: string[] | null
          title: string
          transition_style: string | null
          type: string
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string | null
          duration_seconds?: number | null
          gameplay_step_id?: string | null
          id?: string
          notion_id?: string | null
          placeholder_text?: string | null
          post_video_context?: string | null
          priority?: number | null
          themes?: string[] | null
          title: string
          transition_style?: string | null
          type: string
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number | null
          gameplay_step_id?: string | null
          id?: string
          notion_id?: string | null
          placeholder_text?: string | null
          post_video_context?: string | null
          priority?: number | null
          themes?: string[] | null
          title?: string
          transition_style?: string | null
          type?: string
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_triggers_gameplay_step_id_fkey"
            columns: ["gameplay_step_id"]
            isOneToOne: false
            referencedRelation: "gameplay_steps"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_embeddings: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          similarity: number
          source_id: string
          source_table: string
        }[]
      }
      match_embeddings_scoped: {
        Args: {
          match_count?: number
          match_threshold?: number
          p_character_id?: string
          query_embedding: string
        }
        Returns: {
          character_id: string
          content: string
          id: string
          similarity: number
          source_id: string
          source_table: string
        }[]
      }
      match_embeddings_voyage: {
        Args: {
          match_count?: number
          match_threshold?: number
          p_character_id?: string
          query_embedding: string
        }
        Returns: {
          character_id: string
          content: string
          id: string
          similarity: number
          source_id: string
          source_table: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
