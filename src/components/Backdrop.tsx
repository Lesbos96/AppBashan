import { useId } from 'react'

/** Hero-Hintergrund: bewegter Verlaufsnebel (`--gradient-hero-mesh`) mit Filmkorn, füllt den Elternblock. */
export function Backdrop() {
  const id = useId()
  return (
    <>
      <div aria-hidden="true" className="mn-mesh absolute -inset-[40%] [background:var(--gradient-hero-mesh)]" />
      <svg aria-hidden="true" className="absolute inset-0 size-full opacity-[0.16] mix-blend-overlay">
        <filter id={id}>
          <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${id})`} />
      </svg>
    </>
  )
}
