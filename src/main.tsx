import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import '@fontsource-variable/inter'
import './index.css'

// ponytail: Start-Route bleibt Platzhalter bis zur App-Shell in S4
const router = createBrowserRouter([
  { path: '/', element: <h1>MoveNow</h1> },
  // Galerie nur im Dev-Build; der Build lässt den Zweig samt Import weg.
  ...(import.meta.env.DEV
    ? [{ path: '/dev/fundament', HydrateFallback: () => null, lazy: async () => ({ Component: (await import('./dev/Fundament')).Fundament }) }]
    : []),
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
