import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../shared/global.css'
import { Onboarding } from './Onboarding'

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <Onboarding />
  </StrictMode>
)
