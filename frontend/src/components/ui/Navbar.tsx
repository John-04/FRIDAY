import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Activity, ExternalLink } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getDashboard } from '@/lib/api'

const LINKS = [
  { to: '/', label: 'Overview' },
  { to: '/corridors', label: 'Corridors' },
  { to: '/models', label: 'Models' },
  { to: '/predictor', label: 'Predictor' },
  { to: '/providers', label: 'Providers' },
]

export default function Navbar() {
  const location = useLocation()
  const { data } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard })

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-[var(--rule)]" style={{ background: 'var(--ink)', backdropFilter: 'blur(0px)' }}>
      {/* Top ticker bar */}
      {data && (
        <div className="border-b border-[var(--rule)] px-6 py-1.5 flex items-center justify-between">
          <div className="ticker-wrap flex-1">
            <div className="ticker">
              {[...data.corridor_stats, ...data.corridor_stats].map((c, i) => (
                <span key={i} className="inline-flex items-center gap-2 font-mono text-[10px] text-t3">
                  <span className="text-t2">{c.flag} {c.corridor}</span>
                  <span style={{ color: c.actual_fail_rate > 0.4 ? 'var(--down)' : c.actual_fail_rate > 0.3 ? 'var(--warn)' : 'var(--up)' }}>
                    {(c.actual_fail_rate * 100).toFixed(1)}% fail
                  </span>
                  <span className="text-[var(--rule-2)]">·</span>
                  <span className="text-t3">{c.health_score.toFixed(0)} health</span>
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-8 flex-shrink-0">
            <div className="live-dot" />
            <span className="font-mono text-[10px] text-t3">LIVE · {data.meta.best_model.toUpperCase()} {(data.meta.best_model_auc * 100).toFixed(1)}% AUC</span>
          </div>
        </div>
      )}

      {/* Main nav */}
      <div className="px-6 h-12 flex items-center justify-between">
        <NavLink to="/" className="flex items-center gap-2.5 no-underline">
          <div className="w-6 h-6 flex items-center justify-center" style={{ background: 'var(--accent)' }}>
            <Activity className="w-3.5 h-3.5" style={{ color: 'var(--ink)' }} strokeWidth={2.5} />
          </div>
          <span className="font-display font-700 text-sm tracking-tight" style={{ color: 'var(--text-1)' }}>
            Paycrest<span style={{ color: 'var(--accent)' }}> Intelligence</span>
          </span>
        </NavLink>

        <nav className="flex items-center gap-0">
          {LINKS.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                `relative px-4 h-12 flex items-center text-[13px] transition-colors no-underline border-b-2 ${
                  isActive
                    ? 'text-t1 border-accent'
                    : 'text-t3 border-transparent hover:text-t2'
                }`
              }
              style={({ isActive }) => ({
                color: isActive ? 'var(--text-1)' : undefined,
                borderColor: isActive ? 'var(--accent)' : 'transparent',
              })}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <a
          href="/predictor"
          className="btn btn-primary text-[12px]"
          style={{ fontFamily: '"DM Mono", monospace', letterSpacing: '0.04em' }}
        >
          Run Prediction
        </a>
      </div>
    </header>
  )
}
