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
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cards: {
        Row: {
          back: string
          category: string | null
          created_at: string
          deck_id: string
          front: string
          id: string
          metadata: Json
          notes: string | null
          position: number
          rank: number | null
          reverse_prompt: string | null
          source: string | null
          stable_key: string
          updated_at: string
        }
        Insert: {
          back: string
          category?: string | null
          created_at?: string
          deck_id: string
          front: string
          id?: string
          metadata?: Json
          notes?: string | null
          position: number
          rank?: number | null
          reverse_prompt?: string | null
          source?: string | null
          stable_key: string
          updated_at?: string
        }
        Update: {
          back?: string
          category?: string | null
          created_at?: string
          deck_id?: string
          front?: string
          id?: string
          metadata?: Json
          notes?: string | null
          position?: number
          rank?: number | null
          reverse_prompt?: string | null
          source?: string | null
          stable_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }
      deck_categories: {
        Row: {
          deck_id: string
          id: string
          name: string
          position: number
        }
        Insert: {
          deck_id: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          deck_id?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "deck_categories_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }
      decks: {
        Row: {
          created_at: string
          description: string
          id: string
          language: string
          published: boolean
          slug: string
          staged_config: Json | null
          subject: string
          supports_reverse: boolean
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          language?: string
          published?: boolean
          slug: string
          staged_config?: Json | null
          subject?: string
          supports_reverse?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          language?: string
          published?: boolean
          slug?: string
          staged_config?: Json | null
          subject?: string
          supports_reverse?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      readings: {
        Row: {
          audio_path: string | null
          audio_provider: string
          created_at: string
          id: string
          language: string
          playback_rate: number
          pronunciation_system: string
          sentence_segments: Json
          text: string
          title: string
          updated_at: string
          user_id: string
          word_timings: Json
        }
        Insert: {
          audio_path?: string | null
          audio_provider?: string
          created_at?: string
          id?: string
          language: string
          playback_rate?: number
          pronunciation_system?: string
          sentence_segments?: Json
          text: string
          title: string
          updated_at?: string
          user_id: string
          word_timings?: Json
        }
        Update: {
          audio_path?: string | null
          audio_provider?: string
          created_at?: string
          id?: string
          language?: string
          playback_rate?: number
          pronunciation_system?: string
          sentence_segments?: Json
          text?: string
          title?: string
          updated_at?: string
          user_id?: string
          word_timings?: Json
        }
        Relationships: []
      }
      review_events: {
        Row: {
          card_id: string
          created_at: string
          deck_id: string
          difficulty: string
          id: string
          response_time_ms: number
          result: string
          reviewed_at: string
          study_key: string
          user_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          deck_id: string
          difficulty: string
          id: string
          response_time_ms: number
          result: string
          reviewed_at: string
          study_key: string
          user_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          deck_id?: string
          difficulty?: string
          id?: string
          response_time_ms?: number
          result?: string
          reviewed_at?: string
          study_key?: string
          user_id?: string
        }
        Relationships: []
      }
      user_deck_states: {
        Row: {
          deck_id: string
          state: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          deck_id: string
          state: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          deck_id?: string
          state?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
