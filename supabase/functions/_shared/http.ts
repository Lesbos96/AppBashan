// Gemeinsame HTTP-Helfer der Edge Functions `route` und `quote`: JSON-Antwort, CORS nur für erlaubte Origins, Body-Limit per Stream.
import { HttpError } from './route/facts.ts'

export const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } })

export function corsHeaders(req: Request, allowedOrigins: readonly string[]): Record<string, string> {
  const origin = req.headers.get('origin')
  return {
    Vary: 'Origin',
    ...(origin && allowedOrigins.includes(origin)
      ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'apikey, content-type, authorization, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
      : {}),
  }
}

// Liest den Body und bricht bei mehr als maxBytes ab, auch ohne content-length.
export async function readLimited(req: Request, maxBytes: number): Promise<string> {
  if (Number(req.headers.get('content-length')) > maxBytes) throw new HttpError(413, 'body_too_large')
  const reader = req.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > maxBytes) {
      await reader.cancel().catch(() => {})
      throw new HttpError(413, 'body_too_large')
    }
    chunks.push(value)
  }
  const all = new Uint8Array(size)
  let at = 0
  for (const c of chunks) {
    all.set(c, at)
    at += c.length
  }
  return new TextDecoder().decode(all)
}

// Client-IP von der Plattform: cf-connecting-ip, sonst das letzte x-forwarded-for-Element (das erste kann der Client selbst setzen).
// Ohne beides teilen sich alle den Bucket „unknown" (streng, aber sicher). Verhalten nach dem Deploy prüfen (docs/OPEN_ISSUES.md).
export const clientIp = (req: Request): string =>
  req.headers.get('cf-connecting-ip')?.trim() || req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || 'unknown'
