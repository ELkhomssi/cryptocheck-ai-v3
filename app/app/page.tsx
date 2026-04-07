'use client'
import ErrorBoundary from '@/components/ErrorBoundary'
import Dashboard from '../dashboard'

export default function AppPage() {
  return (
    <ErrorBoundary name="Dashboard">
      <Dashboard />
    </ErrorBoundary>
  )
}
