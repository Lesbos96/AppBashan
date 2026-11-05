// Benannter Import: der Build bindet nur `motion` ein, nicht die ganze tokens.json (vorher 5,4 kB im Einstiegs-Chunk)
import { motion } from '../../docs/reference/design/tokens.json'

export const spring = { type: 'spring', ...motion.spring } as const
