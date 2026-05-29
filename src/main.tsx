import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { HotkeysProvider } from '@tanstack/react-hotkeys'
import './index.css'
import { router } from './router'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HotkeysProvider>
      <RouterProvider router={router} />
    </HotkeysProvider>
  </StrictMode>,
)
