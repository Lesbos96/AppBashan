import type { ComponentType, SVGProps } from 'react'

type SvgComponent = ComponentType<SVGProps<SVGSVGElement>>

const files = import.meta.glob<SvgComponent>('../assets/icons/*.svg', { query: '?react', import: 'default', eager: true })

// ponytail: Namen sind Dateinamen ohne Endung (Typ string); ein falscher Name wirft sofort.
export function Icon({ name, ...props }: { name: string } & SVGProps<SVGSVGElement>) {
  const Svg = files[`../assets/icons/${name}.svg`]
  if (!Svg) throw new Error(`Unbekanntes Icon: ${name}`)
  return <Svg aria-hidden="true" {...props} />
}
