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
          direction: string | null
          id: string
          lead_id: string | null
          occurred_at: string
          project_id: string | null
          summary: string
          type: string
        }
        ComputedFields: never
        Insert: {
          company_id: string
          created_by?: string | null
          direction?: string | null
          id?: string
          lead_id?: string | null
          occurred_at?: string
          project_id?: string | null
          summary?: string
          type: string
        }
        Update: {
          company_id?: string
          created_by?: string | null
          direction?: string | null
          id?: string
          lead_id?: string | null
          occurred_at?: string
          project_id?: string | null
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
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      change_orders: {
        Row: {
          approved_at: string | null
          company_id: string
          cost_change_cents: number
          created_at: string
          description: string
          id: string
          price_change_cents: number
          project_id: string
        }
        ComputedFields: never
        Insert: {
          approved_at?: string | null
          company_id: string
          cost_change_cents?: number
          created_at?: string
          description: string
          id?: string
          price_change_cents?: number
          project_id: string
        }
        Update: {
          approved_at?: string | null
          company_id?: string
          cost_change_cents?: number
          created_at?: string
          description?: string
          id?: string
          price_change_cents?: number
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          clerk_org_id: string | null
          created_at: string
          id: string
          name: string
          settings_json: NonNullable<Json>
          timezone: string
        }
        ComputedFields: never
        Insert: {
          clerk_org_id?: string | null
          created_at?: string
          id?: string
          name: string
          settings_json?: NonNullable<Json>
          timezone?: string
        }
        Update: {
          clerk_org_id?: string | null
          created_at?: string
          id?: string
          name?: string
          settings_json?: NonNullable<Json>
          timezone?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          address: string | null
          city: string | null
          company_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          zip: string | null
        }
        ComputedFields: never
        Insert: {
          address?: string | null
          city?: string | null
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
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
      cost_categories: {
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
            foreignKeyName: "cost_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      costs: {
        Row: {
          actual_amount_cents: number | null
          category_id: string
          company_id: string
          created_at: string
          description: string | null
          estimated_amount_cents: number
          id: string
          paid_on: string | null
          project_id: string
          receipt_url: string | null
          vendor: string | null
        }
        ComputedFields: never
        Insert: {
          actual_amount_cents?: number | null
          category_id: string
          company_id: string
          created_at?: string
          description?: string | null
          estimated_amount_cents?: number
          id?: string
          paid_on?: string | null
          project_id: string
          receipt_url?: string | null
          vendor?: string | null
        }
        Update: {
          actual_amount_cents?: number | null
          category_id?: string
          company_id?: string
          created_at?: string
          description?: string | null
          estimated_amount_cents?: number
          id?: string
          paid_on?: string | null
          project_id?: string
          receipt_url?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "costs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "cost_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
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
      follow_up_rules: {
        Row: {
          company_id: string
          description: string
          id: string
          offset_days: number
          offset_hours: number
          sequence: number
          stage_id: string
        }
        ComputedFields: never
        Insert: {
          company_id: string
          description?: string
          id?: string
          offset_days?: number
          offset_hours?: number
          sequence?: number
          stage_id: string
        }
        Update: {
          company_id?: string
          description?: string
          id?: string
          offset_days?: number
          offset_hours?: number
          sequence?: number
          stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_rules_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          budget_max_cents: number | null
          budget_min_cents: number | null
          company_id: string
          contact_id: string
          created_at: string
          desired_timeline: string | null
          id: string
          lost_note: string | null
          lost_reason_id: string | null
          next_follow_up_at: string | null
          notes: string | null
          owner_id: string | null
          scope: string | null
          source: string
          stage_entered_at: string
          stage_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          budget_max_cents?: number | null
          budget_min_cents?: number | null
          company_id: string
          contact_id: string
          created_at?: string
          desired_timeline?: string | null
          id?: string
          lost_note?: string | null
          lost_reason_id?: string | null
          next_follow_up_at?: string | null
          notes?: string | null
          owner_id?: string | null
          scope?: string | null
          source?: string
          stage_entered_at?: string
          stage_id: string
          updated_at?: string
        }
        Update: {
          budget_max_cents?: number | null
          budget_min_cents?: number | null
          company_id?: string
          contact_id?: string
          created_at?: string
          desired_timeline?: string | null
          id?: string
          lost_note?: string | null
          lost_reason_id?: string | null
          next_follow_up_at?: string | null
          notes?: string | null
          owner_id?: string | null
          scope?: string | null
          source?: string
          stage_entered_at?: string
          stage_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_lost_reason_id_fkey"
            columns: ["lost_reason_id"]
            isOneToOne: false
            referencedRelation: "lost_reasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
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
          assignee_id: string | null
          company_id: string
          id: string
          lead_id: string | null
          notes: string | null
          project_id: string | null
          scheduled_at: string
          status: string
          type: string
        }
        ComputedFields: never
        Insert: {
          assignee_id?: string | null
          company_id: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          project_id?: string | null
          scheduled_at: string
          status?: string
          type: string
        }
        Update: {
          assignee_id?: string | null
          company_id?: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          project_id?: string | null
          scheduled_at?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      milestone_definitions: {
        Row: {
          company_id: string
          id: string
          key: string
          label: string
          sort_order: number
        }
        ComputedFields: never
        Insert: {
          company_id: string
          id?: string
          key: string
          label: string
          sort_order?: number
        }
        Update: {
          company_id?: string
          id?: string
          key?: string
          label?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "milestone_definitions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          actual_date: string | null
          company_id: string
          id: string
          key: string
          name: string
          planned_date: string | null
          project_id: string
          sort_order: number
        }
        ComputedFields: never
        Insert: {
          actual_date?: string | null
          company_id: string
          id?: string
          key: string
          name: string
          planned_date?: string | null
          project_id: string
          sort_order?: number
        }
        Update: {
          actual_date?: string | null
          company_id?: string
          id?: string
          key?: string
          name?: string
          planned_date?: string | null
          project_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "milestones_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_template_items: {
        Row: {
          amount_cents: number | null
          company_id: string
          due_trigger: string | null
          id: string
          kind: string
          label: string
          percent_bps: number | null
          sort_order: number
          template_id: string
        }
        ComputedFields: never
        Insert: {
          amount_cents?: number | null
          company_id: string
          due_trigger?: string | null
          id?: string
          kind: string
          label: string
          percent_bps?: number | null
          sort_order?: number
          template_id: string
        }
        Update: {
          amount_cents?: number | null
          company_id?: string
          due_trigger?: string | null
          id?: string
          kind?: string
          label?: string
          percent_bps?: number | null
          sort_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_template_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "payment_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_templates: {
        Row: {
          active: boolean
          company_id: string
          id: string
          name: string
          sort_order: number
        }
        ComputedFields: never
        Insert: {
          active?: boolean
          company_id: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          company_id?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          check_number: string | null
          company_id: string
          created_at: string
          due_date: string | null
          due_trigger: string | null
          id: string
          label: string
          method: string | null
          project_id: string
          received_on: string | null
          sort_order: number
          status: string
        }
        ComputedFields: never
        Insert: {
          amount_cents: number
          check_number?: string | null
          company_id: string
          created_at?: string
          due_date?: string | null
          due_trigger?: string | null
          id?: string
          label: string
          method?: string | null
          project_id: string
          received_on?: string | null
          sort_order?: number
          status?: string
        }
        Update: {
          amount_cents?: number
          check_number?: string | null
          company_id?: string
          created_at?: string
          due_date?: string | null
          due_trigger?: string | null
          id?: string
          label?: string
          method?: string | null
          project_id?: string
          received_on?: string | null
          sort_order?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
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
      pipeline_stages: {
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
            foreignKeyName: "pipeline_stages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          company_id: string
          project_id: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          company_id: string
          project_id: string
          user_id: string
        }
        Update: {
          company_id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          company_id: string
          contact_id: string
          contract_value_cents: number
          created_at: string
          id: string
          lead_id: string | null
          locked_cost_cents: number | null
          locked_margin_bps: number | null
          locked_revenue_cents: number | null
          name: string
          payment_template_id: string | null
          project_manager_id: string | null
          status: string
        }
        ComputedFields: never
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          company_id: string
          contact_id: string
          contract_value_cents: number
          created_at?: string
          id?: string
          lead_id?: string | null
          locked_cost_cents?: number | null
          locked_margin_bps?: number | null
          locked_revenue_cents?: number | null
          name: string
          payment_template_id?: string | null
          project_manager_id?: string | null
          status?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string
          contact_id?: string
          contract_value_cents?: number
          created_at?: string
          id?: string
          lead_id?: string | null
          locked_cost_cents?: number | null
          locked_margin_bps?: number | null
          locked_revenue_cents?: number | null
          name?: string
          payment_template_id?: string | null
          project_manager_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "projects_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_payment_template_id_fkey"
            columns: ["payment_template_id"]
            isOneToOne: false
            referencedRelation: "payment_templates"
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
      quotes: {
        Row: {
          approved_at: string | null
          company_id: string
          file_url: string | null
          id: string
          lead_id: string
          line_items_json: NonNullable<Json>
          sent_at: string | null
          subtotal_cents: number
          tax_cents: number
          total_cents: number
          version: number
        }
        ComputedFields: never
        Insert: {
          approved_at?: string | null
          company_id: string
          file_url?: string | null
          id?: string
          lead_id: string
          line_items_json?: NonNullable<Json>
          sent_at?: string | null
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          version?: number
        }
        Update: {
          approved_at?: string | null
          company_id?: string
          file_url?: string | null
          id?: string
          lead_id?: string
          line_items_json?: NonNullable<Json>
          sent_at?: string | null
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      task_template_items: {
        Row: {
          company_id: string
          id: string
          kind: string
          milestone_key: string | null
          sort_order: number
          template_id: string
          title: string
        }
        ComputedFields: never
        Insert: {
          company_id: string
          id?: string
          kind?: string
          milestone_key?: string | null
          sort_order?: number
          template_id: string
          title: string
        }
        Update: {
          company_id?: string
          id?: string
          kind?: string
          milestone_key?: string | null
          sort_order?: number
          template_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_template_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          active: boolean
          company_id: string
          id: string
          is_default: boolean
          name: string
        }
        ComputedFields: never
        Insert: {
          active?: boolean
          company_id: string
          id?: string
          is_default?: boolean
          name: string
        }
        Update: {
          active?: boolean
          company_id?: string
          id?: string
          is_default?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          company_id: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          kind: string
          milestone_id: string | null
          priority: string
          project_id: string
          sort_order: number
          status: string
          title: string
        }
        ComputedFields: never
        Insert: {
          assignee_id?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          kind?: string
          milestone_id?: string | null
          priority?: string
          project_id: string
          sort_order?: number
          status?: string
          title: string
        }
        Update: {
          assignee_id?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          kind?: string
          milestone_id?: string | null
          priority?: string
          project_id?: string
          sort_order?: number
          status?: string
          title?: string
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
            foreignKeyName: "tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
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
      users: {
        Row: {
          active: boolean
          clerk_id: string
          company_id: string
          created_at: string
          email: string | null
          id: string
          is_default_owner: boolean
          name: string
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
          name?: string
          phone?: string | null
          role?: string
        }
        Update: {
          active?: boolean
          clerk_id?: string
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_default_owner?: boolean
          name?: string
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
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_membership: {
        Args: {
          p_clerk_org_id: string
          p_clerk_user_id: string
          p_email: string
          p_name: string
          p_org_name: string
          p_role: string
        }
        Returns: string
      }
      close_project: { Args: { p_project_id: string }; Returns: undefined }
      convert_lead_to_project: {
        Args: {
          p_contract_value_cents: number
          p_deposit_check_number: string
          p_deposit_method: string
          p_deposit_received_on: string
          p_installments: Json
          p_lead_id: string
          p_name: string
          p_payment_template_id: string
          p_planned_start_date?: string
          p_project_manager_id?: string
          p_task_template_id: string
        }
        Returns: string
      }
      dearmor: { Args: { "": string }; Returns: string }
      gen_random_uuid: { Args: Record<PropertyKey, never>; Returns: string }
      gen_salt: { Args: { "": string }; Returns: string }
      move_project_to_milestone: {
        Args: { p_milestone_key: string; p_project_id: string }
        Returns: undefined
      }
      pgp_armor_headers: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      seed_company_defaults: { Args: { p_company: string }; Returns: undefined }
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
