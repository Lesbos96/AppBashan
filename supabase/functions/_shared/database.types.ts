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
      fee_splits: {
        Row: {
          created_at: string
          fee_cents: number
          fee_net_cents: number
          fee_rate: number
          fee_vat_cents: number
          fee_vat_rate: number
          id: string
          payee_id: string | null
          payout_cents: number
          price_version: number
          rental_booking_id: string | null
          service_request_id: string | null
          total_cents: number
        }
        Insert: {
          created_at?: string
          fee_cents: number
          fee_net_cents: number
          fee_rate: number
          fee_vat_cents: number
          fee_vat_rate: number
          id?: string
          payee_id?: string | null
          payout_cents: number
          price_version: number
          rental_booking_id?: string | null
          service_request_id?: string | null
          total_cents: number
        }
        Update: {
          created_at?: string
          fee_cents?: number
          fee_net_cents?: number
          fee_rate?: number
          fee_vat_cents?: number
          fee_vat_rate?: number
          id?: string
          payee_id?: string | null
          payout_cents?: number
          price_version?: number
          rental_booking_id?: string | null
          service_request_id?: string | null
          total_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "fee_splits_payee_id_fkey"
            columns: ["payee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_splits_price_version_fkey"
            columns: ["price_version"]
            isOneToOne: false
            referencedRelation: "current_price_version"
            referencedColumns: ["version"]
          },
          {
            foreignKeyName: "fee_splits_price_version_fkey"
            columns: ["price_version"]
            isOneToOne: false
            referencedRelation: "price_versions"
            referencedColumns: ["version"]
          },
          {
            foreignKeyName: "fee_splits_rental_booking_id_fkey"
            columns: ["rental_booking_id"]
            isOneToOne: true
            referencedRelation: "rental_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_splits_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: true
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
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
          storage_path?: string
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
          district: number | null
          from_address: string | null
          from_point: unknown
          from_postcode: string | null
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
          to_postcode: string | null
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
          district?: number | null
          from_address?: string | null
          from_point?: unknown
          from_postcode?: string | null
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
          to_postcode?: string | null
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
          district?: number | null
          from_address?: string | null
          from_point?: unknown
          from_postcode?: string | null
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
          to_postcode?: string | null
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
          fee_vat_rate: number | null
          fee_vat_rate_from: string | null
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
      become_rental_provider: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      booking_terms: { Args: never; Returns: Json }
      photo_cleanup: { Args: never; Returns: undefined }
      photo_orphans: {
        Args: never
        Returns: {
          name: string
        }[]
      }
      publish_version: {
        Args: { p_actor: string; p_version: number }
        Returns: string
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
          p_customer: string
          p_description: string
          p_from_address: string
          p_from_lat: number
          p_from_lon: number
          p_from_postcode: string
          p_high: number
          p_inputs: Json
          p_low: number
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
          p_to_postcode: string
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
      take_rate_tokens: { Args: { checks: Json }; Returns: boolean }
      verify_price_version: { Args: { p_version: number }; Returns: undefined }
      withdraw: {
        Args: { p_request: string }
        Returns: Database["public"]["Enums"]["request_status"]
      }
    }
    Enums: {
      offer_status: "pending" | "approved" | "archived"
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
      offer_status: ["pending", "approved", "archived"],
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
