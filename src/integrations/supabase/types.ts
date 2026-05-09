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
      categorize_rules: {
        Row: {
          category: string
          created_at: string
          id: string
          match_type: string
          pattern: string
          priority: number
          transaction_type: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          match_type: string
          pattern: string
          priority?: number
          transaction_type: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          match_type?: string
          pattern?: string
          priority?: number
          transaction_type?: string
          user_id?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          color: string
          created_at: string
          icon: string | null
          id: string
          name: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          expense_date: string
          id: string
          image_urls: string[]
          type: string
          updated_at: string
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          image_urls?: string[]
          type?: string
          updated_at?: string
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          image_urls?: string[]
          type?: string
          updated_at?: string
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: []
      }
      portfolios: {
        Row: {
          color: string
          created_at: string
          currency: string
          description: string | null
          id: string
          initial_balance: number
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          initial_balance?: number
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          initial_balance?: number
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shortcut_tokens: {
        Row: {
          created_at: string
          id: string
          label: string
          last_used_at: string | null
          token_hash: string
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string
          last_used_at?: string | null
          token_hash: string
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          last_used_at?: string | null
          token_hash?: string
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: []
      }
      trades: {
        Row: {
          asset: string
          created_at: string
          emotion: string | null
          entry_price: number
          exit_price: number
          id: string
          image_urls: string[]
          note: string | null
          pnl: number
          portfolio_id: string | null
          side: string
          strategy: string | null
          trade_date: string
          updated_at: string
          user_id: string
          volume: number
        }
        Insert: {
          asset: string
          created_at?: string
          emotion?: string | null
          entry_price: number
          exit_price: number
          id?: string
          image_urls?: string[]
          note?: string | null
          pnl?: number
          portfolio_id?: string | null
          side?: string
          strategy?: string | null
          trade_date?: string
          updated_at?: string
          user_id: string
          volume: number
        }
        Update: {
          asset?: string
          created_at?: string
          emotion?: string | null
          entry_price?: number
          exit_price?: number
          id?: string
          image_urls?: string[]
          note?: string | null
          pnl?: number
          portfolio_id?: string | null
          side?: string
          strategy?: string | null
          trade_date?: string
          updated_at?: string
          user_id?: string
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "trades_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          color: string
          created_at: string
          currency: string
          description: string | null
          icon: string | null
          id: string
          initial_balance: number
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          currency?: string
          description?: string | null
          icon?: string | null
          id?: string
          initial_balance?: number
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          currency?: string
          description?: string | null
          icon?: string | null
          id?: string
          initial_balance?: number
          name?: string
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
