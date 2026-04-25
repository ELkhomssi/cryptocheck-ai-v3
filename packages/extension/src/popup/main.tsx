import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/index.css'
import { ExtensionTerminalProvider } from './ExtensionTerminalProvider'
import { PopupShell } from './PopupShell'

const root = document.getElementById('root')
if (!root) throw new Error('#root missing')

createRoot(root).render(
  <StrictMode>
    <ExtensionTerminalProvider>
      <PopupShell />
    </ExtensionTerminalProvider>
  </StrictMode>
)
