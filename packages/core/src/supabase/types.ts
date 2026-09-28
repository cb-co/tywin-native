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
      accounts: {
        Row: {
          bank_id: string | null
          brand: string | null
          card_group_id: string | null
          color: string | null
          created_at: string
          credit_limit: number | null
          currency: string
          current_balance: number
          icon: string | null
          id: string
          installment_amount: number | null
          interest_rate: number | null
          is_archived: boolean
          last4: string | null
          logo_url: string | null
          name: string
          network_fee_amount: number
          network_fee_optional: boolean
          original_term_months: number | null
          payment_due_day: number | null
          principal: number | null
          sort_order: number
          start_date: string | null
          starting_balance: number
          statement_closing_day: number | null
          term_months: number | null
          transfer_tax_rate: number
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
          user_id: string
          welcome_bonus_due_date: string | null
          welcome_bonus_goal_amount: number | null
          welcome_bonus_goal_currency: string | null
        }
        Insert: {
          bank_id?: string | null
          brand?: string | null
          card_group_id?: string | null
          color?: string | null
          created_at?: string
          credit_limit?: number | null
          currency: string
          current_balance?: number
          icon?: string | null
          id?: string
          installment_amount?: number | null
          interest_rate?: number | null
          is_archived?: boolean
          last4?: string | null
          logo_url?: string | null
          name: string
          network_fee_amount?: number
          network_fee_optional?: boolean
          original_term_months?: number | null
          payment_due_day?: number | null
          principal?: number | null
          sort_order?: number
          start_date?: string | null
          starting_balance?: number
          statement_closing_day?: number | null
          term_months?: number | null
          transfer_tax_rate?: number
          type: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id: string
          welcome_bonus_due_date?: string | null
          welcome_bonus_goal_amount?: number | null
          welcome_bonus_goal_currency?: string | null
        }
        Update: {
          bank_id?: string | null
          brand?: string | null
          card_group_id?: string | null
          color?: string | null
          created_at?: string
          credit_limit?: number | null
          currency?: string
          current_balance?: number
          icon?: string | null
          id?: string
          installment_amount?: number | null
          interest_rate?: number | null
          is_archived?: boolean
          last4?: string | null
          logo_url?: string | null
          name?: string
          network_fee_amount?: number
          network_fee_optional?: boolean
          original_term_months?: number | null
          payment_due_day?: number | null
          principal?: number | null
          sort_order?: number
          start_date?: string | null
          starting_balance?: number
          statement_closing_day?: number | null
          term_months?: number | null
          transfer_tax_rate?: number
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id?: string
          welcome_bonus_due_date?: string | null
          welcome_bonus_goal_amount?: number | null
          welcome_bonus_goal_currency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_card_group_id_fkey"
            columns: ["card_group_id"]
            isOneToOne: false
            referencedRelation: "card_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      banks: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      budget_group_budgets: {
        Row: {
          amount: number
          budget_group_id: string
          created_at: string
          id: string
          month: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          budget_group_id: string
          created_at?: string
          id?: string
          month: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          budget_group_id?: string
          created_at?: string
          id?: string
          month?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_group_budgets_budget_group_id_fkey"
            columns: ["budget_group_id"]
            isOneToOne: false
            referencedRelation: "budget_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_groups: {
        Row: {
          color: string | null
          created_at: string
          emoji: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      card_groups: {
        Row: {
          art_color: string | null
          art_url: string | null
          brand: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          art_color?: string | null
          art_url?: string | null
          brand?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          art_color?: string | null
          art_url?: string | null
          brand?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      card_statement_lines: {
        Row: {
          account_id: string
          amount: number
          auth_code: string | null
          created_at: string
          description: string
          id: string
          kind: Database["public"]["Enums"]["statement_line_kind"]
          line_no: number
          made_on: string
          mcc: string | null
          posted_on: string
          reference: string | null
          statement_id: string
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          auth_code?: string | null
          created_at?: string
          description: string
          id?: string
          kind: Database["public"]["Enums"]["statement_line_kind"]
          line_no: number
          made_on: string
          mcc?: string | null
          posted_on: string
          reference?: string | null
          statement_id: string
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          auth_code?: string | null
          created_at?: string
          description?: string
          id?: string
          kind?: Database["public"]["Enums"]["statement_line_kind"]
          line_no?: number
          made_on?: string
          mcc?: string | null
          posted_on?: string
          reference?: string | null
          statement_id?: string
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_statement_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "card_statement_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_statement_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "card_cost_of_carry"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "card_statement_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "card_status"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "card_statement_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "loan_status"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "card_statement_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "q_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_statement_lines_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "card_statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_statement_lines_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "q_card_statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_statement_lines_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "q_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_statement_lines_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      card_statements: {
        Row: {
          account_id: string
          available_credit: number | null
          avg_daily_balance: number | null
          avg_daily_balance_prior: number | null
          cashback_total: number | null
          cost_of_carry: number | null
          cost_of_carry_prior: number | null
          created_at: string
          credit_limit: number | null
          due_date: string | null
          file_url: string | null
          id: string
          import_id: string | null
          interest_rate_annual: number | null
          minimum_payment: number | null
          overdue_amount: number | null
          overdue_installments: number | null
          period_end: string
          period_start: string
          previous_balance: number | null
          section_key: string | null
          source: Database["public"]["Enums"]["statement_source"]
          statement_balance: number
          total_balance: number
          total_credits: number
          total_debits: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          available_credit?: number | null
          avg_daily_balance?: number | null
          avg_daily_balance_prior?: number | null
          cashback_total?: number | null
          cost_of_carry?: number | null
          cost_of_carry_prior?: number | null
          created_at?: string
          credit_limit?: number | null
          due_date?: string | null
          file_url?: string | null
          id?: string
          import_id?: string | null
          interest_rate_annual?: number | null
          minimum_payment?: number | null
          overdue_amount?: number | null
          overdue_installments?: number | null
          period_end: string
          period_start: string
          previous_balance?: number | null
          section_key?: string | null
          source?: Database["public"]["Enums"]["statement_source"]
          statement_balance?: number
          total_balance?: number
          total_credits?: number
          total_debits?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          available_credit?: number | null
          avg_daily_balance?: number | null
          avg_daily_balance_prior?: number | null
          cashback_total?: number | null
          cost_of_carry?: number | null
          cost_of_carry_prior?: number | null
          created_at?: string
          credit_limit?: number | null
          due_date?: string | null
          file_url?: string | null
          id?: string
          import_id?: string | null
          interest_rate_annual?: number | null
          minimum_payment?: number | null
          overdue_amount?: number | null
          overdue_installments?: number | null
          period_end?: string
          period_start?: string
          previous_balance?: number | null
          section_key?: string | null
          source?: Database["public"]["Enums"]["statement_source"]
          statement_balance?: number
          total_balance?: number
          total_credits?: number
          total_debits?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_statements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "card_statements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_statements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "card_cost_of_carry"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "card_statements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "card_status"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "card_statements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "loan_status"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "card_statements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "q_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_statements_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "statement_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          budget_group_id: string | null
          color: string | null
          created_at: string
          emoji: string | null
          icon: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          budget_group_id?: string | null
          color?: string | null
          created_at?: string
          emoji?: string | null
          icon?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          budget_group_id?: string | null
          color?: string | null
          created_at?: string
          emoji?: string | null
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_budget_group_id_fkey"
            columns: ["budget_group_id"]
            isOneToOne: false
            referencedRelation: "budget_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      category_budgets: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          id: string
          month: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          category_id: string
          created_at?: string
          id?: string
          month: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          id?: string
          month?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_rules: {
        Row: {
          category_id: string
          created_at: string
          id: string
          pattern: string
          priority: number
          rule_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          pattern: string
          priority?: number
          rule_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          pattern?: string
          priority?: number
          rule_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          name: string
          symbol: string
        }
        Insert: {
          code: string
          name: string
          symbol: string
        }
        Update: {
          code?: string
          name?: string
          symbol?: string
        }
        Relationships: []
      }
      daily_recommendations: {
        Row: {
          body: string
          generated_at: string
          headline: string
          locale: string
          recent: Json
          tone: string
          user_id: string
        }
        Insert: {
          body: string
          generated_at?: string
          headline: string
          locale: string
          recent?: Json
          tone: string
          user_id: string
        }
        Update: {
          body?: string
          generated_at?: string
          headline?: string
          locale?: string
          recent?: Json
          tone?: string
          user_id?: string
        }
        Relationships: []
      }
      goal_contributions: {
        Row: {
          account_id: string
          amount: number
          base_amount: number
          created_at: string
          currency: string
          exchange_rate: number
          goal_id: string
          id: string
          note: string | null
          occurred_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          base_amount?: number
          created_at?: string
          currency: string
          exchange_rate?: number
          goal_id: string
          id?: string
          note?: string | null
          occurred_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          base_amount?: number
          created_at?: string
          currency?: string
          exchange_rate?: number
          goal_id?: string
          id?: string
          note?: string | null
          occurred_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_contributions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "goal_contributions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_contributions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "card_cost_of_carry"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "goal_contributions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "card_status"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "goal_contributions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "loan_status"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "goal_contributions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "q_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_contributions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          base_currency: string
          created_at: string
          display_name: string | null
          id: string
          onboarded_at: string | null
          pay_anchor_day: number | null
          pay_cycle: Database["public"]["Enums"]["pay_cycle"]
          updated_at: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          display_name?: string | null
          id: string
          onboarded_at?: string | null
          pay_anchor_day?: number | null
          pay_cycle?: Database["public"]["Enums"]["pay_cycle"]
          updated_at?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          display_name?: string | null
          id?: string
          onboarded_at?: string | null
          pay_anchor_day?: number | null
          pay_cycle?: Database["public"]["Enums"]["pay_cycle"]
          updated_at?: string
        }
        Relationships: []
      }
      savings_goals: {
        Row: {
          archived_at: string | null
          color: string | null
          created_at: string
          emoji: string | null
          id: string
          name: string
          sort_order: number
          target_amount: number
          target_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          name: string
          sort_order?: number
          target_amount: number
          target_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          name?: string
          sort_order?: number
          target_amount?: number
          target_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      statement_imports: {
        Row: {
          card_group_id: string | null
          created_at: string
          error: string | null
          file_name: string
          file_path: string | null
          id: string
          parser_id: string
          status: string
          user_id: string
        }
        Insert: {
          card_group_id?: string | null
          created_at?: string
          error?: string | null
          file_name: string
          file_path?: string | null
          id?: string
          parser_id: string
          status?: string
          user_id: string
        }
        Update: {
          card_group_id?: string | null
          created_at?: string
          error?: string | null
          file_name?: string
          file_path?: string | null
          id?: string
          parser_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "statement_imports_card_group_id_fkey"
            columns: ["card_group_id"]
            isOneToOne: false
            referencedRelation: "card_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      statement_section_mappings: {
        Row: {
          account_id: string
          card_group_id: string
          created_at: string
          id: string
          parser_id: string
          section_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          card_group_id: string
          created_at?: string
          id?: string
          parser_id: string
          section_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          card_group_id?: string
          created_at?: string
          id?: string
          parser_id?: string
          section_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "statement_section_mappings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "statement_section_mappings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statement_section_mappings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "card_cost_of_carry"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "statement_section_mappings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "card_status"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "statement_section_mappings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "loan_status"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "statement_section_mappings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "q_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statement_section_mappings_card_group_id_fkey"
            columns: ["card_group_id"]
            isOneToOne: false
            referencedRelation: "card_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          account_id: string | null
          amount: number
          anchor_date: string | null
          anchor_day: number | null
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          category_id: string | null
          color: string | null
          created_at: string
          currency: string
          id: string
          include_commission: boolean
          include_tax: boolean
          is_active: boolean
          kind: Database["public"]["Enums"]["transaction_type"]
          logo_url: string | null
          name: string
          to_account_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount?: number
          anchor_date?: string | null
          anchor_day?: number | null
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          category_id?: string | null
          color?: string | null
          created_at?: string
          currency: string
          id?: string
          include_commission?: boolean
          include_tax?: boolean
          is_active?: boolean
          kind?: Database["public"]["Enums"]["transaction_type"]
          logo_url?: string | null
          name: string
          to_account_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          anchor_date?: string | null
          anchor_day?: number | null
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          category_id?: string | null
          color?: string | null
          created_at?: string
          currency?: string
          id?: string
          include_commission?: boolean
          include_tax?: boolean
          is_active?: boolean
          kind?: Database["public"]["Enums"]["transaction_type"]
          logo_url?: string | null
          name?: string
          to_account_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "card_cost_of_carry"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "card_status"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "loan_status"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "q_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "subscriptions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "card_cost_of_carry"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "subscriptions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "card_status"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "subscriptions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "loan_status"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "subscriptions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "q_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          base_amount: number
          base_total_amount: number
          budget_group_id: string | null
          category_id: string | null
          created_at: string
          currency: string
          description: string | null
          exchange_rate: number
          exclude_from_budget: boolean
          fee_amount: number
          fx_fallback: boolean
          id: string
          include_commission: boolean
          include_tax: boolean
          notes: string | null
          occurred_at: string
          statement_line_id: string | null
          subscription_id: string | null
          tax_amount: number
          to_account_id: string | null
          to_amount: number | null
          total_amount: number
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          base_amount?: number
          base_total_amount?: number
          budget_group_id?: string | null
          category_id?: string | null
          created_at?: string
          currency: string
          description?: string | null
          exchange_rate?: number
          exclude_from_budget?: boolean
          fee_amount?: number
          fx_fallback?: boolean
          id?: string
          include_commission?: boolean
          include_tax?: boolean
          notes?: string | null
          occurred_at?: string
          statement_line_id?: string | null
          subscription_id?: string | null
          tax_amount?: number
          to_account_id?: string | null
          to_amount?: number | null
          total_amount?: number
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          base_amount?: number
          base_total_amount?: number
          budget_group_id?: string | null
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          exchange_rate?: number
          exclude_from_budget?: boolean
          fee_amount?: number
          fx_fallback?: boolean
          id?: string
          include_commission?: boolean
          include_tax?: boolean
          notes?: string | null
          occurred_at?: string
          statement_line_id?: string | null
          subscription_id?: string | null
          tax_amount?: number
          to_account_id?: string | null
          to_amount?: number | null
          total_amount?: number
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "card_cost_of_carry"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "card_status"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "loan_status"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "q_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_budget_group_id_fkey"
            columns: ["budget_group_id"]
            isOneToOne: false
            referencedRelation: "budget_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_statement_line_id_fkey"
            columns: ["statement_line_id"]
            isOneToOne: false
            referencedRelation: "card_statement_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "card_cost_of_carry"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "card_status"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "loan_status"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "q_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      account_balances: {
        Row: {
          account_id: string | null
          balance: number | null
          base_movement: number | null
          currency: string | null
          starting_balance: number | null
          user_id: string | null
        }
        Relationships: []
      }
      card_cost_of_carry: {
        Row: {
          account_id: string | null
          avg_daily_balance: number | null
          cost_of_carry: number | null
          cost_of_carry_prior: number | null
          currency: string | null
          group_name: string | null
          interest_rate_annual: number | null
          name: string | null
          period_end: string | null
          user_id: string | null
        }
        Relationships: []
      }
      card_status: {
        Row: {
          account_id: string | null
          credit_limit: number | null
          currency: string | null
          latest_due_date: string | null
          latest_minimum_payment: number | null
          latest_period_end: string | null
          latest_statement_balance: number | null
          owed: number | null
          payment_due_day: number | null
          statement_closing_day: number | null
          user_id: string | null
          utilization_pct: number | null
        }
        Relationships: []
      }
      loan_status: {
        Row: {
          account_id: string | null
          currency: string | null
          installment_amount: number | null
          installments_paid: number | null
          original_term_months: number | null
          outstanding_balance: number | null
          payment_due_day: number | null
          principal: number | null
          progress_installments_paid: number | null
          progress_term_months: number | null
          term_months: number | null
          user_id: string | null
        }
        Relationships: []
      }
      monthly_cashflow: {
        Row: {
          expense: number | null
          income: number | null
          month: string | null
          net: number | null
          user_id: string | null
        }
        Relationships: []
      }
      q_accounts: {
        Row: {
          balance: number | null
          bank: string | null
          brand: string | null
          card_group: string | null
          credit_limit: number | null
          currency: string | null
          current_balance: number | null
          id: string | null
          installment_amount: number | null
          installments_paid: number | null
          interest_rate: number | null
          is_archived: boolean | null
          last4: string | null
          latest_due_date: string | null
          latest_period_end: string | null
          latest_statement_balance: number | null
          name: string | null
          original_term_months: number | null
          outstanding_balance: number | null
          owed: number | null
          payment_due_day: number | null
          principal: number | null
          start_date: string | null
          starting_balance: number | null
          statement_closing_day: number | null
          term_months: number | null
          type: Database["public"]["Enums"]["account_type"] | null
          user_id: string | null
          utilization_pct: number | null
        }
        Relationships: []
      }
      q_budget_groups: {
        Row: {
          budget: number | null
          budget_group: string | null
          budget_group_id: string | null
          month: string | null
          remaining: number | null
          used: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_group_budgets_budget_group_id_fkey"
            columns: ["budget_group_id"]
            isOneToOne: false
            referencedRelation: "budget_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      q_budgets: {
        Row: {
          budget: number | null
          category: string | null
          category_id: string | null
          month: string | null
          remaining: number | null
          used: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "category_budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      q_card_statements: {
        Row: {
          account: string | null
          account_id: string | null
          available_credit: number | null
          avg_daily_balance: number | null
          cashback_total: number | null
          cost_of_carry: number | null
          credit_limit: number | null
          due_date: string | null
          id: string | null
          interest_rate_annual: number | null
          minimum_payment: number | null
          overdue_amount: number | null
          period_end: string | null
          period_start: string | null
          previous_balance: number | null
          source: Database["public"]["Enums"]["statement_source"] | null
          statement_balance: number | null
          total_credits: number | null
          total_debits: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_statements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "card_statements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_statements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "card_cost_of_carry"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "card_statements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "card_status"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "card_statements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "loan_status"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "card_statements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "q_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      q_transactions: {
        Row: {
          account: string | null
          account_brand: string | null
          account_id: string | null
          account_last4: string | null
          account_type: Database["public"]["Enums"]["account_type"] | null
          amount: number | null
          bank: string | null
          base_amount: number | null
          base_currency: string | null
          base_total_amount: number | null
          budget_group: string | null
          budget_group_id: string | null
          budget_spend: number | null
          cash_in: number | null
          cash_out: number | null
          category: string | null
          category_id: string | null
          currency: string | null
          description: string | null
          exclude_from_budget: boolean | null
          fx_fallback: boolean | null
          id: string | null
          mcc: string | null
          notes: string | null
          occurred_at: string | null
          subscription: string | null
          subscription_id: string | null
          to_account: string | null
          to_account_id: string | null
          to_account_type: Database["public"]["Enums"]["account_type"] | null
          total_amount: number | null
          type: Database["public"]["Enums"]["transaction_type"] | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "card_cost_of_carry"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "card_status"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "loan_status"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "q_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "card_cost_of_carry"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "card_status"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "loan_status"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "q_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      ask_query: { Args: { p_sql: string }; Returns: Json }
      budget_group_usage_range: {
        Args: { p_end: string; p_start: string }
        Returns: {
          budget: number
          budget_group_id: string
          budget_monthly: number
          remaining: number
          status: Database["public"]["Enums"]["budget_status"]
          used: number
        }[]
      }
      cashflow_range: {
        Args: { p_end: string; p_start: string }
        Returns: {
          expense: number
          income: number
        }[]
      }
      category_rule_usage: {
        Args: never
        Returns: {
          matches: number
          rule_id: string
        }[]
      }
      category_usage: {
        Args: { p_month: string }
        Returns: {
          budget: number
          category_id: string
          remaining: number
          status: Database["public"]["Enums"]["budget_status"]
          used: number
        }[]
      }
      category_usage_range: {
        Args: { p_end: string; p_start: string }
        Returns: {
          budget: number
          budget_monthly: number
          category_id: string
          remaining: number
          status: Database["public"]["Enums"]["budget_status"]
          used: number
        }[]
      }
      delete_own_account: { Args: never; Returns: undefined }
      effective_budget_group: {
        Args: { p_category_group: string; p_transaction_group: string }
        Returns: string
      }
      import_card_statement: { Args: { p: Json }; Returns: string }
      recompute_card_balance: {
        Args: { p_account: string }
        Returns: undefined
      }
      seed_default_categories: { Args: { p_user: string }; Returns: undefined }
      spend_distribution: {
        Args: { p_month: string }
        Returns: {
          category_id: string
          total: number
        }[]
      }
      spend_distribution_range: {
        Args: { p_end: string; p_start: string }
        Returns: {
          category_id: string
          total: number
        }[]
      }
      spending_pace: {
        Args: { p_month: string }
        Returns: {
          day: number
          last_month: number
          this_month: number
        }[]
      }
      spending_pace_range: {
        Args: { p_end: string; p_start: string }
        Returns: {
          day_offset: number
          last_period: number
          this_period: number
        }[]
      }
      uncategorized_spend: { Args: { p_month: string }; Returns: number }
      uncategorized_spend_range: {
        Args: { p_end: string; p_start: string }
        Returns: number
      }
    }
    Enums: {
      account_type:
        | "checking"
        | "savings"
        | "cash"
        | "investment"
        | "asset"
        | "credit_card"
        | "loan"
      billing_cycle:
        | "weekly"
        | "biweekly"
        | "semimonthly"
        | "monthly"
        | "yearly"
        | "custom"
      budget_status: "within" | "approaching" | "over"
      pay_cycle: "monthly" | "semimonthly" | "weekly"
      statement_line_kind:
        | "purchase"
        | "fee"
        | "credit"
        | "payment"
        | "adjustment"
      statement_source: "manual" | "import"
      transaction_type: "expense" | "income" | "payment"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_type: [
        "checking",
        "savings",
        "cash",
        "investment",
        "asset",
        "credit_card",
        "loan",
      ],
      billing_cycle: [
        "weekly",
        "biweekly",
        "semimonthly",
        "monthly",
        "yearly",
        "custom",
      ],
      budget_status: ["within", "approaching", "over"],
      pay_cycle: ["monthly", "semimonthly", "weekly"],
      statement_line_kind: [
        "purchase",
        "fee",
        "credit",
        "payment",
        "adjustment",
      ],
      statement_source: ["manual", "import"],
      transaction_type: ["expense", "income", "payment"],
    },
  },
} as const
