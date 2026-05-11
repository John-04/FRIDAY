import { NavLink, useLocation } from 'react-router-dom'
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
  const { data } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard })

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-[var(--rule)]" style={{ background: 'var(--ink)' }}>
      {/* Live ticker */}
      {data && (
        <div className="border-b border-[var(--rule)] px-6 py-1.5 flex items-center justify-between overflow-hidden">
          <div className="ticker-wrap flex-1">
            <div className="ticker">
              {[...data.corridor_stats, ...data.corridor_stats].map((c, i) => (
                <span key={i} className="inline-flex items-center gap-2 font-mono text-[10px]" style={{ color: 'var(--text-3)' }}>
                  <span style={{ color: 'var(--text-2)' }}>{c.flag} {c.corridor}</span>
                  <span style={{ color: c.actual_fail_rate > 0.4 ? 'var(--down)' : c.actual_fail_rate > 0.3 ? 'var(--warn)' : 'var(--up)' }}>
                    {(c.actual_fail_rate * 100).toFixed(1)}% fail
                  </span>
                  <span style={{ color: 'var(--rule-2)' }}>·</span>
                  <span style={{ color: 'var(--text-3)' }}>{c.health_score.toFixed(0)} health</span>
                  <span style={{ color: 'var(--text-3)', margin: '0 12px' }}>—</span>
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-8 flex-shrink-0">
            <div className="live-dot" />
            <span className="font-mono text-[10px]" style={{ color: 'var(--text-3)' }}>
              LIVE · {data.meta.best_model.toUpperCase()} {(data.meta.best_model_auc * 100).toFixed(1)}% AUC
            </span>
          </div>
        </div>
      )}

      {/* Main nav */}
      <div className="px-6 h-12 flex items-center justify-between">
        {/* FRIDAY logo */}
        <NavLink to="/" className="flex items-center gap-2.5 no-underline">
          <div className="flex items-center gap-1">
            <div style={{
              width: 22, height: 22,
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: '"Syne", sans-serif',
              fontWeight: 800,
              fontSize: 12,
              color: 'var(--ink)',
              letterSpacing: '-0.05em',
            }}>F</div>
          </div>
          <span style={{
            fontFamily: '"Syne", sans-serif',
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: '-0.03em',
            color: 'var(--text-1)',
          }}>
            FRIDAY
          </span>
          <span style={{
            fontFamily: '"DM Mono", monospace',
            fontSize: 9,
            letterSpacing: '0.12em',
            color: 'var(--text-3)',
            textTransform: 'uppercase',
            marginLeft: 2,
            paddingTop: 2,
          }}>
            Intelligence
          </span>
        </NavLink>

        {/* Nav links */}
        <nav className="flex items-center gap-0">
          {LINKS.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              style={({ isActive }) => ({
                position: 'relative',
                padding: '0 16px',
                height: 48,
                display: 'flex',
                alignItems: 'center',
                fontSize: 13,
                fontFamily: '"DM Sans", sans-serif',
                textDecoration: 'none',
                borderBottom: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                color: isActive ? 'var(--text-1)' : 'var(--text-3)',
                transition: 'all 0.15s',
              })}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <a
          href="/predictor"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            background: 'var(--accent)',
            color: 'var(--ink)',
            fontFamily: '"DM Mono", monospace',
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.06em',
            textDecoration: 'none',
            borderRadius: 2,
          }}
        >
          RUN PREDICTION
        </a>
      </div>
    </header>
  )
}
