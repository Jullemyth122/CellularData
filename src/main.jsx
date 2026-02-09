import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Symphony from './Symphony.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Symphony />
  </StrictMode>,
)
