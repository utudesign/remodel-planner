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
          deal_id: string | null
          direction: string | null
          id: string
          occurred_at: string
          project_id: string | null
          summary: string
          type: string
        }
        ComputedFields: never
        Insert: {
          company_id: string
          created_by?: string | null
          deal_id?: string | null
          direction?: string | null
          id?: string
          occurred_at?: string
          project_id?: string | null
          summary?: string
          type: string
        }
        Update: {
          company_id?: string
          created_by?: string | null
          deal_id?: string | null
          direction?: string | null
          id?: string
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
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "crew_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["project_id"]
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
            referencedRelation: "crew_projects"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          body: string
          company_id: string
          created_at: string
          deal_id: string | null
          entity_id: string
          entity_type: string
          id: string
          mentions: string[]
          photo_paths: string[]
          project_id: string | null
        }
        ComputedFields: never
        Insert: {
          author_id: string
          body: string
          company_id: string
          created_at?: string
          deal_id?: string | null
          entity_id: string
          entity_type: string
          id?: string
          mentions?: string[]
          photo_paths?: string[]
          project_id?: string | null
        }
        Update: {
          author_id?: string
          body?: string
          company_id?: string
          created_at?: string
          deal_id?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          mentions?: string[]
          photo_paths?: string[]
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_jacket_checklist"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "comments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "comments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "crew_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "comments_project_id_fkey"
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
            referencedRelation: "crew_projects"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "projects"
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
          deal_date: string
          last_seq: number
        }
        ComputedFields: never
        Insert: {
          company_id: string
          deal_date: string
          last_seq: number
        }
        Update: {
          company_id?: string
          deal_date?: string
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
      deals: {
        Row: {
          budget_max_cents: number | null
          budget_min_cents: number | null
          company_id: string
          contact_id: string
          created_at: string
          deal_date: string
          deal_number: string
          deal_seq: number
          deal_year: number
          deleted_at: string | null
          desired_timeline: string | null
          first_response_at: string | null
          id: string
          lost_note: string | null
          lost_reason_id: string | null
          next_follow_up_at: string | null
          notes: string | null
          owner_id: string | null
          permit_required: boolean
          scope: string | null
          source: string
          stage_entered_at: string
          stage_id: string
          updated_at: string
          waiting_for_live: boolean
        }
        ComputedFields: never
        Insert: {
          budget_max_cents?: number | null
          budget_min_cents?: number | null
          company_id: string
          contact_id: string
          created_at?: string
          deal_date?: string
          deal_number?: string
          deal_seq?: number
          deal_year?: number
          deleted_at?: string | null
          desired_timeline?: string | null
          first_response_at?: string | null
          id?: string
          lost_note?: string | null
          lost_reason_id?: string | null
          next_follow_up_at?: string | null
          notes?: string | null
          owner_id?: string | null
          permit_required?: boolean
          scope?: string | null
          source?: string
          stage_entered_at?: string
          stage_id: string
          updated_at?: string
          waiting_for_live?: boolean
        }
        Update: {
          budget_max_cents?: number | null
          budget_min_cents?: number | null
          company_id?: string
          contact_id?: string
          created_at?: string
          deal_date?: string
          deal_number?: string
          deal_seq?: number
          deal_year?: number
          deleted_at?: string | null
          desired_timeline?: string | null
          first_response_at?: string | null
          id?: string
          lost_note?: string | null
          lost_reason_id?: string | null
          next_follow_up_at?: string | null
          notes?: string | null
          owner_id?: string | null
          permit_required?: boolean
          scope?: string | null
          source?: string
          stage_entered_at?: string
          stage_id?: string
          updated_at?: string
          waiting_for_live?: boolean
        }
        Relationships: [
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
            foreignKeyName: "deals_lost_reason_id_fkey"
            columns: ["lost_reason_id"]
            isOneToOne: false
            referencedRelation: "lost_reasons"
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
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      design_requests: {
        Row: {
          assignee_id: string | null
          company_id: string
          deal_id: string
          due_at: string | null
          id: string
          paused_at: string | null
          quote_id: string | null
          ready_at: string | null
          site_visit_id: string | null
          status: string
        }
        ComputedFields: never
        Insert: {
          assignee_id?: string | null
          company_id: string
          deal_id: string
          due_at?: string | null
          id?: string
          paused_at?: string | null
          quote_id?: string | null
          ready_at?: string | null
          site_visit_id?: string | null
          status?: string
        }
        Update: {
          assignee_id?: string | null
          company_id?: string
          deal_id?: string
          due_at?: string | null
          id?: string
          paused_at?: string | null
          quote_id?: string | null
          ready_at?: string | null
          site_visit_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_requests_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_requests_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_jacket_checklist"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "design_requests_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "design_requests_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_requests_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_requests_site_visit_id_fkey"
            columns: ["site_visit_id"]
            isOneToOne: false
            referencedRelation: "site_visits"
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
      events: {
        Row: {
          actor_id: string | null
          company_id: string
          created_at: string
          deal_id: string | null
          entity_id: string | null
          entity_type: string
          has_money: boolean
          id: string
          pinned_until: string | null
          project_id: string | null
          publish_at: string
          summary: string
          verb: string
        }
        ComputedFields: never
        Insert: {
          actor_id?: string | null
          company_id: string
          created_at?: string
          deal_id?: string | null
          entity_id?: string | null
          entity_type: string
          has_money?: boolean
          id?: string
          pinned_until?: string | null
          project_id?: string | null
          publish_at?: string
          summary: string
          verb: string
        }
        Update: {
          actor_id?: string | null
          company_id?: string
          created_at?: string
          deal_id?: string | null
          entity_id?: string | null
          entity_type?: string
          has_money?: boolean
          id?: string
          pinned_until?: string | null
          project_id?: string | null
          publish_at?: string
          summary?: string
          verb?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_jacket_checklist"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "events_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "events_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "crew_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "events_project_id_fkey"
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
      info_requests: {
        Row: {
          answered_at: string | null
          asked_by: string | null
          asked_of: string | null
          company_id: string
          created_at: string
          design_request_id: string
          id: string
          items: NonNullable<Json>
        }
        ComputedFields: never
        Insert: {
          answered_at?: string | null
          asked_by?: string | null
          asked_of?: string | null
          company_id: string
          created_at?: string
          design_request_id: string
          id?: string
          items?: NonNullable<Json>
        }
        Update: {
          answered_at?: string | null
          asked_by?: string | null
          asked_of?: string | null
          company_id?: string
          created_at?: string
          design_request_id?: string
          id?: string
          items?: NonNullable<Json>
        }
        Relationships: [
          {
            foreignKeyName: "info_requests_asked_by_fkey"
            columns: ["asked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "info_requests_asked_of_fkey"
            columns: ["asked_of"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "info_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "info_requests_design_request_id_fkey"
            columns: ["design_request_id"]
            isOneToOne: false
            referencedRelation: "design_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          company_id: string
          cost_impact_cents: number | null
          created_at: string
          description: string
          id: string
          photo_paths: string[]
          project_id: string
          reported_by: string | null
          schedule_impact_days: number | null
          status: string
          type: string
        }
        ComputedFields: never
        Insert: {
          company_id: string
          cost_impact_cents?: number | null
          created_at?: string
          description: string
          id?: string
          photo_paths?: string[]
          project_id: string
          reported_by?: string | null
          schedule_impact_days?: number | null
          status?: string
          type: string
        }
        Update: {
          company_id?: string
          cost_impact_cents?: number | null
          created_at?: string
          description?: string
          id?: string
          photo_paths?: string[]
          project_id?: string
          reported_by?: string | null
          schedule_impact_days?: number | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "crew_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "users"
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
          confirmed_at: string | null
          deal_id: string | null
          id: string
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
          confirmed_at?: string | null
          deal_id?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
          scheduled_at: string
          status?: string
          type: string
        }
        Update: {
          assignee_id?: string | null
          company_id?: string
          confirmed_at?: string | null
          deal_id?: string | null
          id?: string
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
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "crew_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["project_id"]
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
            referencedRelation: "crew_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["project_id"]
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
      notifications: {
        Row: {
          body: string
          comment_id: string | null
          company_id: string
          created_at: string
          event_id: string | null
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
          body?: string
          comment_id?: string | null
          company_id: string
          created_at?: string
          event_id?: string | null
          id?: string
          kind: string
          pushed_at?: string | null
          read_at?: string | null
          title: string
          url?: string
          user_id: string
        }
        Update: {
          body?: string
          comment_id?: string | null
          company_id?: string
          created_at?: string
          event_id?: string | null
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
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
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
            referencedRelation: "crew_projects"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "crew_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["project_id"]
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
          deal_id: string | null
          id: string
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
          deal_id?: string | null
          id?: string
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
          deal_id?: string | null
          id?: string
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
            foreignKeyName: "projects_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deal_jacket_checklist"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "projects_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deal_recap"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "projects_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
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
      quotes: {
        Row: {
          approved_at: string | null
          company_id: string
          deal_id: string
          file_url: string | null
          id: string
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
          deal_id: string
          file_url?: string | null
          id?: string
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
          deal_id?: string
          file_url?: string | null
          id?: string
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
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      record_views: {
        Row: {
          entity_id: string
          entity_type: string
          last_seen_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          entity_id: string
          entity_type: string
          last_seen_at?: string
          user_id: string
        }
        Update: {
          entity_id?: string
          entity_type?: string
          last_seen_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "record_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_messages: {
        Row: {
          body: string
          channel: string
          company_id: string
          created_at: string
          created_by: string | null
          deal_id: string | null
          id: string
          project_id: string | null
          reminded_at: string | null
          send_at: string
          sent_at: string | null
        }
        ComputedFields: never
        Insert: {
          body: string
          channel: string
          company_id: string
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          id?: string
          project_id?: string | null
          reminded_at?: string | null
          send_at: string
          sent_at?: string | null
        }
        Update: {
          body?: string
          channel?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          id?: string
          project_id?: string | null
          reminded_at?: string | null
          send_at?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_jacket_checklist"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "scheduled_messages_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "scheduled_messages_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "crew_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "deal_recap"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "scheduled_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_handoffs: {
        Row: {
          body: string
          checklist: NonNullable<Json>
          company_id: string
          id: string
          posted_at: string | null
          publish_at: string | null
          shift_date: string
          shift_kind: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          body?: string
          checklist?: NonNullable<Json>
          company_id: string
          id?: string
          posted_at?: string | null
          publish_at?: string | null
          shift_date: string
          shift_kind: string
          user_id: string
        }
        Update: {
          body?: string
          checklist?: NonNullable<Json>
          company_id?: string
          id?: string
          posted_at?: string | null
          publish_at?: string | null
          shift_date?: string
          shift_kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_handoffs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_handoffs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      site_visits: {
        Row: {
          appliances: NonNullable<Json>
          ballpark_high_cents: number | null
          ballpark_inputs: Json | null
          ballpark_low_cents: number | null
          checklist: NonNullable<Json>
          client: NonNullable<Json>
          company_id: string
          completeness: number
          deal_id: string
          id: string
          promised: string | null
          scope: NonNullable<Json>
          sketch_file_id: string | null
          status: string
          submitted_at: string | null
          visited_at: string | null
          visited_by: string[]
          walls: NonNullable<Json>
        }
        ComputedFields: never
        Insert: {
          appliances?: NonNullable<Json>
          ballpark_high_cents?: number | null
          ballpark_inputs?: Json | null
          ballpark_low_cents?: number | null
          checklist?: NonNullable<Json>
          client?: NonNullable<Json>
          company_id: string
          completeness?: number
          deal_id: string
          id?: string
          promised?: string | null
          scope?: NonNullable<Json>
          sketch_file_id?: string | null
          status?: string
          submitted_at?: string | null
          visited_at?: string | null
          visited_by?: string[]
          walls?: NonNullable<Json>
        }
        Update: {
          appliances?: NonNullable<Json>
          ballpark_high_cents?: number | null
          ballpark_inputs?: Json | null
          ballpark_low_cents?: number | null
          checklist?: NonNullable<Json>
          client?: NonNullable<Json>
          company_id?: string
          completeness?: number
          deal_id?: string
          id?: string
          promised?: string | null
          scope?: NonNullable<Json>
          sketch_file_id?: string | null
          status?: string
          submitted_at?: string | null
          visited_at?: string | null
          visited_by?: string[]
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
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visits_sketch_file_fk"
            columns: ["sketch_file_id"]
            isOneToOne: false
            referencedRelation: "deal_files"
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
          trade: string | null
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
          trade?: string | null
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
          trade?: string | null
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
            referencedRelation: "crew_projects"
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
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          active: boolean
          avatar_url: string | null
          clerk_id: string
          company_id: string
          created_at: string
          email: string | null
          id: string
          is_default_owner: boolean
          name: string
          notify_prefs: NonNullable<Json>
          phone: string | null
          role: string
        }
        ComputedFields: never
        Insert: {
          active?: boolean
          avatar_url?: string | null
          clerk_id: string
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_default_owner?: boolean
          name?: string
          notify_prefs?: NonNullable<Json>
          phone?: string | null
          role?: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          clerk_id?: string
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_default_owner?: boolean
          name?: string
          notify_prefs?: NonNullable<Json>
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
      work_windows: {
        Row: {
          company_id: string
          end_time: string
          id: string
          kind: string
          start_time: string
          user_id: string
          weekday: number
        }
        ComputedFields: never
        Insert: {
          company_id: string
          end_time: string
          id?: string
          kind: string
          start_time: string
          user_id: string
          weekday: number
        }
        Update: {
          company_id?: string
          end_time?: string
          id?: string
          kind?: string
          start_time?: string
          user_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "work_windows_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_windows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      crew_projects: {
        Row: {
          closed_at: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string | null
          deal_id: string | null
          deal_number: string | null
          deal_year: number | null
          id: string | null
          name: string | null
          project_manager_id: string | null
          status: string | null
        }
        ComputedFields: never
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
            isOneToOne: true
            referencedRelation: "deal_jacket_checklist"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "projects_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deal_recap"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "projects_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
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
          stage_key: string | null
          stage_label: string | null
        }
        ComputedFields: never
        Relationships: []
      }
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
      convert_deal_to_project: {
        Args: {
          p_contract_value_cents: number
          p_deal_id: string
          p_deposit_check_number: string
          p_deposit_method: string
          p_deposit_received_on: string
          p_installments: Json
          p_name: string
          p_payment_template_id: string
          p_planned_start_date?: string
          p_project_manager_id?: string
          p_task_template_id: string
        }
        Returns: string
      }
      deal_gate_missing: {
        Args: { p_deal_id: string; p_gate: string }
        Returns: string[]
      }
      dearmor: { Args: { "": string }; Returns: string }
      gen_random_uuid: { Args: Record<PropertyKey, never>; Returns: string }
      gen_salt: { Args: { "": string }; Returns: string }
      move_project_to_milestone: {
        Args: { p_milestone_key: string; p_project_id: string }
        Returns: undefined
      }
      next_deal_number: {
        Args: { p_at?: string; p_company_id: string }
        Returns: {
          deal_date: string
          deal_number: string
          deal_seq: number
          deal_year: number
        }[]
      }
      pgp_armor_headers: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      seed_company_defaults: { Args: { p_company: string }; Returns: undefined }
      seed_default_deal_jacket: {
        Args: { p_company_id: string }
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
