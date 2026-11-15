// Datenbank-Anbindung von `quote` (Lesen von Tarifen, Sätzen und Angeboten; Schreiben nur über die RPCs der Migration 0018).
// Läuft mit dem Secret Key (service_role), daher filtert jede Abfrage ausdrücklich nach Eigentümer bzw. Freigabe.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types.ts'
import { rejectToken } from '../auth.ts'
import { routeDb } from '../route/db.ts'
import type { QuoteDeps, QuoteResponse, SaveBooking, SaveRequest } from './handler.ts'
import type { Candidate } from '../route/facts.ts'
import type { Snapshot } from './snapshot.ts'
import type { VersionHold } from './hold.ts'

type Db = SupabaseClient<Database>

const must = <T>(r: { data: T; error: unknown }): NonNullable<T> => {
  if (r.error || r.data == null) throw r.error ?? new Error('keine Daten')
  return r.data
}

type DbDeps = Pick<QuoteDeps, 'getUserId' | 'takeTokens' | 'currentVersion' | 'loadPricing' | 'loadHold' | 'loadTerms' | 'bookingOpen' | 'geocodeCache' | 'district' | 'loadOffer' | 'findExisting' | 'saveRequest' | 'saveBooking'> & {
  route: Pick<QuoteDeps['route'], 'cache' | 'geoFacts'>
}

export function quoteDb(db: Db): DbDeps {
  const { cache, geoFacts, takeTokens } = routeDb(db)
  return {
    takeTokens,
    route: { cache, geoFacts },
    async getUserId(jwt) {
      const { data, error } = await db.auth.getUser(jwt)
      return error ? rejectToken(error) : (data.user?.id ?? null)
    },
    async currentVersion() {
      const { version } = must(await db.from('current_price_version').select('version').single())
      if (version === null) throw new Error('keine gültige Tarifversion')
      return version
    },
    async loadPricing(version) {
      // Hash der Version vor dem Rechnen prüfen: bei Abweichung Abbruch (500), nichts wird gespeichert.
      const verified = await db.rpc('verify_price_version', { p_version: version })
      if (verified.error) throw verified.error
      const rows = must(await db.from('price_config').select('key, value, unit').eq('version', version))
      return { version, rows }
    },
    async loadHold(version): Promise<VersionHold | null> {
      const { data, error } = await db.rpc('price_version_hold', { p_version: version })
      if (error) throw error
      const row = data?.[0]
      return row ? { started: row.started, isCurrent: row.is_current, replacedAt: row.replaced_at, holdMinutes: row.hold_minutes === null ? null : Number(row.hold_minutes) } : null
    },
    async loadTerms() {
      const { data, error } = await db.rpc('booking_terms')
      if (error) throw error
      return data as Record<string, unknown>
    },
    async bookingOpen() {
      const { data, error } = await db.rpc('booking_open')
      if (error) throw error
      return data === true
    },
    geocodeCache: {
      async get(key) {
        const { data, error } = await db.from('geocode_cache').select('value').eq('key', key).gt('expires_at', new Date().toISOString()).maybeSingle()
        if (error) throw error
        return (data?.value as Candidate[] | undefined) ?? null
      },
      async set(key, value, ttlSeconds) {
        const { error } = await db.from('geocode_cache').upsert({ key, value: value as never, expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString() })
        if (error) throw error
      },
    },
    async district(lon, lat) {
      const { data, error } = await db.rpc('quote_district', { p_lon: lon, p_lat: lat })
      const row = data?.[0]
      if (error || !row) throw error ?? new Error('keine Grenze für den Bezirk')
      return { inVienna: row.in_vienna, inAustria: row.in_austria, district: row.district }
    },
    async loadOffer(id) {
      // service_role umgeht RLS: nur freigegebene Angebote
      const { data, error } = await db.from('rental_offers').select('*').eq('id', id).eq('status', 'approved').maybeSingle()
      if (error) throw error
      if (!data) return null
      return {
        id: data.id,
        providerId: data.provider_id,
        providerName: data.provider_name,
        name: data.name,
        station: data.station,
        sizeM3: Number(data.size_m3),
        dailyCents: data.daily_cents,
        kmPerDay: data.km_per_day,
        extraKmCents: data.extra_km_cents,
        coverDailyCents: data.cover_daily_cents,
        excessCents: data.excess_cents,
        coverExcessCents: data.cover_excess_cents,
        driverDailyCents: data.driver_daily_cents,
        bookingFeeCents: data.booking_fee_cents,
        oneWayCents: data.one_way_cents,
        depositCents: data.deposit_cents,
      }
    },
    async findExisting(customerId, clientRef, kind): Promise<QuoteResponse | null> {
      if (kind === 'request') {
        // Zwei getrennte Zeilen über den zusammengesetzten Fremdschlüssel; das Embedding wäre mehrdeutig (zwei Fremdschlüssel).
        const { data, error } = await db
          .from('service_requests')
          .select('id, status, price_revisions!service_requests_current_revision(price_version, snapshot)')
          .eq('customer_id', customerId)
          .eq('client_ref', clientRef)
          .maybeSingle()
        if (error) throw error
        if (!data) return null
        const rev = data.price_revisions
        if (!rev) throw new Error('Anfrage ohne Revision')
        return { id: data.id, status: data.status, needsQuote: data.status === 'awaiting_offer', priceVersion: rev.price_version, snapshot: rev.snapshot as Snapshot }
      }
      const { data, error } = await db
        .from('rental_bookings')
        .select('id, status, price_version, price_snapshot')
        .eq('customer_id', customerId)
        .eq('client_ref', clientRef)
        .maybeSingle()
      if (error) throw error
      return data && { id: data.id, status: data.status, needsQuote: false, priceVersion: data.price_version, snapshot: data.price_snapshot as Snapshot }
    },
    async saveRequest(a: SaveRequest) {
      const args = {
        p_customer: a.customerId,
        p_client_ref: a.clientRef,
        p_service: a.service,
        p_inputs: a.inputs,
        p_snapshot: a.snapshot,
        p_price_version: a.priceVersion,
        p_total: a.totalCents,
        p_low: a.lowCents,
        p_high: a.highCents,
        p_from_address: a.from?.label ?? null,
        p_from_lon: a.from?.point?.lon ?? null,
        p_from_lat: a.from?.point?.lat ?? null,
        p_to_address: a.to?.label ?? null,
        p_to_lon: a.to?.point?.lon ?? null,
        p_to_lat: a.to?.point?.lat ?? null,
        p_route: a.route,
        p_region: a.region,
        p_district: a.district,
        p_preferred_date: a.preferredDate,
        p_time_window: a.timeWindow,
        p_description: a.description,
        p_volume: a.volumeM3,
        p_contact: a.contact,
        p_confirmed: a.confirmed,
        p_photo_ids: a.photoIds,
      }
      // Die generierten Typen kennen keine NULL-Argumente; die Funktion nimmt sie an.
      const row = must(await db.rpc('quote_save_request', args as never))[0]
      if (!row) throw new Error('keine Antwort der Schreib-Funktion')
      let status = row.status
      if (row.created) {
        // Verteilung an die Partner (S9c). Scheitert sie, holt der Cron-Lauf distribute_pending sie nach; die Anfrage ist gespeichert.
        const dist = await db.rpc('distribute_request', { p_request: row.id })
        if (dist.error) console.error(JSON.stringify({ event: 'distribute_failed', code: dist.error.code }))
        else {
          const now = await db.from('service_requests').select('status').eq('id', row.id).maybeSingle()
          if (now.data) status = now.data.status
        }
      }
      return { id: row.id, status, needsQuote: row.needs_quote, created: row.created }
    },
    async saveBooking(a: SaveBooking) {
      const args = {
        p_customer: a.customerId,
        p_client_ref: a.clientRef,
        p_offer: a.offerId,
        p_pickup: a.pickupAt,
        p_return: a.returnAt,
        p_km: a.km,
        p_cover: a.cover,
        p_extra_driver: a.extraDriver,
        p_one_way: a.oneWay,
        p_snapshot: a.snapshot,
        p_price_version: a.priceVersion,
        p_total: a.totalCents,
        p_deposit: a.depositCents,
      }
      const row = must(await db.rpc('quote_save_booking', args as never))[0]
      if (!row) throw new Error('keine Antwort der Schreib-Funktion')
      return { id: row.id, status: row.status, needsQuote: false, created: row.created }
    },
  }
}
