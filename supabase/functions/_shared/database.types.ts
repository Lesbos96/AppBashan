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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      assignments: {
        Row: {
          accepted_at: string
          ended_at: string | null
          ended_reason: Database["public"]["Enums"]["assignment_end"] | null
          id: string
          partner_id: string
          request_id: string
        }
        Insert: {
          accepted_at?: string
          ended_at?: string | null
          ended_reason?: Database["public"]["Enums"]["assignment_end"] | null
          id?: string
          partner_id: string
          request_id: string
        }
        Update: {
          accepted_at?: string
          ended_at?: string | null
          ended_reason?: Database["public"]["Enums"]["assignment_end"] | null
          id?: string
          partner_id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string
          at: string
          detail: Json
          entity: string
          entity_id: string | null
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role: string
          at?: string
          detail?: Json
          entity: string
          entity_id?: string | null
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string
          at?: string
          detail?: Json
          entity?: string
          entity_id?: string | null
          id?: never
        }
        Relationships: []
      }
      commission_entries: {
        Row: {
          created_at: string
          fee_cents: number
          fee_net_cents: number
          fee_rate: number
          fee_rate_version: number
          fee_vat_cents: number
          fee_vat_rate: number
          fee_vat_rate_version: number
          id: string
          kind: Database["public"]["Enums"]["commission_kind"]
          partner_id: string
          payment_flow: string
          payout_cents: number
          price_version: number
          request_id: string
          reverses_entry_id: string | null
          revision_id: string
          total_cents: number
          vat_rule: Database["public"]["Enums"]["partner_vat_rule"]
        }
        Insert: {
          created_at?: string
          fee_cents: number
          fee_net_cents: number
          fee_rate: number
          fee_rate_version: number
          fee_vat_cents: number
          fee_vat_rate: number
          fee_vat_rate_version: number
          id?: string
          kind: Database["public"]["Enums"]["commission_kind"]
          partner_id: string
          payment_flow?: string
          payout_cents: number
          price_version: number
          request_id: string
          reverses_entry_id?: string | null
          revision_id: string
          total_cents: number
          vat_rule: Database["public"]["Enums"]["partner_vat_rule"]
        }
        Update: {
          created_at?: string
          fee_cents?: number
          fee_net_cents?: number
          fee_rate?: number
          fee_rate_version?: number
          fee_vat_cents?: number
          fee_vat_rate?: number
          fee_vat_rate_version?: number
          id?: string
          kind?: Database["public"]["Enums"]["commission_kind"]
          partner_id?: string
          payment_flow?: string
          payout_cents?: number
          price_version?: number
          request_id?: string
          reverses_entry_id?: string | null
          revision_id?: string
          total_cents?: number
          vat_rule?: Database["public"]["Enums"]["partner_vat_rule"]
        }
        Relationships: [
          {
            foreignKeyName: "commission_entries_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_entries_price_version_fkey"
            columns: ["price_version"]
            isOneToOne: false
            referencedRelation: "current_price_version"
            referencedColumns: ["version"]
          },
          {
            foreignKeyName: "commission_entries_price_version_fkey"
            columns: ["price_version"]
            isOneToOne: false
            referencedRelation: "price_versions"
            referencedColumns: ["version"]
          },
          {
            foreignKeyName: "commission_entries_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_entries_reverses_entry_id_fkey"
            columns: ["reverses_entry_id"]
            isOneToOne: false
            referencedRelation: "commission_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_entries_revision_id_request_id_fkey"
            columns: ["revision_id", "request_id"]
            isOneToOne: false
            referencedRelation: "price_revisions"
            referencedColumns: ["id", "request_id"]
          },
        ]
      }
      geo_boundaries: {
        Row: {
          geom: unknown
          imported_at: string
          name: string
          slug: string
          source: string
        }
        Insert: {
          geom: unknown
          imported_at?: string
          name: string
          slug: string
          source: string
        }
        Update: {
          geom?: unknown
          imported_at?: string
          name?: string
          slug?: string
          source?: string
        }
        Relationships: []
      }
      geo_districts: {
        Row: {
          district: number
          geom: unknown
          imported_at: string
          name: string
          source: string
        }
        Insert: {
          district: number
          geom: unknown
          imported_at?: string
          name: string
          source: string
        }
        Update: {
          district?: number
          geom?: unknown
          imported_at?: string
          name?: string
          source?: string
        }
        Relationships: []
      }
      geocode_cache: {
        Row: {
          expires_at: string
          key: string
          value: Json
        }
        Insert: {
          expires_at: string
          key: string
          value: Json
        }
        Update: {
          expires_at?: string
          key?: string
          value?: Json
        }
        Relationships: []
      }
      job_listings: {
        Row: {
          accept_deadline: string
          created_at: string
          decided_at: string | null
          district: number
          high_cents: number | null
          id: string
          inputs: Json
          low_cents: number | null
          partner_id: string
          preferred_date: string | null
          request_id: string
          revision_id: string
          service: Database["public"]["Enums"]["service_type"]
          status: Database["public"]["Enums"]["listing_status"]
          time_window: string | null
          total_cents: number | null
          volume_m3: number | null
        }
        Insert: {
          accept_deadline: string
          created_at?: string
          decided_at?: string | null
          district: number
          high_cents?: number | null
          id?: string
          inputs: Json
          low_cents?: number | null
          partner_id: string
          preferred_date?: string | null
          request_id: string
          revision_id: string
          service: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["listing_status"]
          time_window?: string | null
          total_cents?: number | null
          volume_m3?: number | null
        }
        Update: {
          accept_deadline?: string
          created_at?: string
          decided_at?: string | null
          district?: number
          high_cents?: number | null
          id?: string
          inputs?: Json
          low_cents?: number | null
          partner_id?: string
          preferred_date?: string | null
          request_id?: string
          revision_id?: string
          service?: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["listing_status"]
          time_window?: string | null
          total_cents?: number | null
          volume_m3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_listings_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_listings_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_listings_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "price_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      outbox: {
        Row: {
          attempts: number
          claimed_at: string | null
          created_at: string
          dedupe_key: string
          id: number
          kind: string
          last_error: string | null
          recipient_id: string
          recipient_kind: string
          request_id: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          dedupe_key: string
          id?: never
          kind: string
          last_error?: string | null
          recipient_id: string
          recipient_kind: string
          request_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          dedupe_key?: string
          id?: never
          kind?: string
          last_error?: string | null
          recipient_id?: string
          recipient_kind?: string
          request_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbox_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_categories: {
        Row: {
          partner_id: string
          service: Database["public"]["Enums"]["partner_service"]
        }
        Insert: {
          partner_id: string
          service: Database["public"]["Enums"]["partner_service"]
        }
        Update: {
          partner_id?: string
          service?: Database["public"]["Enums"]["partner_service"]
        }
        Relationships: [
          {
            foreignKeyName: "partner_categories_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_documents: {
        Row: {
          id: string
          kind: string
          partner_id: string
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          id?: string
          kind: string
          partner_id: string
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          id?: string
          kind?: string
          partner_id?: string
          storage_path?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_documents_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_members: {
        Row: {
          created_at: string
          partner_id: string
          role: Database["public"]["Enums"]["partner_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          partner_id: string
          role?: Database["public"]["Enums"]["partner_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          partner_id?: string
          role?: Database["public"]["Enums"]["partner_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_members_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_regions: {
        Row: {
          district: number
          partner_id: string
        }
        Insert: {
          district: number
          partner_id: string
        }
        Update: {
          district?: number
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_regions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_vat_rules: {
        Row: {
          created_at: string
          id: number
          partner_id: string
          rule: Database["public"]["Enums"]["partner_vat_rule"]
          valid_from: string
        }
        Insert: {
          created_at?: string
          id?: never
          partner_id: string
          rule: Database["public"]["Enums"]["partner_vat_rule"]
          valid_from: string
        }
        Update: {
          created_at?: string
          id?: never
          partner_id?: string
          rule?: Database["public"]["Enums"]["partner_vat_rule"]
          valid_from?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_vat_rules_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          address_city: string
          address_postcode: string
          address_street: string
          contact_email: string
          contact_name: string
          contact_phone: string
          country: string
          created_at: string
          id: string
          legal_form: string
          name: string
          payout_model: string
          small_business: boolean
          status: Database["public"]["Enums"]["partner_status"]
          status_changed_at: string | null
          status_reason: string | null
          stripe_account_id: string | null
          terms_accepted_at: string
          terms_version: string
          uid: string | null
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          address_city: string
          address_postcode: string
          address_street: string
          contact_email: string
          contact_name: string
          contact_phone: string
          country?: string
          created_at?: string
          id?: string
          legal_form: string
          name: string
          payout_model?: string
          small_business?: boolean
          status?: Database["public"]["Enums"]["partner_status"]
          status_changed_at?: string | null
          status_reason?: string | null
          stripe_account_id?: string | null
          terms_accepted_at: string
          terms_version: string
          uid?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          address_city?: string
          address_postcode?: string
          address_street?: string
          contact_email?: string
          contact_name?: string
          contact_phone?: string
          country?: string
          created_at?: string
          id?: string
          legal_form?: string
          name?: string
          payout_model?: string
          small_business?: boolean
          status?: Database["public"]["Enums"]["partner_status"]
          status_changed_at?: string | null
          status_reason?: string | null
          stripe_account_id?: string | null
          terms_accepted_at?: string
          terms_version?: string
          uid?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          created_at: string
          effective_from: string
          key: string
          note: string | null
          value: number
          version: number
        }
        Insert: {
          created_at?: string
          effective_from: string
          key: string
          note?: string | null
          value: number
          version: number
        }
        Update: {
          created_at?: string
          effective_from?: string
          key?: string
          note?: string | null
          value?: number
          version?: number
        }
        Relationships: []
      }
      price_config: {
        Row: {
          key: string
          label: string
          researched_at: string | null
          sources: Json
          unit: string
          value: number
          version: number
        }
        Insert: {
          key: string
          label: string
          researched_at?: string | null
          sources?: Json
          unit: string
          value: number
          version: number
        }
        Update: {
          key?: string
          label?: string
          researched_at?: string | null
          sources?: Json
          unit?: string
          value?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_config_version_fkey"
            columns: ["version"]
            isOneToOne: false
            referencedRelation: "current_price_version"
            referencedColumns: ["version"]
          },
          {
            foreignKeyName: "price_config_version_fkey"
            columns: ["version"]
            isOneToOne: false
            referencedRelation: "price_versions"
            referencedColumns: ["version"]
          },
        ]
      }
      price_revisions: {
        Row: {
          content_hash: string
          created_at: string
          high_cents: number | null
          id: string
          inputs: Json
          low_cents: number | null
          n: number
          price_version: number
          request_id: string
          snapshot: Json
          source: string
          total_cents: number | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          high_cents?: number | null
          id?: string
          inputs: Json
          low_cents?: number | null
          n: number
          price_version: number
          request_id: string
          snapshot: Json
          source: string
          total_cents?: number | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          high_cents?: number | null
          id?: string
          inputs?: Json
          low_cents?: number | null
          n?: number
          price_version?: number
          request_id?: string
          snapshot?: Json
          source?: string
          total_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "price_revisions_price_version_fkey"
            columns: ["price_version"]
            isOneToOne: false
            referencedRelation: "current_price_version"
            referencedColumns: ["version"]
          },
          {
            foreignKeyName: "price_revisions_price_version_fkey"
            columns: ["price_version"]
            isOneToOne: false
            referencedRelation: "price_versions"
            referencedColumns: ["version"]
          },
          {
            foreignKeyName: "price_revisions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      price_versions: {
        Row: {
          content_hash: string | null
          created_at: string
          effective_on: string
          note: string | null
          published: boolean
          published_at: string | null
          version: number
        }
        Insert: {
          content_hash?: string | null
          created_at?: string
          effective_on: string
          note?: string | null
          published?: boolean
          published_at?: string | null
          version: number
        }
        Update: {
          content_hash?: string | null
          created_at?: string
          effective_on?: string
          note?: string | null
          published?: boolean
          published_at?: string | null
          version?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      rental_bookings: {
        Row: {
          client_ref: string | null
          cover: boolean
          created_at: string
          customer_id: string
          deposit_cents: number
          extra_driver: boolean
          id: string
          km: number
          offer_id: string
          one_way: boolean
          pickup_at: string
          price_snapshot: Json
          price_version: number
          return_at: string
          status: Database["public"]["Enums"]["request_status"]
          total_cents: number
          updated_at: string
        }
        Insert: {
          client_ref?: string | null
          cover?: boolean
          created_at?: string
          customer_id: string
          deposit_cents: number
          extra_driver?: boolean
          id?: string
          km: number
          offer_id: string
          one_way?: boolean
          pickup_at: string
          price_snapshot: Json
          price_version: number
          return_at: string
          status?: Database["public"]["Enums"]["request_status"]
          total_cents: number
          updated_at?: string
        }
        Update: {
          client_ref?: string | null
          cover?: boolean
          created_at?: string
          customer_id?: string
          deposit_cents?: number
          extra_driver?: boolean
          id?: string
          km?: number
          offer_id?: string
          one_way?: boolean
          pickup_at?: string
          price_snapshot?: Json
          price_version?: number
          return_at?: string
          status?: Database["public"]["Enums"]["request_status"]
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_bookings_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "rental_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_bookings_price_version_fkey"
            columns: ["price_version"]
            isOneToOne: false
            referencedRelation: "current_price_version"
            referencedColumns: ["version"]
          },
          {
            foreignKeyName: "rental_bookings_price_version_fkey"
            columns: ["price_version"]
            isOneToOne: false
            referencedRelation: "price_versions"
            referencedColumns: ["version"]
          },
        ]
      }
      rental_offers: {
        Row: {
          booking_fee_cents: number
          cover_daily_cents: number
          cover_excess_cents: number
          created_at: string
          daily_cents: number
          deposit_cents: number
          driver_daily_cents: number
          excess_cents: number
          extra_km_cents: number
          id: string
          is_demo: boolean
          km_per_day: number
          name: string
          one_way_cents: number
          provider_id: string | null
          provider_name: string
          size_m3: number
          station: string
          status: Database["public"]["Enums"]["offer_status"]
          updated_at: string
        }
        Insert: {
          booking_fee_cents?: number
          cover_daily_cents: number
          cover_excess_cents: number
          created_at?: string
          daily_cents: number
          deposit_cents: number
          driver_daily_cents: number
          excess_cents: number
          extra_km_cents: number
          id?: string
          is_demo?: boolean
          km_per_day: number
          name: string
          one_way_cents: number
          provider_id?: string | null
          provider_name: string
          size_m3: number
          station: string
          status?: Database["public"]["Enums"]["offer_status"]
          updated_at?: string
        }
        Update: {
          booking_fee_cents?: number
          cover_daily_cents?: number
          cover_excess_cents?: number
          created_at?: string
          daily_cents?: number
          deposit_cents?: number
          driver_daily_cents?: number
          excess_cents?: number
          extra_km_cents?: number
          id?: string
          is_demo?: boolean
          km_per_day?: number
          name?: string
          one_way_cents?: number
          provider_id?: string | null
          provider_name?: string
          size_m3?: number
          station?: string
          status?: Database["public"]["Enums"]["offer_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_offers_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      request_contacts: {
        Row: {
          created_at: string
          email: string
          name: string
          phone: string
          request_id: string
          stairs_door: string | null
        }
        Insert: {
          created_at?: string
          email: string
          name: string
          phone: string
          request_id: string
          stairs_door?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          name?: string
          phone?: string
          request_id?: string
          stairs_door?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_contacts_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_photos: {
        Row: {
          created_at: string
          id: string
          request_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          request_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          request_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_photos_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      route_cache: {
        Row: {
          expires_at: string
          key: string
          value: Json
        }
        Insert: {
          expires_at: string
          key: string
          value: Json
        }
        Update: {
          expires_at?: string
          key?: string
          value?: Json
        }
        Relationships: []
      }
      route_rate_limits: {
        Row: {
          bucket: string
          hits: number
          window_start: string
        }
        Insert: {
          bucket: string
          hits?: number
          window_start: string
        }
        Update: {
          bucket?: string
          hits?: number
          window_start?: string
        }
        Relationships: []
      }
      service_requests: {
        Row: {
          accept_deadline: string
          client_ref: string
          created_at: string
          current_revision: string | null
          customer_id: string
          description: string | null
          district: number
          from_address: string | null
          from_point: unknown
          id: string
          preferred_date: string | null
          region: Database["public"]["Enums"]["region"] | null
          route: Json | null
          service: Database["public"]["Enums"]["service_type"]
          status: Database["public"]["Enums"]["request_status"]
          termin_at: string
          time_window: string | null
          to_address: string | null
          to_point: unknown
          updated_at: string
          volume_m3: number | null
        }
        Insert: {
          accept_deadline: string
          client_ref: string
          created_at?: string
          current_revision?: string | null
          customer_id: string
          description?: string | null
          district: number
          from_address?: string | null
          from_point?: unknown
          id?: string
          preferred_date?: string | null
          region?: Database["public"]["Enums"]["region"] | null
          route?: Json | null
          service: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["request_status"]
          termin_at: string
          time_window?: string | null
          to_address?: string | null
          to_point?: unknown
          updated_at?: string
          volume_m3?: number | null
        }
        Update: {
          accept_deadline?: string
          client_ref?: string
          created_at?: string
          current_revision?: string | null
          customer_id?: string
          description?: string | null
          district?: number
          from_address?: string | null
          from_point?: unknown
          id?: string
          preferred_date?: string | null
          region?: Database["public"]["Enums"]["region"] | null
          route?: Json | null
          service?: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["request_status"]
          termin_at?: string
          time_window?: string | null
          to_address?: string | null
          to_point?: unknown
          updated_at?: string
          volume_m3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_current_revision"
            columns: ["current_revision", "id"]
            isOneToOne: false
            referencedRelation: "price_revisions"
            referencedColumns: ["id", "request_id"]
          },
          {
            foreignKeyName: "service_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      status_events: {
        Row: {
          actor_id: string | null
          actor_role: string
          at: string
          from_status: Database["public"]["Enums"]["request_status"]
          id: number
          request_id: string
          to_status: Database["public"]["Enums"]["request_status"]
        }
        Insert: {
          actor_id?: string | null
          actor_role: string
          at?: string
          from_status: Database["public"]["Enums"]["request_status"]
          id?: never
          request_id: string
          to_status: Database["public"]["Enums"]["request_status"]
        }
        Update: {
          actor_id?: string | null
          actor_role?: string
          at?: string
          from_status?: Database["public"]["Enums"]["request_status"]
          id?: never
          request_id?: string
          to_status?: Database["public"]["Enums"]["request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "status_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      current_fee_rates: {
        Row: {
          fee_rate: number | null
          fee_rate_from: string | null
          fee_rate_version: number | null
          fee_vat_rate: number | null
          fee_vat_rate_from: string | null
          fee_vat_rate_version: number | null
        }
        Relationships: []
      }
      current_price_version: {
        Row: {
          effective_on: string | null
          version: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_approve_partner: {
        Args: {
          p_actor: string
          p_note?: string
          p_partner: string
          p_services: Database["public"]["Enums"]["partner_service"][]
          p_vat_rule: Database["public"]["Enums"]["partner_vat_rule"]
        }
        Returns: undefined
      }
      admin_contact: {
        Args: { p_actor: string; p_reason: string; p_request: string }
        Returns: {
          email: string
          name: string
          phone: string
          stairs_door: string
        }[]
      }
      admin_create_price_version: {
        Args: {
          p_actor: string
          p_effective_on: string
          p_note?: string
          p_version: number
        }
        Returns: undefined
      }
      admin_grant_role: {
        Args: {
          p_role: Database["public"]["Enums"]["user_role"]
          p_user: string
        }
        Returns: undefined
      }
      admin_remove_partner_document: {
        Args: { p_actor: string; p_document: string; p_note?: string }
        Returns: undefined
      }
      admin_set_partner_master: {
        Args: {
          p_actor: string
          p_city: string
          p_legal_form: string
          p_name: string
          p_note?: string
          p_partner: string
          p_postcode: string
          p_small_business: boolean
          p_street: string
          p_stripe_account_id: string
          p_uid: string
        }
        Returns: undefined
      }
      admin_set_partner_scope: {
        Args: {
          p_actor: string
          p_districts: number[]
          p_note?: string
          p_partner: string
          p_services: Database["public"]["Enums"]["partner_service"][]
        }
        Returns: undefined
      }
      admin_set_partner_status: {
        Args: {
          p_actor: string
          p_partner: string
          p_reason: string
          p_status: Database["public"]["Enums"]["partner_status"]
        }
        Returns: undefined
      }
      admin_set_price_config: {
        Args: {
          p_actor: string
          p_key: string
          p_label: string
          p_researched_at?: string
          p_sources?: Json
          p_unit: string
          p_value: number
          p_version: number
        }
        Returns: undefined
      }
      admin_set_setting: {
        Args: {
          p_actor: string
          p_effective_from: string
          p_key: string
          p_note?: string
          p_value: number
        }
        Returns: undefined
      }
      admin_set_vat_rule: {
        Args: {
          p_actor: string
          p_note?: string
          p_partner: string
          p_rule: Database["public"]["Enums"]["partner_vat_rule"]
          p_valid_from: string
        }
        Returns: undefined
      }
      booking_terms: { Args: never; Returns: Json }
      complete_job: { Args: { p_request: string }; Returns: undefined }
      decline_listing: { Args: { p_listing: string }; Returns: undefined }
      distribute_pending: { Args: never; Returns: number }
      distribute_request: { Args: { p_request: string }; Returns: number }
      expire_requests: { Args: never; Returns: number }
      job_contact: {
        Args: { p_request: string }
        Returns: {
          email: string
          from_address: string
          name: string
          phone: string
          preferred_date: string
          stairs_door: string
          time_window: string
          to_address: string
        }[]
      }
      my_job_partner: {
        Args: { p_request: string }
        Returns: {
          contact_email: string
          contact_name: string
          contact_phone: string
          name: string
        }[]
      }
      outbox_claim: {
        Args: { p_limit: number }
        Returns: {
          id: number
          kind: string
          partner_email: string
          recipient_id: string
          recipient_kind: string
          request_id: string
        }[]
      }
      outbox_dispatch: { Args: never; Returns: undefined }
      outbox_mark: {
        Args: { p_error: string; p_id: number; p_ok: boolean }
        Returns: undefined
      }
      partner_accept: {
        Args: {
          p_actor: string
          p_fee: number
          p_fee_net: number
          p_fee_rate: number
          p_fee_rate_version: number
          p_fee_vat: number
          p_fee_vat_rate: number
          p_fee_vat_rate_version: number
          p_listing: string
          p_payout: number
          p_revision: string
          p_shown_payout: number
        }
        Returns: string
      }
      partner_accept_basis: {
        Args: { p_actor: string; p_listing: string }
        Returns: {
          fee_rate: number
          fee_rate_version: number
          fee_vat_rate: number
          fee_vat_rate_version: number
          revision_id: string
          total_cents: number
        }[]
      }
      photo_cleanup: { Args: never; Returns: undefined }
      photo_orphans: {
        Args: never
        Returns: {
          name: string
        }[]
      }
      photo_staging_interval: { Args: never; Returns: string }
      price_version_hold: {
        Args: { p_version: number }
        Returns: {
          hold_minutes: number
          is_current: boolean
          replaced_at: string
          started: boolean
        }[]
      }
      publish_version: {
        Args: { p_actor: string; p_version: number }
        Returns: string
      }
      quote_district: {
        Args: { p_lat: number; p_lon: number }
        Returns: {
          district: number
          in_austria: boolean
          in_vienna: boolean
        }[]
      }
      quote_save_booking: {
        Args: {
          p_client_ref: string
          p_cover: boolean
          p_customer: string
          p_deposit: number
          p_extra_driver: boolean
          p_km: number
          p_offer: string
          p_one_way: boolean
          p_pickup: string
          p_price_version: number
          p_return: string
          p_snapshot: Json
          p_total: number
        }
        Returns: {
          created: boolean
          id: string
          status: Database["public"]["Enums"]["request_status"]
        }[]
      }
      quote_save_request: {
        Args: {
          p_client_ref: string
          p_confirmed: Json
          p_contact: Json
          p_customer: string
          p_description: string
          p_district: number
          p_from_address: string
          p_from_lat: number
          p_from_lon: number
          p_high: number
          p_inputs: Json
          p_low: number
          p_photo_ids?: string[]
          p_preferred_date: string
          p_price_version: number
          p_region: Database["public"]["Enums"]["region"]
          p_route: Json
          p_service: Database["public"]["Enums"]["service_type"]
          p_snapshot: Json
          p_time_window: string
          p_to_address: string
          p_to_lat: number
          p_to_lon: number
          p_total: number
          p_volume: number
        }
        Returns: {
          created: boolean
          id: string
          needs_quote: boolean
          status: Database["public"]["Enums"]["request_status"]
        }[]
      }
      register_partner: {
        Args: {
          p_city: string
          p_contact_email: string
          p_contact_name: string
          p_contact_phone: string
          p_districts: number[]
          p_legal_form: string
          p_name: string
          p_postcode: string
          p_small_business: boolean
          p_street: string
          p_terms_version: string
          p_uid: string
        }
        Returns: string
      }
      route_cleanup: { Args: never; Returns: undefined }
      route_geo_facts: {
        Args: {
          from_lat: number
          from_lon: number
          line_geojson: string
          to_lat: number
          to_lon: number
        }
        Returns: {
          from_in_austria: boolean
          outside_km: number
          to_in_austria: boolean
        }[]
      }
      start_job: { Args: { p_request: string }; Returns: undefined }
      take_rate_tokens: { Args: { checks: Json }; Returns: boolean }
      verify_price_version: { Args: { p_version: number }; Returns: undefined }
      withdraw: {
        Args: { p_request: string }
        Returns: Database["public"]["Enums"]["request_status"]
      }
    }
    Enums: {
      assignment_end:
        | "completed"
        | "cancelled_by_customer"
        | "cancelled_by_partner"
      commission_kind:
        | "booking"
        | "change"
        | "cancellation"
        | "cancellation_fee"
        | "correction"
      listing_status: "open" | "closed" | "declined" | "accepted"
      offer_status: "pending" | "approved" | "archived"
      partner_role: "owner" | "staff"
      partner_service:
        | "transport"
        | "move"
        | "clearance"
        | "assembly"
        | "rental"
      partner_status:
        | "pending"
        | "active"
        | "payment_hold"
        | "suspended"
        | "rejected"
      partner_vat_rule: "standard_20" | "reverse_charge" | "none"
      region: "vienna" | "austria" | "international"
      request_status:
        | "requested"
        | "awaiting_offer"
        | "offered"
        | "accepted"
        | "in_progress"
        | "completed"
        | "withdrawn"
        | "expired"
        | "declined"
        | "unmatched"
        | "cancelled_by_customer"
        | "cancelled_by_partner"
      service_type: "transport" | "move" | "clearance" | "assembly"
      user_role: "customer" | "rental_provider" | "admin" | "partner"
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
    Enums: {
      assignment_end: [
        "completed",
        "cancelled_by_customer",
        "cancelled_by_partner",
      ],
      commission_kind: [
        "booking",
        "change",
        "cancellation",
        "cancellation_fee",
        "correction",
      ],
      listing_status: ["open", "closed", "declined", "accepted"],
      offer_status: ["pending", "approved", "archived"],
      partner_role: ["owner", "staff"],
      partner_service: ["transport", "move", "clearance", "assembly", "rental"],
      partner_status: [
        "pending",
        "active",
        "payment_hold",
        "suspended",
        "rejected",
      ],
      partner_vat_rule: ["standard_20", "reverse_charge", "none"],
      region: ["vienna", "austria", "international"],
      request_status: [
        "requested",
        "awaiting_offer",
        "offered",
        "accepted",
        "in_progress",
        "completed",
        "withdrawn",
        "expired",
        "declined",
        "unmatched",
        "cancelled_by_customer",
        "cancelled_by_partner",
      ],
      service_type: ["transport", "move", "clearance", "assembly"],
      user_role: ["customer", "rental_provider", "admin", "partner"],
    },
  },
} as const
