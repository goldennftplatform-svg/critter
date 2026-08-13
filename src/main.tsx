import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Watch from './Watch.tsx'
import { Gate } from './Gate.tsx'

const path = window.location.pathname.replace(/\/+$/, '') || '/'
const Page = path === '/watch' ? Watch : App

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Gate>
      <Page />
    </Gate>
  </StrictMode>,
)
