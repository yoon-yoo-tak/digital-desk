import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../shared/global.css'
import { QuickSearch } from './QuickSearch'

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <QuickSearch />
  </StrictMode>
)
