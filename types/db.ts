export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      activities: {
        Row: {
          company_id: string
          created_by: string | null
          deal_id: string
          direction: string | null
          id: string
          occurred_at: string
          summary: string
          type: string
        }
        ComputedFields: never
        Insert: {
          company_id: string
          created_by?: string | null
          deal_id: string
          direction?: string | null
          id?: string
          occurred_at?: string
          summary?: string
          type: string
        }
        Update: {
          company_id?: string
          created_by?: string | null
          deal_id?: string
          direction?: string | null
          id?: string
          occurred_at?: string
          summary?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_commissions"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_jacket_checklist"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_warranty"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          company_id: string
          created_at: string
          id: number
          record_id: string | null
          table_name: string
        }
        ComputedFields: never
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          company_id: string
          created_at?: string
          id?: never
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          company_id?: string
          created_at?: string
          id?: never
          record_id?: string | null
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      business_expenses: {
        Row: {
          amount_cents: number
          category: string
          company_id: string
          created_at: string
          deal_id: string | null
          id: string
          note: string | null
          receipt_path: string | null
          spent_on: string
          vendor: string | null
        }
        ComputedFields: never
        Insert: {
          amount_cents: number
          category: string
          company_id: string
          created_at?: string
          deal_id?: string | null
          id?: string
          note?: string | null
          receipt_path?: string | null
          spent_on: string
          vendor?: string | null
        }
        Update: {
          amount_cents?: number
          category?: string
          company_id?: string
          created_at?: string
          deal_id?: string | null
          id?: string
          note?: string | null
          receipt_path?: string | null
          spent_on?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_expenses_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_commissions"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "business_expenses_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_jacket_checklist"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "business_expenses_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "business_expenses_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_warranty"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "business_expenses_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      business_holidays: {
        Row: {
          day: string
          name: string
        }
        ComputedFields: never
        Insert: {
          day: string
          name: string
        }
        Update: {
          day?: string
          name?: string
        }
        Relationships: []
      }
      catalog_categories: {
        Row: {
          company_id: string
          cost_category: string
          default_pick_phase_id: string | null
          default_section_id: string
          id: string
          name: string
          sort_order: number
        }
        ComputedFields: never
        Insert: {
          company_id: string
          cost_category: string
          default_pick_phase_id?: string | null
          default_section_id: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          company_id?: string
          cost_category?: string
          default_pick_phase_id?: string | null
          default_section_id?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "catalog_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_categories_default_pick_phase_id_fkey"
            columns: ["default_pick_phase_id"]
            isOneToOne: false
            referencedRelation: "pick_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_categories_default_section_id_fkey"
            columns: ["default_section_id"]
            isOneToOne: false
            referencedRelation: "quote_section_totals"
            referencedColumns: ["section_id"]
          },
          {
            foreignKeyName: "catalog_categories_default_section_id_fkey"
            columns: ["default_section_id"]
            isOneToOne: false
            referencedRelation: "quote_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_collections: {
        Row: {
          active: boolean
          colors: string[]
          company_id: string
          id: string
          name: string
          price_list_id: string | null
          sort_order: number
        }
        ComputedFields: never
        Insert: {
          active?: boolean
          colors?: string[]
          company_id: string
          id?: string
          name: string
          price_list_id?: string | null
          sort_order?: number
        }
        Update: {
          active?: boolean
          colors?: string[]
          company_id?: string
          id?: string
          name?: string
          price_list_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "catalog_collections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_collections_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_items: {
        Row: {
          active: boolean
          category_id: string
          code: string
          collection_id: string | null
          company_id: string
          cost_category: string | null
          cost_updated_at: string
          created_at: string
          id: string
          is_allowance: boolean
          list_price_cents: number | null
          name: string
          notes: string | null
          price_source: string
          pricing_mode: string
          qty_source: string | null
          section_id: string | null
          source_checked_on: string | null
          source_url: string | null
          taxable: boolean
          unit: string
          unit_cost_cents: number
          unit_price_cents: number | null
          updated_at: string
          uses_labor_rate: boolean
          vendor: string | null
        }
        ComputedFields: never
        Insert: {
          active?: boolean
          category_id: string
          code?: string
          collection_id?: string | null
          company_id: string
          cost_category?: string | null
          cost_updated_at?: string
          created_at?: string
          id?: string
          is_allowance?: boolean
          list_price_cents?: number | null
          name: string
          notes?: string | null
          price_source?: string
          pricing_mode?: string
          qty_source?: string | null
          section_id?: string | null
          source_checked_on?: string | null
          source_url?: string | null
          taxable?: boolean
          unit?: string
          unit_cost_cents?: number
          unit_price_cents?: number | null
          updated_at?: string
          uses_labor_rate?: boolean
          vendor?: string | null
        }
        Update: {
          active?: boolean
          category_id?: string
          code?: string
          collection_id?: string | null
          company_id?: string
          cost_category?: string | null
          cost_updated_at?: string
          created_at?: string
          id?: string
          is_allowance?: boolean
          list_price_cents?: number | null
          name?: string
          notes?: string | null
          price_source?: string
          pricing_mode?: string
          qty_source?: string | null
          section_id?: string | null
          source_checked_on?: string | null
          source_url?: string | null
          taxable?: boolean
          unit?: string
          unit_cost_cents?: number
          unit_price_cents?: number | null
          updated_at?: string
          uses_labor_rate?: boolean
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "catalog_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "catalog_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "quote_section_totals"
            referencedColumns: ["section_id"]
          },
          {
            foreignKeyName: "catalog_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "quote_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      change_orders: {
        Row: {
          approved_at: string | null
          client_signed_at: string | null
          cost_change: number
          description: string | null
          doc_number: string | null
          id: string
          price_change: number
          project_id: string
          schedule_days: number
          signed_file_id: string | null
        }
        ComputedFields: never
        Insert: {
          approved_at?: string | null
          client_signed_at?: string | null
          cost_change?: number
          description?: string | null
          doc_number?: string | null
          id?: string
          price_change?: number
          project_id: string
          schedule_days?: number
          signed_file_id?: string | null
        }
        Update: {
          approved_at?: string | null
          client_signed_at?: string | null
          cost_change?: number
          description?: string | null
          doc_number?: string | null
          id?: string
          price_change?: number
          project_id?: string
          schedule_days?: number
          signed_file_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "change_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "change_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "deal_warranty"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "change_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_signed_file_id_fkey"
            columns: ["signed_file_id"]
            isOneToOne: false
            referencedRelation: "deal_files"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_payments: {
        Row: {
          amount_cents: number
          company_id: string
          created_at: string
          deal_id: string
          id: string
          method: string | null
          note: string | null
          paid_on: string
          reference: string | null
        }
        ComputedFields: never
        Insert: {
          amount_cents: number
          company_id: string
          created_at?: string
          deal_id: string
          id?: string
          method?: string | null
          note?: string | null
          paid_on: string
          reference?: string | null
        }
        Update: {
          amount_cents?: number
          company_id?: string
          created_at?: string
          deal_id?: string
          id?: string
          method?: string | null
          note?: string | null
          paid_on?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_payments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_commissions"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "commission_payments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_jacket_checklist"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "commission_payments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "commission_payments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_warranty"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "commission_payments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_plans: {
        Row: {
          active: boolean
          basis: string
          company_id: string
          created_at: string
          first_payout_pct: number
          id: string
          min_cents: number
          name: string
          partner_id: string
          rate: number
        }
        ComputedFields: never
        Insert: {
          active?: boolean
          basis?: string
          company_id: string
          created_at?: string
          first_payout_pct?: number
          id?: string
          min_cents?: number
          name: string
          partner_id: string
          rate: number
        }
        Update: {
          active?: boolean
          basis?: string
          company_id?: string
          created_at?: string
          first_payout_pct?: number
          id?: string
          min_cents?: number
          name?: string
          partner_id?: string
          rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "commission_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_plans_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          clerk_org_id: string | null
          created_at: string
          deal_number_start: number
          id: string
          name: string
          settings_json: NonNullable<Json>
          timezone: string
        }
        ComputedFields: never
        Insert: {
          clerk_org_id?: string | null
          created_at?: string
          deal_number_start?: number
          id?: string
          name: string
          settings_json?: NonNullable<Json>
          timezone?: string
        }
        Update: {
          clerk_org_id?: string | null
          created_at?: string
          deal_number_start?: number
          id?: string
          name?: string
          settings_json?: NonNullable<Json>
          timezone?: string
        }
        Relationships: []
      }
      comparison_adjustments: {
        Row: {
          amount_cents: number
          checked_on: string | null
          company_id: string
          id: string
          label: string
          quote_id: string | null
          sort_order: number
          source_id: string
          url: string | null
          verified: boolean
        }
        ComputedFields: never
        Insert: {
          amount_cents: number
          checked_on?: string | null
          company_id: string
          id?: string
          label: string
          quote_id?: string | null
          sort_order?: number
          source_id: string
          url?: string | null
          verified?: boolean
        }
        Update: {
          amount_cents?: number
          checked_on?: string | null
          company_id?: string
          id?: string
          label?: string
          quote_id?: string | null
          sort_order?: number
          source_id?: string
          url?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "comparison_adjustments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparison_adjustments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["approved_quote_id"]
          },
          {
            foreignKeyName: "comparison_adjustments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote_section_totals"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "comparison_adjustments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote_totals"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "comparison_adjustments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparison_adjustments_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "comparison_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparison_adjustments_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "quote_comparison_lines"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "comparison_adjustments_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "quote_comparison_totals"
            referencedColumns: ["source_id"]
          },
        ]
      }
      comparison_prices: {
        Row: {
          catalog_item_id: string | null
          checked_on: string
          company_id: string
          id: string
          is_substitute: boolean
          match_code: string | null
          notes: string | null
          pack_price_cents: number
          pack_qty: number
          product_name: string
          sku: string | null
          source_id: string
          url: string | null
          verified: boolean
        }
        ComputedFields: never
        Insert: {
          catalog_item_id?: string | null
          checked_on: string
          company_id: string
          id?: string
          is_substitute?: boolean
          match_code?: string | null
          notes?: string | null
          pack_price_cents: number
          pack_qty?: number
          product_name: string
          sku?: string | null
          source_id: string
          url?: string | null
          verified?: boolean
        }
        Update: {
          catalog_item_id?: string | null
          checked_on?: string
          company_id?: string
          id?: string
          is_substitute?: boolean
          match_code?: string | null
          notes?: string | null
          pack_price_cents?: number
          pack_qty?: number
          product_name?: string
          sku?: string | null
          source_id?: string
          url?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "comparison_prices_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparison_prices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparison_prices_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "comparison_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparison_prices_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "quote_comparison_lines"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "comparison_prices_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "quote_comparison_totals"
            referencedColumns: ["source_id"]
          },
        ]
      }
      comparison_sources: {
        Row: {
          active: boolean
          company_id: string
          disclaimer: string
          id: string
          name: string
        }
        ComputedFields: never
        Insert: {
          active?: boolean
          company_id: string
          disclaimer: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          company_id?: string
          disclaimer?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "comparison_sources_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          city: string | null
          company_id: string | null
          created_at: string
          email: string | null
          id: string
          name: string | null
          notes: string | null
          phone: string | null
          zip: string | null
        }
        ComputedFields: never
        Insert: {
          address?: string | null
          city?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      costs: {
        Row: {
          actual_amount: number | null
          category: string
          estimated_amount: number | null
          id: string
          paid_at: string | null
          project_id: string
          receipt_url: string | null
          vendor: string | null
        }
        ComputedFields: never
        Insert: {
          actual_amount?: number | null
          category: string
          estimated_amount?: number | null
          id?: string
          paid_at?: string | null
          project_id: string
          receipt_url?: string | null
          vendor?: string | null
        }
        Update: {
          actual_amount?: number | null
          category?: string
          estimated_amount?: number | null
          id?: string
          paid_at?: string | null
          project_id?: string
          receipt_url?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "costs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "costs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "deal_warranty"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "costs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_doc_counters: {
        Row: {
          deal_id: string
          kind: string
          last_n: number
        }
        ComputedFields: never
        Insert: {
          deal_id: string
          kind: string
          last_n: number
        }
        Update: {
          deal_id?: string
          kind?: string
          last_n?: number
        }
        Relationships: [
          {
            foreignKeyName: "deal_doc_counters_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_commissions"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "deal_doc_counters_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_jacket_checklist"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "deal_doc_counters_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "deal_doc_counters_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_warranty"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "deal_doc_counters_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_files: {
        Row: {
          company_id: string
          created_at: string
          crew_visible: boolean | null
          deal_id: string
          deleted_at: string | null
          deleted_by: string | null
          folder: string
          height: number | null
          id: string
          mime_type: string
          photo_tag: string | null
          quote_id: string | null
          requirement_id: string | null
          site_visit_id: string | null
          size_bytes: number
          storage_path: string
          taken_at: string | null
          title: string | null
          uploaded_by: string | null
          width: number | null
        }
        ComputedFields: never
        Insert: {
          company_id: string
          created_at?: string
          crew_visible?: boolean | null
          deal_id: string
          deleted_at?: string | null
          deleted_by?: string | null
          folder: string
          height?: number | null
          id?: string
          mime_type: string
          photo_tag?: string | null
          quote_id?: string | null
          requirement_id?: string | null
          site_visit_id?: string | null
          size_bytes: number
          storage_path: string
          taken_at?: string | null
          title?: string | null
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          crew_visible?: boolean | null
          deal_id?: string
          deleted_at?: string | null
          deleted_by?: string | null
          folder?: string
          height?: number | null
          id?: string
          mime_type?: string
          photo_tag?: string | null
          quote_id?: string | null
          requirement_id?: string | null
          site_visit_id?: string | null
          size_bytes?: number
          storage_path?: string
          taken_at?: string | null
          title?: string | null
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_files_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_files_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_commissions"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "deal_files_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_jacket_checklist"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "deal_files_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "deal_files_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_warranty"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "deal_files_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_files_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_files_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["approved_quote_id"]
          },
          {
            foreignKeyName: "deal_files_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote_section_totals"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "deal_files_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote_totals"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "deal_files_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_files_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "deal_jacket_checklist"
            referencedColumns: ["requirement_id"]
          },
          {
            foreignKeyName: "deal_files_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "document_requirements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_files_site_visit_id_fkey"
            columns: ["site_visit_id"]
            isOneToOne: false
            referencedRelation: "site_visits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_number_counters: {
        Row: {
          company_id: string
          deal_year: number
          last_seq: number
        }
        ComputedFields: never
        Insert: {
          company_id: string
          deal_year: number
          last_seq: number
        }
        Update: {
          company_id?: string
          deal_year?: number
          last_seq?: number
        }
        Relationships: [
          {
            foreignKeyName: "deal_number_counters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_intake: {
        Row: {
          answers: Json
          ballpark_high_cents: number | null
          ballpark_low_cents: number | null
          company_id: string
          created_at: string
          deal_id: string
          summary: string
        }
        ComputedFields: never
        Insert: {
          answers?: Json
          ballpark_high_cents?: number | null
          ballpark_low_cents?: number | null
          company_id: string
          created_at?: string
          deal_id: string
          summary?: string
        }
        Update: {
          answers?: Json
          ballpark_high_cents?: number | null
          ballpark_low_cents?: number | null
          company_id?: string
          created_at?: string
          deal_id?: string
          summary?: string
        }
        Relationships: []
      }
      deals: {
        Row: {
          origin: string
          booking_token: string
          budget_max_cents: number | null
          budget_min_cents: number | null
          cancel_deadline: string | null
          cancellation_waived: boolean
          cancelled_at: string | null
          change_orders_cents: number
          commission_plan_id: string | null
          company_id: string
          contact_id: string | null
          contract_signed_at: string | null
          created_at: string | null
          deal_number: string | null
          deal_seq: number | null
          deal_year: number | null
          decision_maker: string | null
          deleted_at: string | null
          deposit_received_at: string | null
          estimated_value_cents: number | null
          financing_fee_rate: number | null
          financing_lender: string | null
          first_response_at: string | null
          handed_off_at: string | null
          id: string
          job_completed_at: string | null
          job_status: string
          knowledge_level: number | null
          last_touch_at: string | null
          lost_reason: string | null
          next_follow_up_at: string | null
          notes: string | null
          opened_on: string | null
          owner_id: string | null
          owns_home: boolean | null
          paid_in_full_at: string | null
          partner_gross_profit_cents: number | null
          partner_id: string | null
          partner_note: string | null
          partner_updated_at: string | null
          permit_required: boolean
          scope: string | null
          sold_in_home: boolean
          sold_price_cents: number | null
          source: string | null
          stage: string
          stage_entered_at: string
          timeline: string | null
          title: string | null
          updated_at: string
          year_built: number | null
        }
        ComputedFields: never
        Insert: {
          origin?: string
          booking_token?: string
          budget_max_cents?: number | null
          budget_min_cents?: number | null
          cancel_deadline?: string | null
          cancellation_waived?: boolean
          cancelled_at?: string | null
          change_orders_cents?: number
          commission_plan_id?: string | null
          company_id: string
          contact_id?: string | null
          contract_signed_at?: string | null
          created_at?: string | null
          deal_number?: string | null
          deal_seq?: number | null
          deal_year?: number | null
          decision_maker?: string | null
          deleted_at?: string | null
          deposit_received_at?: string | null
          estimated_value_cents?: number | null
          financing_fee_rate?: number | null
          financing_lender?: string | null
          first_response_at?: string | null
          handed_off_at?: string | null
          id?: string
          job_completed_at?: string | null
          job_status?: string
          knowledge_level?: number | null
          last_touch_at?: string | null
          lost_reason?: string | null
          next_follow_up_at?: string | null
          notes?: string | null
          opened_on?: string | null
          owner_id?: string | null
          owns_home?: boolean | null
          paid_in_full_at?: string | null
          partner_gross_profit_cents?: number | null
          partner_id?: string | null
          partner_note?: string | null
          partner_updated_at?: string | null
          permit_required?: boolean
          scope?: string | null
          sold_in_home?: boolean
          sold_price_cents?: number | null
          source?: string | null
          stage?: string
          stage_entered_at?: string
          timeline?: string | null
          title?: string | null
          updated_at?: string
          year_built?: number | null
        }
        Update: {
          origin?: string
          booking_token?: string
          budget_max_cents?: number | null
          budget_min_cents?: number | null
          cancel_deadline?: string | null
          cancellation_waived?: boolean
          cancelled_at?: string | null
          change_orders_cents?: number
          commission_plan_id?: string | null
          company_id?: string
          contact_id?: string | null
          contract_signed_at?: string | null
          created_at?: string | null
          deal_number?: string | null
          deal_seq?: number | null
          deal_year?: number | null
          decision_maker?: string | null
          deleted_at?: string | null
          deposit_received_at?: string | null
          estimated_value_cents?: number | null
          financing_fee_rate?: number | null
          financing_lender?: string | null
          first_response_at?: string | null
          handed_off_at?: string | null
          id?: string
          job_completed_at?: string | null
          job_status?: string
          knowledge_level?: number | null
          last_touch_at?: string | null
          lost_reason?: string | null
          next_follow_up_at?: string | null
          notes?: string | null
          opened_on?: string | null
          owner_id?: string | null
          owns_home?: boolean | null
          paid_in_full_at?: string | null
          partner_gross_profit_cents?: number | null
          partner_id?: string | null
          partner_note?: string | null
          partner_updated_at?: string | null
          permit_required?: boolean
          scope?: string | null
          sold_in_home?: boolean
          sold_price_cents?: number | null
          source?: string | null
          stage?: string
          stage_entered_at?: string
          timeline?: string | null
          title?: string | null
          updated_at?: string
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_commission_plan_id_fkey"
            columns: ["commission_plan_id"]
            isOneToOne: false
            referencedRelation: "commission_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_commission_plan_id_fkey"
            columns: ["commission_plan_id"]
            isOneToOne: false
            referencedRelation: "deal_commissions"
            referencedColumns: ["plan_id"]
          },
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      document_requirements: {
        Row: {
          applies_when: string
          company_id: string
          folder: string
          gate: string
          id: string
          label: string
          required: boolean
          sort_order: number
        }
        ComputedFields: never
        Insert: {
          applies_when?: string
          company_id: string
          folder: string
          gate: string
          id?: string
          label: string
          required?: boolean
          sort_order?: number
        }
        Update: {
          applies_when?: string
          company_id?: string
          folder?: string
          gate?: string
          id?: string
          label?: string
          required?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_requirements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      estimating_settings: {
        Row: {
          ballpark_high_pct: number
          ballpark_low_pct: number
          ballpark_round_cents: number
          company_id: string
          contingency_rate: number
          cost_stale_days: number
          countertop_overage: number
          hardware_spares: number
          labor_rate_cents: number
          led_headroom: number
          target_margin: number
          tax_rate: number
          trim_stick_ft: number
          trim_waste: number
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          ballpark_high_pct?: number
          ballpark_low_pct?: number
          ballpark_round_cents?: number
          company_id: string
          contingency_rate?: number
          cost_stale_days?: number
          countertop_overage?: number
          hardware_spares?: number
          labor_rate_cents?: number
          led_headroom?: number
          target_margin?: number
          tax_rate?: number
          trim_stick_ft?: number
          trim_waste?: number
          updated_at?: string
        }
        Update: {
          ballpark_high_pct?: number
          ballpark_low_pct?: number
          ballpark_round_cents?: number
          company_id?: string
          contingency_rate?: number
          cost_stale_days?: number
          countertop_overage?: number
          hardware_spares?: number
          labor_rate_cents?: number
          led_headroom?: number
          target_margin?: number
          tax_rate?: number
          trim_stick_ft?: number
          trim_waste?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimating_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_rules: {
        Row: {
          company_id: string
          description: string
          id: string
          offset_days: number
          offset_hours: number
          sequence: number
          stage_key: string
        }
        ComputedFields: never
        Insert: {
          company_id: string
          description?: string
          id?: string
          offset_days?: number
          offset_hours?: number
          sequence?: number
          stage_key: string
        }
        Update: {
          company_id?: string
          description?: string
          id?: string
          offset_days?: number
          offset_hours?: number
          sequence?: number
          stage_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          company_id: string | null
          created_at: string
          deal_id: string | null
          id: number
          ip_hash: string
          kind: string
        }
        ComputedFields: never
        Insert: {
          company_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: never
          ip_hash: string
          kind: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: never
          ip_hash?: string
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_commissions"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "form_submissions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_jacket_checklist"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "form_submissions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "form_submissions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_warranty"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "form_submissions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      job_cost_categories: {
        Row: {
          active: boolean
          company_id: string
          id: string
          key: string
          label: string
          sort_order: number
        }
        ComputedFields: never
        Insert: {
          active?: boolean
          company_id: string
          id?: string
          key: string
          label: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          company_id?: string
          id?: string
          key?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      job_milestone_templates: {
        Row: {
          active: boolean
          company_id: string
          id: string
          key: string
          label: string
          plan_days: number
          sort_order: number
        }
        ComputedFields: never
        Insert: {
          active?: boolean
          company_id: string
          id?: string
          key: string
          label: string
          plan_days?: number
          sort_order?: number
        }
        Update: {
          active?: boolean
          company_id?: string
          id?: string
          key?: string
          label?: string
          plan_days?: number
          sort_order?: number
        }
        Relationships: []
      }
      job_milestones: {
        Row: {
          company_id: string
          done_on: string | null
          id: string
          key: string
          label: string
          planned_on: string | null
          project_id: string
          sort_order: number
        }
        ComputedFields: never
        Insert: {
          company_id: string
          done_on?: string | null
          id?: string
          key: string
          label: string
          planned_on?: string | null
          project_id: string
          sort_order?: number
        }
        Update: {
          company_id?: string
          done_on?: string | null
          id?: string
          key?: string
          label?: string
          planned_on?: string | null
          project_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_links: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          id: string
          label: string
          slug: string
          source: string
        }
        ComputedFields: never
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          id?: string
          label?: string
          slug: string
          source?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          id?: string
          label?: string
          slug?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      lost_reasons: {
        Row: {
          active: boolean
          company_id: string
          id: string
          key: string
          label: string
          sort_order: number
        }
        ComputedFields: never
        Insert: {
          active?: boolean
          company_id: string
          id?: string
          key: string
          label: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          company_id?: string
          id?: string
          key?: string
          label?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "lost_reasons_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          booked_via: string
          company_id: string
          created_at: string
          deal_id: string
          ends_at: string | null
          id: string
          kind: string
          notes: string | null
          starts_at: string
          status: string
        }
        ComputedFields: never
        Insert: {
          booked_via?: string
          company_id: string
          created_at?: string
          deal_id: string
          ends_at?: string | null
          id?: string
          kind?: string
          notes?: string | null
          starts_at: string
          status?: string
        }
        Update: {
          booked_via?: string
          company_id?: string
          created_at?: string
          deal_id?: string
          ends_at?: string | null
          id?: string
          kind?: string
          notes?: string | null
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_commissions"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "meetings_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_jacket_checklist"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "meetings_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "meetings_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_warranty"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "meetings_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      mileage_trips: {
        Row: {
          company_id: string
          created_at: string
          deal_id: string | null
          id: string
          miles: number
          purpose: string
          trip_on: string
        }
        ComputedFields: never
        Insert: {
          company_id: string
          created_at?: string
          deal_id?: string | null
          id?: string
          miles: number
          purpose: string
          trip_on: string
        }
        Update: {
          company_id?: string
          created_at?: string
          deal_id?: string | null
          id?: string
          miles?: number
          purpose?: string
          trip_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "mileage_trips_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mileage_trips_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_commissions"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "mileage_trips_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_jacket_checklist"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "mileage_trips_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "mileage_trips_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_warranty"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "mileage_trips_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          company_id: string
          created_at: string
          deal_id: string | null
          id: string
          kind: string
          pushed_at: string | null
          read_at: string | null
          title: string
          url: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          body?: string | null
          company_id: string
          created_at?: string
          deal_id?: string | null
          id?: string
          kind: string
          pushed_at?: string | null
          read_at?: string | null
          title: string
          url?: string
          user_id: string
        }
        Update: {
          body?: string | null
          company_id?: string
          created_at?: string
          deal_id?: string | null
          id?: string
          kind?: string
          pushed_at?: string | null
          read_at?: string | null
          title?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_commissions"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "notifications_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_jacket_checklist"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "notifications_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "notifications_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_warranty"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "notifications_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          company_id: string
          email: string
          id: string
          invited_at: string
          name: string | null
          partner_id: string
        }
        ComputedFields: never
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          company_id: string
          email: string
          id?: string
          invited_at?: string
          name?: string | null
          partner_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          company_id?: string
          email?: string
          id?: string
          invited_at?: string
          name?: string | null
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_invites_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          active: boolean
          address: string | null
          company_id: string
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          license_class: string | null
          license_number: string | null
          name: string
          phone: string | null
        }
        ComputedFields: never
        Insert: {
          active?: boolean
          address?: string | null
          company_id: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          license_class?: string | null
          license_number?: string | null
          name: string
          phone?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          company_id?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          license_class?: string | null
          license_number?: string | null
          name?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          check_number: string | null
          due_date: string | null
          id: string
          label: string | null
          method: string | null
          project_id: string
          receipt_number: string | null
          received_at: string | null
          status: string | null
        }
        ComputedFields: never
        Insert: {
          amount: number
          check_number?: string | null
          due_date?: string | null
          id?: string
          label?: string | null
          method?: string | null
          project_id: string
          receipt_number?: string | null
          received_at?: string | null
          status?: string | null
        }
        Update: {
          amount?: number
          check_number?: string | null
          due_date?: string | null
          id?: string
          label?: string | null
          method?: string | null
          project_id?: string
          receipt_number?: string | null
          received_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "deal_warranty"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      pick_phases: {
        Row: {
          company_id: string
          id: string
          name: string
          sort_order: number
        }
        ComputedFields: never
        Insert: {
          company_id: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          company_id?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "pick_phases_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          active: boolean
          company_id: string
          id: string
          key: string
          kind: string
          label: string
          sort_order: number
        }
        ComputedFields: never
        Insert: {
          active?: boolean
          company_id: string
          id?: string
          key: string
          kind?: string
          label: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          company_id?: string
          id?: string
          key?: string
          kind?: string
          label?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      price_lists: {
        Row: {
          company_id: string
          cost_multiplier: number
          created_at: string
          effective_date: string
          id: string
          name: string
          source_file: string | null
          vendor: string
        }
        ComputedFields: never
        Insert: {
          company_id: string
          cost_multiplier: number
          created_at?: string
          effective_date?: string
          id?: string
          name: string
          source_file?: string | null
          vendor: string
        }
        Update: {
          company_id?: string
          cost_multiplier?: number
          created_at?: string
          effective_date?: string
          id?: string
          name?: string
          source_file?: string | null
          vendor?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_lists_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      project_materials: {
        Row: {
          code: string
          company_id: string
          created_at: string
          id: string
          name: string
          note: string | null
          order_status: string
          ordered_at: string | null
          packed: boolean
          packed_at: string | null
          packed_by: string | null
          pick_phase_id: string | null
          project_id: string
          qty: number
          received_at: string | null
          sort_order: number
          source_line_item_id: string | null
          source_quote_id: string | null
          unit: string
          updated_at: string
          vendor: string | null
        }
        ComputedFields: never
        Insert: {
          code?: string
          company_id: string
          created_at?: string
          id?: string
          name: string
          note?: string | null
          order_status?: string
          ordered_at?: string | null
          packed?: boolean
          packed_at?: string | null
          packed_by?: string | null
          pick_phase_id?: string | null
          project_id: string
          qty: number
          received_at?: string | null
          sort_order?: number
          source_line_item_id?: string | null
          source_quote_id?: string | null
          unit?: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          note?: string | null
          order_status?: string
          ordered_at?: string | null
          packed?: boolean
          packed_at?: string | null
          packed_by?: string | null
          pick_phase_id?: string | null
          project_id?: string
          qty?: number
          received_at?: string | null
          sort_order?: number
          source_line_item_id?: string | null
          source_quote_id?: string | null
          unit?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_materials_packed_by_fkey"
            columns: ["packed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_materials_pick_phase_id_fkey"
            columns: ["pick_phase_id"]
            isOneToOne: false
            referencedRelation: "pick_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_materials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_materials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "deal_warranty"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_materials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_materials_source_line_item_id_fkey"
            columns: ["source_line_item_id"]
            isOneToOne: false
            referencedRelation: "quote_comparison_lines"
            referencedColumns: ["line_id"]
          },
          {
            foreignKeyName: "project_materials_source_line_item_id_fkey"
            columns: ["source_line_item_id"]
            isOneToOne: false
            referencedRelation: "quote_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_materials_source_line_item_id_fkey"
            columns: ["source_line_item_id"]
            isOneToOne: false
            referencedRelation: "quote_line_items_priced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_materials_source_quote_id_fkey"
            columns: ["source_quote_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["approved_quote_id"]
          },
          {
            foreignKeyName: "project_materials_source_quote_id_fkey"
            columns: ["source_quote_id"]
            isOneToOne: false
            referencedRelation: "quote_section_totals"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "project_materials_source_quote_id_fkey"
            columns: ["source_quote_id"]
            isOneToOne: false
            referencedRelation: "quote_totals"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "project_materials_source_quote_id_fkey"
            columns: ["source_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          closed_at: string | null
          company_id: string
          contact_id: string | null
          contract_value: number | null
          created_at: string
          deal_id: string | null
          id: string
          name: string | null
          order_date: string | null
          project_manager_id: string | null
          start_date: string | null
          status: string | null
          substantial_completion_on: string | null
          warranty_months: number
        }
        ComputedFields: never
        Insert: {
          closed_at?: string | null
          company_id: string
          contact_id?: string | null
          contract_value?: number | null
          created_at?: string
          deal_id?: string | null
          id?: string
          name?: string | null
          order_date?: string | null
          project_manager_id?: string | null
          start_date?: string | null
          status?: string | null
          substantial_completion_on?: string | null
          warranty_months?: number
        }
        Update: {
          closed_at?: string | null
          company_id?: string
          contact_id?: string | null
          contract_value?: number | null
          created_at?: string
          deal_id?: string | null
          id?: string
          name?: string | null
          order_date?: string | null
          project_manager_id?: string | null
          start_date?: string | null
          status?: string | null
          substantial_completion_on?: string | null
          warranty_months?: number
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_commissions"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "projects_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_jacket_checklist"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "projects_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "projects_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_warranty"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "projects_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_project_manager_id_fkey"
            columns: ["project_manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          company_id: string
          created_at: string
          endpoint: string
          id: string
          keys: NonNullable<Json>
          user_agent: string | null
          user_id: string
        }
        ComputedFields: never
        Insert: {
          company_id: string
          created_at?: string
          endpoint: string
          id?: string
          keys: NonNullable<Json>
          user_agent?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          endpoint?: string
          id?: string
          keys?: NonNullable<Json>
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_line_items: {
        Row: {
          catalog_item_id: string | null
          category_id: string | null
          code: string
          collection_id: string | null
          company_id: string
          cost_category: string
          created_at: string
          id: string
          is_allowance: boolean
          list_price_cents: number | null
          margin_override: number | null
          name: string
          note: string | null
          pick_phase_id: string | null
          pricing_mode: string
          qty: number
          qty_source: string | null
          quote_id: string
          section_id: string
          sort_order: number
          taxable: boolean
          unit: string
          unit_cost_cents: number
          unit_price_cents: number | null
          updated_at: string
          uses_labor_rate: boolean
          vendor: string | null
        }
        ComputedFields: never
        Insert: {
          catalog_item_id?: string | null
          category_id?: string | null
          code?: string
          collection_id?: string | null
          company_id: string
          cost_category?: string
          created_at?: string
          id?: string
          is_allowance?: boolean
          list_price_cents?: number | null
          margin_override?: number | null
          name: string
          note?: string | null
          pick_phase_id?: string | null
          pricing_mode?: string
          qty?: number
          qty_source?: string | null
          quote_id: string
          section_id: string
          sort_order?: number
          taxable?: boolean
          unit?: string
          unit_cost_cents?: number
          unit_price_cents?: number | null
          updated_at?: string
          uses_labor_rate?: boolean
          vendor?: string | null
        }
        Update: {
          catalog_item_id?: string | null
          category_id?: string | null
          code?: string
          collection_id?: string | null
          company_id?: string
          cost_category?: string
          created_at?: string
          id?: string
          is_allowance?: boolean
          list_price_cents?: number | null
          margin_override?: number | null
          name?: string
          note?: string | null
          pick_phase_id?: string | null
          pricing_mode?: string
          qty?: number
          qty_source?: string | null
          quote_id?: string
          section_id?: string
          sort_order?: number
          taxable?: boolean
          unit?: string
          unit_cost_cents?: number
          unit_price_cents?: number | null
          updated_at?: string
          uses_labor_rate?: boolean
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_line_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "catalog_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "catalog_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_items_pick_phase_id_fkey"
            columns: ["pick_phase_id"]
            isOneToOne: false
            referencedRelation: "pick_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["approved_quote_id"]
          },
          {
            foreignKeyName: "quote_line_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote_section_totals"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "quote_line_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote_totals"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "quote_line_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "quote_section_totals"
            referencedColumns: ["section_id"]
          },
          {
            foreignKeyName: "quote_line_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "quote_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_sections: {
        Row: {
          absorbs_project_costs: boolean
          active: boolean
          client_description: string | null
          company_id: string
          id: string
          name: string
          sort_order: number
        }
        ComputedFields: never
        Insert: {
          absorbs_project_costs?: boolean
          active?: boolean
          client_description?: string | null
          company_id: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          absorbs_project_costs?: boolean
          active?: boolean
          client_description?: string | null
          company_id?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_sections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_template_items: {
        Row: {
          catalog_item_id: string
          company_id: string
          id: string
          note: string | null
          qty: number
          sort_order: number
          template_id: string
        }
        ComputedFields: never
        Insert: {
          catalog_item_id: string
          company_id: string
          id?: string
          note?: string | null
          qty?: number
          sort_order?: number
          template_id: string
        }
        Update: {
          catalog_item_id?: string
          company_id?: string
          id?: string
          note?: string | null
          qty?: number
          sort_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_template_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_template_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "quote_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_templates: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          default_takeoff: NonNullable<Json>
          description: string | null
          id: string
          name: string
        }
        ComputedFields: never
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          default_takeoff?: NonNullable<Json>
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          default_takeoff?: NonNullable<Json>
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          approved_at: string | null
          approved_cost_cents: number | null
          approved_price_cents: number | null
          client_token: string
          collection_id: string | null
          company_id: string
          contingency_rate: number
          created_at: string
          created_by: string | null
          deal_id: string
          doc_number: string | null
          file_url: string | null
          id: string
          labor_rate_cents: number
          name: string | null
          sent_at: string | null
          site_visit_id: string | null
          status: string
          takeoff: NonNullable<Json>
          target_margin: number
          tax_rate: number
          template_id: string | null
          updated_at: string
          version: number
        }
        ComputedFields: never
        Insert: {
          approved_at?: string | null
          approved_cost_cents?: number | null
          approved_price_cents?: number | null
          client_token?: string
          collection_id?: string | null
          company_id: string
          contingency_rate: number
          created_at?: string
          created_by?: string | null
          deal_id: string
          doc_number?: string | null
          file_url?: string | null
          id?: string
          labor_rate_cents: number
          name?: string | null
          sent_at?: string | null
          site_visit_id?: string | null
          status?: string
          takeoff?: NonNullable<Json>
          target_margin: number
          tax_rate: number
          template_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_cost_cents?: number | null
          approved_price_cents?: number | null
          client_token?: string
          collection_id?: string | null
          company_id?: string
          contingency_rate?: number
          created_at?: string
          created_by?: string | null
          deal_id?: string
          doc_number?: string | null
          file_url?: string | null
          id?: string
          labor_rate_cents?: number
          name?: string | null
          sent_at?: string | null
          site_visit_id?: string | null
          status?: string
          takeoff?: NonNullable<Json>
          target_margin?: number
          tax_rate?: number
          template_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotes_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "catalog_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_commissions"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "quotes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_jacket_checklist"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "quotes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "quotes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_warranty"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "quotes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_site_visit_id_fkey"
            columns: ["site_visit_id"]
            isOneToOne: false
            referencedRelation: "site_visits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "quote_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      site_visits: {
        Row: {
          appliances: NonNullable<Json>
          ballpark_high_cents: number | null
          ballpark_low_cents: number | null
          ceiling_in: number | null
          checklist: NonNullable<Json>
          company_id: string | null
          created_at: string
          deal_id: string | null
          id: string
          notes: string | null
          status: string
          updated_at: string
          visited_at: string | null
          walls: NonNullable<Json>
        }
        ComputedFields: never
        Insert: {
          appliances?: NonNullable<Json>
          ballpark_high_cents?: number | null
          ballpark_low_cents?: number | null
          ceiling_in?: number | null
          checklist?: NonNullable<Json>
          company_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          visited_at?: string | null
          walls?: NonNullable<Json>
        }
        Update: {
          appliances?: NonNullable<Json>
          ballpark_high_cents?: number | null
          ballpark_low_cents?: number | null
          ceiling_in?: number | null
          checklist?: NonNullable<Json>
          company_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          visited_at?: string | null
          walls?: NonNullable<Json>
        }
        Relationships: [
          {
            foreignKeyName: "site_visits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visits_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_commissions"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "site_visits_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_jacket_checklist"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "site_visits_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "site_visits_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_warranty"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "site_visits_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontractors: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          email: string | null
          gl_coi_expires: string | null
          id: string
          license_class: string | null
          license_expires: string | null
          license_number: string | null
          name: string
          notes: string | null
          phone: string | null
          trade: string
          user_id: string | null
          w9_on_file: boolean
          wc_coi_expires: string | null
        }
        ComputedFields: never
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          email?: string | null
          gl_coi_expires?: string | null
          id?: string
          license_class?: string | null
          license_expires?: string | null
          license_number?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          trade: string
          user_id?: string | null
          w9_on_file?: boolean
          wc_coi_expires?: string | null
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          email?: string | null
          gl_coi_expires?: string | null
          id?: string
          license_class?: string | null
          license_expires?: string | null
          license_number?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          trade?: string
          user_id?: string | null
          w9_on_file?: boolean
          wc_coi_expires?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subcontractors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontractors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          created_at: string
          due_date: string | null
          id: string
          project_id: string | null
          status: string | null
          title: string | null
        }
        ComputedFields: never
        Insert: {
          assignee_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          project_id?: string | null
          status?: string | null
          title?: string | null
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          project_id?: string | null
          status?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "deal_warranty"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      text_sends: {
        Row: {
          company_id: string
          created_by: string | null
          deal_id: string
          id: string
          sent_at: string
          template_key: string
        }
        ComputedFields: never
        Insert: {
          company_id: string
          created_by?: string | null
          deal_id: string
          id?: string
          sent_at?: string
          template_key: string
        }
        Update: {
          company_id?: string
          created_by?: string | null
          deal_id?: string
          id?: string
          sent_at?: string
          template_key?: string
        }
        Relationships: []
      }
      text_templates: {
        Row: {
          active: boolean
          after_days: number | null
          body: string
          company_id: string
          created_at: string
          id: string
          key: string
          label: string
          sort_order: number
          stage_key: string | null
        }
        ComputedFields: never
        Insert: {
          active?: boolean
          after_days?: number | null
          body: string
          company_id: string
          created_at?: string
          id?: string
          key: string
          label: string
          sort_order?: number
          stage_key?: string | null
        }
        Update: {
          active?: boolean
          after_days?: number | null
          body?: string
          company_id?: string
          created_at?: string
          id?: string
          key?: string
          label?: string
          sort_order?: number
          stage_key?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          active: boolean
          clerk_id: string
          company_id: string
          created_at: string
          email: string | null
          id: string
          is_default_owner: boolean
          name: string | null
          partner_id: string | null
          phone: string | null
          role: string
        }
        ComputedFields: never
        Insert: {
          active?: boolean
          clerk_id: string
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_default_owner?: boolean
          name?: string | null
          partner_id?: string | null
          phone?: string | null
          role: string
        }
        Update: {
          active?: boolean
          clerk_id?: string
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_default_owner?: boolean
          name?: string | null
          partner_id?: string | null
          phone?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      deal_commissions: {
        Row: {
          basis: string | null
          basis_cents: number | null
          cancelled_at: string | null
          commission_cents: number | null
          commission_status: string | null
          company_id: string | null
          contract_total_cents: number | null
          deal_id: string | null
          deal_number: string | null
          deposit_received_at: string | null
          earned_cents: number | null
          expected_cents: number | null
          first_payout_pct: number | null
          handed_off_at: string | null
          job_status: string | null
          last_paid_on: string | null
          min_cents: number | null
          owed_cents: number | null
          paid_cents: number | null
          paid_in_full_at: string | null
          partner_id: string | null
          partner_name: string | null
          plan_id: string | null
          plan_name: string | null
          rate: number | null
        }
        ComputedFields: never
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_jacket_checklist: {
        Row: {
          deal_id: string | null
          deal_number: string | null
          file_count: number | null
          folder: string | null
          gate: string | null
          label: string | null
          required: boolean | null
          requirement_id: string | null
          satisfied: boolean | null
          sort_order: number | null
        }
        ComputedFields: never
        Relationships: []
      }
      deal_recap: {
        Row: {
          actual_cost_cents: number | null
          actual_margin: number | null
          actual_profit_cents: number | null
          approved_cost_cents: number | null
          approved_price_cents: number | null
          approved_quote_id: string | null
          balance_due_cents: number | null
          change_orders_cents: number | null
          change_orders_pending: number | null
          collected_cents: number | null
          contract_value_cents: number | null
          costs_without_actual: number | null
          deal_id: string | null
          deal_number: string | null
          deal_year: number | null
          estimated_cost_cents: number | null
          estimated_profit_cents: number | null
          overdue_cents: number | null
          project_id: string | null
          revenue_cents: number | null
          stage: string | null
        }
        ComputedFields: never
        Relationships: []
      }
      deal_warranty: {
        Row: {
          check_in_on: string | null
          deal_id: string | null
          deal_number: string | null
          project_id: string | null
          substantial_completion_on: string | null
          warranty_ends_on: string | null
        }
        ComputedFields: never
        Relationships: []
      }
      lead_source_stats: {
        Row: {
          answered_1_hour: number | null
          answered_5_min: number | null
          commission_expected_cents: number | null
          commission_paid_cents: number | null
          company_id: string | null
          contract_value_cents: number | null
          deal_year: number | null
          handed_off: number | null
          leads: number | null
          source: string | null
          win_rate: number | null
          won: number | null
        }
        ComputedFields: never
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_comparison_lines: {
        Row: {
          checked_on: string | null
          code: string | null
          is_substitute: boolean | null
          line_id: string | null
          name: string | null
          our_price_cents: number | null
          pack_price_cents: number | null
          pack_qty: number | null
          packs: number | null
          product_name: string | null
          qty: number | null
          quote_id: string | null
          retailer_cost_cents: number | null
          section_id: string | null
          sku: string | null
          sort_order: number | null
          source_id: string | null
          source_name: string | null
          unit: string | null
          url: string | null
          verified: boolean | null
        }
        ComputedFields: never
        Relationships: [
          {
            foreignKeyName: "quote_line_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["approved_quote_id"]
          },
          {
            foreignKeyName: "quote_line_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote_section_totals"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "quote_line_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote_totals"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "quote_line_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "quote_section_totals"
            referencedColumns: ["section_id"]
          },
          {
            foreignKeyName: "quote_line_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "quote_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_comparison_totals: {
        Row: {
          adjustments_cents: number | null
          adjustments_verified: boolean | null
          covered_lines: number | null
          oldest_price_date: string | null
          our_price_covered_cents: number | null
          our_total_price_cents: number | null
          quote_id: string | null
          retailer_materials_cents: number | null
          retailer_total_cents: number | null
          source_id: string | null
          source_name: string | null
          substitute_lines: number | null
          uncovered_lines: number | null
          unverified_lines: number | null
        }
        ComputedFields: never
        Relationships: [
          {
            foreignKeyName: "quote_line_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["approved_quote_id"]
          },
          {
            foreignKeyName: "quote_line_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote_section_totals"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "quote_line_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote_totals"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "quote_line_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_cost_rollup: {
        Row: {
          cost_category: string | null
          estimated_cost_cents: number | null
          quote_id: string | null
          vendor: string | null
        }
        ComputedFields: never
        Relationships: []
      }
      quote_line_items_priced: {
        Row: {
          catalog_item_id: string | null
          category_id: string | null
          code: string | null
          collection_id: string | null
          company_id: string | null
          cost_category: string | null
          created_at: string | null
          effective_margin: number | null
          effective_unit_cost_cents: number | null
          ext_cost_cents: number | null
          id: string | null
          is_allowance: boolean | null
          line_margin: number | null
          list_price_cents: number | null
          margin_override: number | null
          name: string | null
          note: string | null
          pick_phase_id: string | null
          price_cents: number | null
          pricing_mode: string | null
          qty: number | null
          qty_source: string | null
          quote_id: string | null
          section_id: string | null
          sort_order: number | null
          taxable: boolean | null
          unit: string | null
          unit_cost_cents: number | null
          unit_price_cents: number | null
          updated_at: string | null
          uses_labor_rate: boolean | null
          vendor: string | null
        }
        ComputedFields: never
        Relationships: [
          {
            foreignKeyName: "quote_line_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "catalog_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "catalog_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_items_pick_phase_id_fkey"
            columns: ["pick_phase_id"]
            isOneToOne: false
            referencedRelation: "pick_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["approved_quote_id"]
          },
          {
            foreignKeyName: "quote_line_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote_section_totals"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "quote_line_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote_totals"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "quote_line_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "quote_section_totals"
            referencedColumns: ["section_id"]
          },
          {
            foreignKeyName: "quote_line_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "quote_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_section_totals: {
        Row: {
          client_description: string | null
          line_count: number | null
          name: string | null
          price_cents: number | null
          quote_id: string | null
          section_id: string | null
          sort_order: number | null
        }
        ComputedFields: never
        Relationships: []
      }
      quote_totals: {
        Row: {
          company_id: string | null
          contingency_cost_cents: number | null
          contingency_price_cents: number | null
          deal_id: string | null
          direct_cost_cents: number | null
          gross_margin: number | null
          gross_profit_cents: number | null
          line_count: number | null
          lines_price_cents: number | null
          quote_id: string | null
          status: string | null
          target_margin: number | null
          tax_cost_cents: number | null
          tax_price_cents: number | null
          taxable_cost_cents: number | null
          total_cost_cents: number | null
          total_price_cents: number | null
          version: number | null
        }
        ComputedFields: never
        Relationships: [
          {
            foreignKeyName: "quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_commissions"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "quotes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_jacket_checklist"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "quotes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "quotes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_warranty"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "quotes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontractor_compliance: {
        Row: {
          company_id: string | null
          id: string | null
          name: string | null
          next_expiry: string | null
          status: string | null
          trade: string | null
        }
        ComputedFields: never
        Insert: {
          company_id?: string | null
          id?: string | null
          name?: string | null
          next_expiry?: never
          status?: never
          trade?: string | null
        }
        Update: {
          company_id?: string | null
          id?: string | null
          name?: string | null
          next_expiry?: never
          status?: never
          trade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subcontractors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _deal_doc_number: {
        Args: { p_deal_id: string; p_kind: string }
        Returns: string
      }
      accept_partner_invite: {
        Args: { p_clerk_user_id: string; p_email: string; p_name: string }
        Returns: string
      }
      approve_quote: {
        Args: { p_quote_id: string }
        Returns: {
          company_id: string | null
          contingency_cost_cents: number | null
          contingency_price_cents: number | null
          deal_id: string | null
          direct_cost_cents: number | null
          gross_margin: number | null
          gross_profit_cents: number | null
          line_count: number | null
          lines_price_cents: number | null
          quote_id: string | null
          status: string | null
          target_margin: number | null
          tax_cost_cents: number | null
          tax_price_cents: number | null
          taxable_cost_cents: number | null
          total_cost_cents: number | null
          total_price_cents: number | null
          version: number | null
        }
        SetofOptions: {
          from: "*"
          to: "quote_totals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      bootstrap_owner: {
        Args: {
          p_clerk_user_id: string
          p_company_name?: string
          p_email: string
          p_name: string
        }
        Returns: {
          company_id: string
          created: boolean
          user_id: string
        }[]
      }
      cancellation_deadline: {
        Args: { p_signed: string; p_tz?: string }
        Returns: string
      }
      create_quote_from_template: {
        Args: { p_deal_id: string; p_name?: string; p_template_id: string }
        Returns: string
      }
      current_app_role: { Args: Record<PropertyKey, never>; Returns: string }
      current_company_id: { Args: Record<PropertyKey, never>; Returns: string }
      current_partner_id: { Args: Record<PropertyKey, never>; Returns: string }
      current_user_id: { Args: Record<PropertyKey, never>; Returns: string }
      deal_gate_missing: {
        Args: { p_deal_id: string; p_gate: string }
        Returns: string[]
      }
      dearmor: { Args: { "": string }; Returns: string }
      duplicate_quote: {
        Args: { p_name?: string; p_quote_id: string }
        Returns: string
      }
      gen_random_uuid: { Args: Record<PropertyKey, never>; Returns: string }
      gen_salt: { Args: { "": string }; Returns: string }
      import_price_list: {
        Args: {
          p_collections: Json
          p_company_id: string
          p_cost_multiplier: number
          p_effective_date: string
          p_list_name: string
          p_source_file: string
          p_vendor: string
        }
        Returns: {
          collection: string
          items_deactivated: number
          items_upserted: number
        }[]
      }
      is_assigned_to_deal: { Args: { p_deal_id: string }; Returns: boolean }
      is_assigned_to_project: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      is_owner: { Args: Record<PropertyKey, never>; Returns: boolean }
      is_team: { Args: Record<PropertyKey, never>; Returns: boolean }
      materialize_quote_into_project: {
        Args: { p_project_id: string; p_quote_id: string }
        Returns: undefined
      }
      next_deal_doc_number: {
        Args: { p_deal_id: string; p_kind: string }
        Returns: string
      }
      next_deal_number: {
        Args: { p_at?: string; p_company_id: string }
        Returns: {
          deal_number: string
          deal_seq: number
          deal_year: number
          opened_on: string
        }[]
      }
      pgp_armor_headers: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      rep_year_summary:
        | {
            Args: { p_mileage_rate_cents?: number; p_year: number }
            Returns: {
              commissions_owed_cents: number
              commissions_paid_cents: number
              commissions_pipeline_cents: number
              expenses_cents: number
              mileage_deduction_cents: number
              miles: number
              net_cents: number
            }[]
          }
        | {
            Args: { p_rate_cents_per_mile: number; p_year: number }
            Returns: {
              commissions_owed_cents: number
              commissions_paid_cents: number
              commissions_pipeline_cents: number
              expenses_cents: number
              mileage_deduction_cents: number
              miles: number
              net_cents: number
            }[]
          }
      requirement_applies: {
        Args: {
          p_applies_when: string
          p_deal: Omit<
            Database["public"]["Tables"]["deals"]["Row"],
            Database["public"]["Tables"]["deals"]["ComputedFields"]
          >
        }
        Returns: boolean
      }
      seed_company_defaults: { Args: { p_company: string }; Returns: undefined }
      seed_default_compliance: {
        Args: { p_company_id: string }
        Returns: undefined
      }
      seed_default_deal_jacket: {
        Args: { p_company_id: string }
        Returns: undefined
      }
      seed_default_estimating: {
        Args: { p_company_id: string }
        Returns: undefined
      }
      seed_default_handoff: {
        Args: { p_company_id: string }
        Returns: undefined
      }
      seed_sales_defaults: { Args: { p_company: string }; Returns: undefined }
      seed_text_templates: { Args: { p_company: string }; Returns: undefined }
      seed_job_defaults: { Args: { p_company: string }; Returns: undefined }
      start_job: { Args: { p_deal: string }; Returns: string }
      set_quote_collection: {
        Args: { p_collection_id: string; p_quote_id: string }
        Returns: {
          code: string
          status: string
        }[]
      }
      share_quote: { Args: { p_quote_id: string }; Returns: string }
      swap_line_item: {
        Args: { p_catalog_item_id: string; p_line_id: string }
        Returns: undefined
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
