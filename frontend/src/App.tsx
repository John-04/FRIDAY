import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from '@/components/ui/Navbar'
import OverviewPage from '@/pages/Overview'
import CorridorsPage from '@/pages/Corridors'
import ModelsPage from '@/pages/Models'
import PredictorPage from '@/pages/Predictor'
import ProvidersPage from '@/pages/Providers'
import '@/styles/globals.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1 } }
})

function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--rule)', padding: '24px 0', marginTop: 40 }}>
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <span className="font-mono text-[11px]" style={{ color: 'var(--text-3)' }}>
          Paycrest Intelligence · ML-powered liquidity analytics
        </span>
        <div className="flex items-center gap-2">
          <div className="live-dot" />
          <span className="font-mono text-[11px]" style={{ color: 'var(--text-3)' }}>
            15,000 transactions · 7 corridors · Live API
          </span>
        </div>
      </div>
    </footer>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Navbar />
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/corridors" element={<CorridorsPage />} />
          <Route path="/models" element={<ModelsPage />} />
          <Route path="/predictor" element={<PredictorPage />} />
          <Route path="/providers" element={<ProvidersPage />} />
        </Routes>
        <Footer />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
