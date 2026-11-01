import { MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import '@fontsource-variable/inter'
import { router } from './app/router'
import { purgeHandover } from './lib/draft'
import { SessionProvider } from './lib/session'
import './index.css'

purgeHandover()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* prefers-reduced-motion: Motion lässt Transformationen weg, es bleiben Fades */}
    <MotionConfig reducedMotion="user">
      <SessionProvider>
        <RouterProvider router={router} />
      </SessionProvider>
    </MotionConfig>
  </StrictMode>,
)
