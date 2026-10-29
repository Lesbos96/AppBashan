import { useSyncExternalStore } from 'react'
import type { ComponentType, SVGProps } from 'react'

type SvgComponent = ComponentType<SVGProps<SVGSVGElement>>

const files = import.meta.glob<SvgComponent>('../assets/illustrations/*.svg', {
  query: '?react',
  import: 'default',
  eager: true,
})

const query = '(prefers-color-scheme: dark)'
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(query)
  media.addEventListener('change', notify)
  return () => media.removeEventListener('change', notify)
}

function useDark() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches)
}

const hasDark = (name: string) => `../assets/illustrations/${name}.dark.svg` in files

/** Nimmt im Dark Mode die Dark-Variante, wenn die Referenz eine hat (Start-Screen), sonst dieselbe Grafik. */
export function Illustration({ name, ...props }: { name: string } & SVGProps<SVGSVGElement>) {
  const dark = useDark()
  const Svg = files[`../assets/illustrations/${name}${dark && hasDark(name) ? '.dark' : ''}.svg`]
  if (!Svg) throw new Error(`Unbekannte Illustration: ${name}`)
  return <Svg aria-hidden="true" {...props} />
}
