import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@/app/bootstrap'
import App from '@/app/App'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { QueryProvider } from '@/app/providers/QueryProvider'
import { AssistantActivityProvider } from '@/app/providers/AssistantActivityProvider'
import '@/styles/index.css'

const container = document.getElementById('root')

if (!container) {
  throw new Error('Root element "#root" was not found in index.html')
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      {/* Outer boundary: catches provider and router errors before anything renders. */}
      <ErrorBoundary>
        <QueryProvider>
          <AssistantActivityProvider>
            <App />
          </AssistantActivityProvider>
        </QueryProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)
