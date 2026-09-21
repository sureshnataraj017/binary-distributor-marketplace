import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import '@/store/themeStore' // applies the saved/system theme before first paint
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
