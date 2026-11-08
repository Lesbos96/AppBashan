// Messung der Bildverarbeitung (S9d, Plan E4): CPU-Zeit und Spitzen-Speicher von processPhoto an einem typischen und einem Grenzfall-Bild.
// Vergleichswerte der Plattform (Supabase Edge Functions): 2 s CPU-Zeit je Aufruf, 256 MB Speicher. Lokale Werte sind nur ein Anhaltspunkt.
// Die Eingaben entstehen in einem eigenen Prozess (`make`), damit ihre Erzeugung den Speicher der Messung nicht verfälscht.
// Aufruf: npx deno run --allow-env --allow-read --allow-write --allow-sys scripts/measure-photo.ts make <ordner>
//         npx deno run --allow-env --allow-read --allow-sys scripts/measure-photo.ts measure <datei>
import process from 'node:process'
import { Image } from 'npm:imagescript@3.17.0'
import { processPhoto } from '../supabase/functions/_shared/photo/process.ts'

const mb = (n: number) => (n / 1048576).toFixed(1)
const LIMIT = 10 * 1024 * 1024

function noise(w: number, h: number): Image {
  let s = 7
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) >>> 24)
  const img = new Image(w, h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) img.setPixelAt(x, y, Image.rgbToColor(rnd(), rnd(), rnd()))
  return img
}

function scene(w: number, h: number): Image {
  const img = new Image(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = 128 + 60 * Math.sin(x / 90) * Math.cos(y / 70) + ((x * 31 + y * 17) % 13)
      img.setPixelAt(x, y, Image.rgbToColor(v & 255, (v * 0.8) & 255, (255 - v) & 255))
    }
  }
  return img
}

const [mode, arg] = Deno.args
if (mode === 'make' && arg) {
  Deno.mkdirSync(arg, { recursive: true })
  Deno.writeFileSync(`${arg}/photo-typical.jpg`, await scene(2000, 1500).encodeJPEG({ quality: 88 }))
  // Rauschen ist der schlechteste Fall für Dekoder und Encoder; die höchste Quality, die unter der Eingabegrenze von 10 MB bleibt
  const img = noise(2048, 2048)
  for (const q of [100, 98, 96, 94, 92, 90, 85]) {
    const jpg = await img.encodeJPEG({ quality: q })
    if (jpg.length <= LIMIT) {
      Deno.writeFileSync(`${arg}/photo-worst.jpg`, jpg)
      console.log(`photo-worst.jpg: 2048 x 2048 Rauschen, Quality ${q}, ${mb(jpg.length)} MB`)
      break
    }
  }
} else if (mode === 'measure' && arg) {
  const input = Deno.readFileSync(arg)
  const cpu0 = process.cpuUsage()
  const t0 = performance.now()
  const out = await processPhoto(input)
  const wall = performance.now() - t0
  const cpu = process.cpuUsage(cpu0)
  const ru = process.resourceUsage()
  console.log(
    `${arg}: Eingabe ${mb(input.length)} MB -> Ausgabe ${mb(out.bytes.length)} MB (${out.width} x ${out.height}); ` +
      `Wanduhr ${wall.toFixed(0)} ms, CPU ${((cpu.user + cpu.system) / 1000).toFixed(0)} ms, Spitzen-RSS ${mb(ru.maxRSS * 1024)} MB`,
  )
} else {
  console.error('Aufruf: make <ordner> | measure <datei>')
  Deno.exit(2)
}
