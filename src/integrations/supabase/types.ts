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
      admin_legacy_access_log: {
        Row: {
          accessed_at: string
          id: string
          tab: string
          user_id: string
        }
        Insert: {
          accessed_at?: string
          id?: string
          tab: string
          user_id: string
        }
        Update: {
          accessed_at?: string
          id?: string
          tab?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_settings: {
        Row: {
          environment_id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          environment_id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          environment_id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "admin_settings_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string
          default_environment_id: string
          display_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_environment_id: string
          display_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_environment_id?: string
          display_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_users_default_environment_id_fkey"
            columns: ["default_environment_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_latencies: {
        Row: {
          context_type: string
          created_at: string
          direction: string
          environment_id: string
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
          context_type?: string
          created_at?: string
          direction: string
          environment_id?: string
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
          context_type?: string
          created_at?: string
          direction?: string
          environment_id?: string
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
        Relationships: [
          {
            foreignKeyName: "audio_latencies_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
        ]
      }
      character_prompts: {
        Row: {
          ce_que_tu_ne_fais_jamais: string
          ce_que_tu_sais_utilisateur: string
          character_id: string
          created_at: string
          dynamique_conversation: string
          environment_id: string
          identite_fondamentale: string
          profondeur_par_niveau: string
          qui_tu_es: string
          situation_summary: string
          sujets_sensibles: string
          timeline: string
          updated_at: string
        }
        Insert: {
          ce_que_tu_ne_fais_jamais?: string
          ce_que_tu_sais_utilisateur?: string
          character_id: string
          created_at?: string
          dynamique_conversation?: string
          environment_id?: string
          identite_fondamentale?: string
          profondeur_par_niveau?: string
          qui_tu_es?: string
          situation_summary?: string
          sujets_sensibles?: string
          timeline?: string
          updated_at?: string
        }
        Update: {
          ce_que_tu_ne_fais_jamais?: string
          ce_que_tu_sais_utilisateur?: string
          character_id?: string
          created_at?: string
          dynamique_conversation?: string
          environment_id?: string
          identite_fondamentale?: string
          profondeur_par_niveau?: string
          qui_tu_es?: string
          situation_summary?: string
          sujets_sensibles?: string
          timeline?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_prompts_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_prompts_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
        ]
      }
      character_runtime_profiles: {
        Row: {
          character_key: string
          created_at: string
          display_name: string
          enabled: boolean
          environment_id: string
          id: string
          knowledge_isolation_validated: boolean
          metadata: Json
          notion_character_id: string | null
          opening_line: string | null
          portrait_url: string | null
          prompt_validated: boolean
          qualitative_tests_validated: boolean
          rag_validated: boolean
          tts_provider: string | null
          tts_voice_id: string | null
          updated_at: string
        }
        Insert: {
          character_key: string
          created_at?: string
          display_name: string
          enabled?: boolean
          environment_id?: string
          id?: string
          knowledge_isolation_validated?: boolean
          metadata?: Json
          notion_character_id?: string | null
          opening_line?: string | null
          portrait_url?: string | null
          prompt_validated?: boolean
          qualitative_tests_validated?: boolean
          rag_validated?: boolean
          tts_provider?: string | null
          tts_voice_id?: string | null
          updated_at?: string
        }
        Update: {
          character_key?: string
          created_at?: string
          display_name?: string
          enabled?: boolean
          environment_id?: string
          id?: string
          knowledge_isolation_validated?: boolean
          metadata?: Json
          notion_character_id?: string | null
          opening_line?: string | null
          portrait_url?: string | null
          prompt_validated?: boolean
          qualitative_tests_validated?: boolean
          rag_validated?: boolean
          tts_provider?: string | null
          tts_voice_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_runtime_profiles_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_runtime_profiles_notion_character_id_fkey"
            columns: ["notion_character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
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
      conversation_turn_traces: {
        Row: {
          character_name: string
          created_at: string
          id: string
          schema_version: number
          session_id: string
          status: string
          trace: Json
          turn_id: string
          turn_index: number
          updated_at: string
        }
        Insert: {
          character_name?: string
          created_at?: string
          id?: string
          schema_version?: number
          session_id: string
          status?: string
          trace: Json
          turn_id: string
          turn_index: number
          updated_at?: string
        }
        Update: {
          character_name?: string
          created_at?: string
          id?: string
          schema_version?: number
          session_id?: string
          status?: string
          trace?: Json
          turn_id?: string
          turn_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_turn_traces_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      embeddings: {
        Row: {
          character_id: string | null
          chunk_count: number | null
          chunk_index: number | null
          chunking_strategy: string | null
          content: string
          created_at: string | null
          embedding: string | null
          embedding_dimension: number | null
          embedding_dtype: string | null
          embedding_model: string | null
          embedding_profile: string
          embedding_provider: string
          embedding_v: string | null
          id: string
          indexed_at: string | null
          source_id: string
          source_table: string
        }
        Insert: {
          character_id?: string | null
          chunk_count?: number | null
          chunk_index?: number | null
          chunking_strategy?: string | null
          content: string
          created_at?: string | null
          embedding?: string | null
          embedding_dimension?: number | null
          embedding_dtype?: string | null
          embedding_model?: string | null
          embedding_profile?: string
          embedding_provider?: string
          embedding_v?: string | null
          id?: string
          indexed_at?: string | null
          source_id: string
          source_table: string
        }
        Update: {
          character_id?: string | null
          chunk_count?: number | null
          chunk_index?: number | null
          chunking_strategy?: string | null
          content?: string
          created_at?: string | null
          embedding?: string | null
          embedding_dimension?: number | null
          embedding_dtype?: string | null
          embedding_model?: string | null
          embedding_profile?: string
          embedding_provider?: string
          embedding_v?: string | null
          id?: string
          indexed_at?: string | null
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
      environments: {
        Row: {
          created_at: string
          id: string
          label: string
          type: string
        }
        Insert: {
          created_at?: string
          id: string
          label: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          type?: string
        }
        Relationships: []
      }
      eval_items: {
        Row: {
          active: boolean
          category: string | null
          character_name: string
          created_at: string
          gold_answer: string
          id: string
          judge_notes: string
          max_length: number | null
          must_include: string
          must_not: string
          notion_page_id: string
          question: string
          sort_order: number
          synced_at: string
          tone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          character_name?: string
          created_at?: string
          gold_answer?: string
          id?: string
          judge_notes?: string
          max_length?: number | null
          must_include?: string
          must_not?: string
          notion_page_id: string
          question: string
          sort_order?: number
          synced_at?: string
          tone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          character_name?: string
          created_at?: string
          gold_answer?: string
          id?: string
          judge_notes?: string
          max_length?: number | null
          must_include?: string
          must_not?: string
          notion_page_id?: string
          question?: string
          sort_order?: number
          synced_at?: string
          tone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      eval_results: {
        Row: {
          config_label: string
          created_at: string
          error_message: string | null
          factor: string
          gm_brief: Json | null
          id: string
          item_id: string
          judge_json: Json | null
          latencies: Json | null
          max_response: string | null
          overall_score: number | null
          rag_matches: Json | null
          repeat_index: number
          run_id: string
          tokens: Json | null
          validator: Json | null
        }
        Insert: {
          config_label: string
          created_at?: string
          error_message?: string | null
          factor: string
          gm_brief?: Json | null
          id?: string
          item_id: string
          judge_json?: Json | null
          latencies?: Json | null
          max_response?: string | null
          overall_score?: number | null
          rag_matches?: Json | null
          repeat_index: number
          run_id: string
          tokens?: Json | null
          validator?: Json | null
        }
        Update: {
          config_label?: string
          created_at?: string
          error_message?: string | null
          factor?: string
          gm_brief?: Json | null
          id?: string
          item_id?: string
          judge_json?: Json | null
          latencies?: Json | null
          max_response?: string | null
          overall_score?: number | null
          rag_matches?: Json | null
          repeat_index?: number
          run_id?: string
          tokens?: Json | null
          validator?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "eval_results_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "eval_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eval_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "eval_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      eval_runs: {
        Row: {
          actual_cost_usd: number | null
          baseline: Json
          created_at: string
          created_by: string | null
          current_index: number
          error_message: string | null
          estimated_cost_usd: number | null
          estimated_turns: number | null
          finished_at: string | null
          id: string
          judge_model: string
          ofat_config: Json
          repeats: number
          started_at: string | null
          status: string
          total_turns: number
          updated_at: string
        }
        Insert: {
          actual_cost_usd?: number | null
          baseline?: Json
          created_at?: string
          created_by?: string | null
          current_index?: number
          error_message?: string | null
          estimated_cost_usd?: number | null
          estimated_turns?: number | null
          finished_at?: string | null
          id?: string
          judge_model: string
          ofat_config?: Json
          repeats?: number
          started_at?: string | null
          status?: string
          total_turns?: number
          updated_at?: string
        }
        Update: {
          actual_cost_usd?: number | null
          baseline?: Json
          created_at?: string
          created_by?: string | null
          current_index?: number
          error_message?: string | null
          estimated_cost_usd?: number | null
          estimated_turns?: number | null
          finished_at?: string | null
          id?: string
          judge_model?: string
          ofat_config?: Json
          repeats?: number
          started_at?: string | null
          status?: string
          total_turns?: number
          updated_at?: string
        }
        Relationships: []
      }
      experience_events: {
        Row: {
          character_key: string | null
          created_at: string
          event_key: string
          event_type: string
          id: string
          orchestration_version_id: string | null
          payload: Json
          session_id: string
          turn_id: string | null
          turn_index: number | null
        }
        Insert: {
          character_key?: string | null
          created_at?: string
          event_key: string
          event_type: string
          id?: string
          orchestration_version_id?: string | null
          payload?: Json
          session_id: string
          turn_id?: string | null
          turn_index?: number | null
        }
        Update: {
          character_key?: string | null
          created_at?: string
          event_key?: string
          event_type?: string
          id?: string
          orchestration_version_id?: string | null
          payload?: Json
          session_id?: string
          turn_id?: string | null
          turn_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "experience_events_orchestration_version_id_fkey"
            columns: ["orchestration_version_id"]
            isOneToOne: false
            referencedRelation: "experience_orchestration_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experience_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      experience_orchestration_versions: {
        Row: {
          archived_at: string | null
          config: Json
          created_at: string
          created_by: string | null
          environment_id: string
          id: string
          name: string
          prompt: string
          published_at: string | null
          source_version_id: string | null
          status: string
          updated_at: string
          version_number: number
        }
        Insert: {
          archived_at?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          environment_id?: string
          id?: string
          name?: string
          prompt: string
          published_at?: string | null
          source_version_id?: string | null
          status?: string
          updated_at?: string
          version_number?: number
        }
        Update: {
          archived_at?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          environment_id?: string
          id?: string
          name?: string
          prompt?: string
          published_at?: string | null
          source_version_id?: string | null
          status?: string
          updated_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "experience_orchestration_versions_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experience_orchestration_versions_source_version_id_fkey"
            columns: ["source_version_id"]
            isOneToOne: false
            referencedRelation: "experience_orchestration_versions"
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
      rag_index_state: {
        Row: {
          active_profile: string
          chunk_overlap_chars: number
          chunk_size_chars: number
          chunking_strategy: string
          dimension: number
          document_model: string
          dtype: string
          endpoint: string
          id: boolean
          last_rebuild_at: string | null
          previous_profile: string | null
          provider: string
          query_model: string
          status: string
          total_chunks: number
          updated_at: string
        }
        Insert: {
          active_profile: string
          chunk_overlap_chars: number
          chunk_size_chars: number
          chunking_strategy: string
          dimension: number
          document_model: string
          dtype: string
          endpoint: string
          id?: boolean
          last_rebuild_at?: string | null
          previous_profile?: string | null
          provider: string
          query_model: string
          status?: string
          total_chunks?: number
          updated_at?: string
        }
        Update: {
          active_profile?: string
          chunk_overlap_chars?: number
          chunk_size_chars?: number
          chunking_strategy?: string
          dimension?: number
          document_model?: string
          dtype?: string
          endpoint?: string
          id?: boolean
          last_rebuild_at?: string | null
          previous_profile?: string | null
          provider?: string
          query_model?: string
          status?: string
          total_chunks?: number
          updated_at?: string
        }
        Relationships: []
      }
      rag_lab_pinned_questions: {
        Row: {
          character_name: string | null
          created_at: string
          created_by: string | null
          id: string
          message_index: number
          question: string
          session_id: string
        }
        Insert: {
          character_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          message_index: number
          question: string
          session_id: string
        }
        Update: {
          character_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          message_index?: number
          question?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rag_lab_pinned_questions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_lab_question_corpus_cache: {
        Row: {
          built_revision: number
          error: string | null
          excluded_question_count: number
          generated_at: string | null
          generation_model: string | null
          id: boolean
          questions: Json
          refresh_started_at: string | null
          session_count: number
          source_question_count: number
          source_revision: number
          status: string
          unique_question_count: number
          updated_at: string
          user_turn_count: number
        }
        Insert: {
          built_revision?: number
          error?: string | null
          excluded_question_count?: number
          generated_at?: string | null
          generation_model?: string | null
          id?: boolean
          questions?: Json
          refresh_started_at?: string | null
          session_count?: number
          source_question_count?: number
          source_revision?: number
          status?: string
          unique_question_count?: number
          updated_at?: string
          user_turn_count?: number
        }
        Update: {
          built_revision?: number
          error?: string | null
          excluded_question_count?: number
          generated_at?: string | null
          generation_model?: string | null
          id?: boolean
          questions?: Json
          refresh_started_at?: string | null
          session_count?: number
          source_question_count?: number
          source_revision?: number
          status?: string
          unique_question_count?: number
          updated_at?: string
          user_turn_count?: number
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
          active_character: string
          admin_note: string | null
          ava_start_variant: string | null
          branch: string | null
          campaign_id: string | null
          context_type: string
          conversation_log: Json | null
          conversation_memory: Json
          diagnostic_trace_enabled: boolean
          duration_seconds: number | null
          ended_at: string | null
          environment_id: string
          first_max_response_at: string | null
          game_over_reason: string | null
          gm_post_turn_log: Json
          handoff_count: number
          has_seen_film: string | null
          id: string
          memory_last_turn: number
          modalite_voix: string | null
          name: string | null
          narrative_end: boolean | null
          onboarding_duration_ms: number | null
          onboarding_started_at: string | null
          orchestration_version_id: string | null
          output_mode: string
          pending_handoff: Json | null
          personnage_appele: string | null
          player_role: Json | null
          questionnaire_responses: Json | null
          resume_expires_at: string | null
          started_at: string | null
          started_by_user_id: string | null
          streaming_avatar_connect_ms: number | null
          streaming_avatar_fallback_reason: string | null
          streaming_avatar_first_frame_ms: number | null
          streaming_avatar_first_speech_ms: number | null
          streaming_avatar_provider: string | null
          streaming_avatar_session_id: string | null
          teaser_shown: boolean | null
          tester_label: string | null
          triggers_activated: string[] | null
          trust_level: number | null
          user_id: string | null
          user_posture_mode: string | null
          user_posture_raw: string | null
          variante_onboarding: string | null
        }
        Insert: {
          active_character?: string
          admin_note?: string | null
          ava_start_variant?: string | null
          branch?: string | null
          campaign_id?: string | null
          context_type?: string
          conversation_log?: Json | null
          conversation_memory?: Json
          diagnostic_trace_enabled?: boolean
          duration_seconds?: number | null
          ended_at?: string | null
          environment_id?: string
          first_max_response_at?: string | null
          game_over_reason?: string | null
          gm_post_turn_log?: Json
          handoff_count?: number
          has_seen_film?: string | null
          id?: string
          memory_last_turn?: number
          modalite_voix?: string | null
          name?: string | null
          narrative_end?: boolean | null
          onboarding_duration_ms?: number | null
          onboarding_started_at?: string | null
          orchestration_version_id?: string | null
          output_mode?: string
          pending_handoff?: Json | null
          personnage_appele?: string | null
          player_role?: Json | null
          questionnaire_responses?: Json | null
          resume_expires_at?: string | null
          started_at?: string | null
          started_by_user_id?: string | null
          streaming_avatar_connect_ms?: number | null
          streaming_avatar_fallback_reason?: string | null
          streaming_avatar_first_frame_ms?: number | null
          streaming_avatar_first_speech_ms?: number | null
          streaming_avatar_provider?: string | null
          streaming_avatar_session_id?: string | null
          teaser_shown?: boolean | null
          tester_label?: string | null
          triggers_activated?: string[] | null
          trust_level?: number | null
          user_id?: string | null
          user_posture_mode?: string | null
          user_posture_raw?: string | null
          variante_onboarding?: string | null
        }
        Update: {
          active_character?: string
          admin_note?: string | null
          ava_start_variant?: string | null
          branch?: string | null
          campaign_id?: string | null
          context_type?: string
          conversation_log?: Json | null
          conversation_memory?: Json
          diagnostic_trace_enabled?: boolean
          duration_seconds?: number | null
          ended_at?: string | null
          environment_id?: string
          first_max_response_at?: string | null
          game_over_reason?: string | null
          gm_post_turn_log?: Json
          handoff_count?: number
          has_seen_film?: string | null
          id?: string
          memory_last_turn?: number
          modalite_voix?: string | null
          name?: string | null
          narrative_end?: boolean | null
          onboarding_duration_ms?: number | null
          onboarding_started_at?: string | null
          orchestration_version_id?: string | null
          output_mode?: string
          pending_handoff?: Json | null
          personnage_appele?: string | null
          player_role?: Json | null
          questionnaire_responses?: Json | null
          resume_expires_at?: string | null
          started_at?: string | null
          started_by_user_id?: string | null
          streaming_avatar_connect_ms?: number | null
          streaming_avatar_fallback_reason?: string | null
          streaming_avatar_first_frame_ms?: number | null
          streaming_avatar_first_speech_ms?: number | null
          streaming_avatar_provider?: string | null
          streaming_avatar_session_id?: string | null
          teaser_shown?: boolean | null
          tester_label?: string | null
          triggers_activated?: string[] | null
          trust_level?: number | null
          user_id?: string | null
          user_posture_mode?: string | null
          user_posture_raw?: string | null
          variante_onboarding?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_orchestration_version_id_fkey"
            columns: ["orchestration_version_id"]
            isOneToOne: false
            referencedRelation: "experience_orchestration_versions"
            referencedColumns: ["id"]
          },
        ]
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
          context_type: string
          created_at: string
          environment_id: string
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
          context_type?: string
          created_at?: string
          environment_id?: string
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
          context_type?: string
          created_at?: string
          environment_id?: string
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
        Relationships: [
          {
            foreignKeyName: "turn_latencies_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      video_triggers: {
        Row: {
          context: string | null
          created_at: string | null
          description: string | null
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
          context?: string | null
          created_at?: string | null
          description?: string | null
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
          context?: string | null
          created_at?: string | null
          description?: string | null
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
      consume_game_rate_limit: {
        Args: { p_bucket: string; p_session_id?: string }
        Returns: Json
      }
      get_character_runtime_readiness: {
        Args: { p_character_key: string }
        Returns: {
          character_key: string
          display_name: string
          opening_line: string
          ready: boolean
          tts_provider: string
          tts_voice_id: string
        }[]
      }
      get_character_runtime_readiness_for_environment: {
        Args: { p_character_key: string; p_environment_id: string }
        Returns: {
          character_key: string
          display_name: string
          opening_line: string
          ready: boolean
          tts_provider: string
          tts_voice_id: string
        }[]
      }
      get_pinned_orchestration_runtime: {
        Args: { p_session_id: string }
        Returns: {
          config: Json
          prompt: string
          version_id: string
          version_number: number
        }[]
      }
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
          p_embedding_profile?: string
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
          p_embedding_profile?: string
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
      patch_conversation_turn_trace: {
        Args: {
          p_path: string[]
          p_session_id: string
          p_turn_index: number
          p_value: Json
        }
        Returns: undefined
      }
      pin_current_orchestration_version: {
        Args: { p_session_id: string }
        Returns: string
      }
      publish_experience_orchestration_version: {
        Args: { p_version_id: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin"
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
      app_role: ["admin"],
    },
  },
} as const
