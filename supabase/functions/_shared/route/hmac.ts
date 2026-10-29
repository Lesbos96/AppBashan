// HMAC-SHA256 (hex) über WebCrypto, läuft in Deno und Node.
export function hmacHex(secret: string): (text: string) => Promise<string> {
  const enc = new TextEncoder()
  const key = crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return async (text) => {
    const sig = await crypto.subtle.sign('HMAC', await key, enc.encode(text))
    return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('')
  }
}
