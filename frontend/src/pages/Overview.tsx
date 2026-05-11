import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowRight, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import { getDashboard } from '@/lib/api'
import { fmtPct, fmtUSD, healthColor, riskColor } from '@/lib/utils'

function SparkBar({ rate }: { rate: number }) {
  const color = rate > 0.45 ? 'var(--down)' : rate > 0.32 ? 'var(--warn)' : 'var(--up)'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1" style={{ background: 'var(--ink-4)' }}>
        <div style={{ width: `${rate * 100}%`, height: '100%', background: color }} />
      </div>
      <span className="font-mono text-[11px]" style={{ color, width: 36, textAlign: 'right' }}>
        {fmtPct(rate)}
      </span>
    </div>
  )
}

export default function OverviewPage() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard })

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="font-mono text-[11px]" style={{ color: 'var(--text-3)' }}>Loading...</div>
    </div>
  )

  const meta = data?.meta
  const corridors = data?.corridor_stats ?? []
  const providers = data?.provider_stats ?? []
  const models = data?.model_comparison ?? []
  const shap = data?.shap_importance ?? {}

  return (
    <div className="page-in pt-24 pb-20 max-w-7xl mx-auto px-6">

      {/* Page header */}
      <div className="mb-12 pt-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="live-dot" />
          <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
            Live Intelligence · Updated continuously
          </span>
        </div>
        <h1 className="font-display text-[48px] font-700 leading-none tracking-tight mb-3" style={{ color: 'var(--text-1)' }}>
          Liquidity Intelligence<br />
          <span style={{ color: 'var(--accent)' }}>Dashboard</span>
        </h1>
        <p className="text-[15px] max-w-xl" style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>
          ML-powered failure prediction and corridor health monitoring built on the Paycrest protocol.
          {meta && ` Trained on ${meta.total_transactions.toLocaleString()} transactions across ${corridors.length} African corridors.`}
        </p>
      </div>

      {/* Key metrics row */}
      <div className="grid grid-cols-4 gap-px mb-12" style={{ background: 'var(--rule)' }}>
        {[
          { label: 'Transactions Analysed', val: meta?.total_transactions.toLocaleString() ?? '–', sub: 'Jun 2024 – Mar 2026' },
          { label: 'System Failure Rate', val: meta ? fmtPct(meta.overall_fail_rate) : '–', sub: 'Weighted average', color: meta && meta.overall_fail_rate > 0.4 ? 'var(--down)' : 'var(--warn)' },
          { label: 'Best Model AUC', val: meta ? (meta.best_model_auc * 100).toFixed(2) + '%' : '–', sub: meta?.best_model ?? '–', color: 'var(--accent)' },
          { label: 'Active Corridors', val: String(corridors.length), sub: 'Africa coverage' },
        ].map((m, i) => (
          <div key={i} style={{ background: 'var(--ink-3)', padding: '24px 28px' }}>
            <div className="stat-label mb-3">{m.label}</div>
            <div className="stat-val mb-1" style={{ color: m.color }}>{m.val}</div>
            <div className="font-mono text-[11px]" style={{ color: 'var(--text-3)' }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-3 gap-6 mb-6">

        {/* Corridor health table */}
        <div className="col-span-2 card" style={{ background: 'var(--ink-3)' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--rule)' }}>
            <span className="font-display font-600 text-[13px]" style={{ color: 'var(--text-1)' }}>Corridor Health</span>
            <Link to="/corridors" className="flex items-center gap-1 font-mono text-[11px] no-underline" style={{ color: 'var(--accent)' }}>
              Full analysis <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Corridor</th>
                <th>Health Score</th>
                <th>Failure Rate</th>
                <th>Liquidity</th>
                <th>Providers</th>
              </tr>
            </thead>
            <tbody>
              {corridors.map(c => (
                <tr key={c.corridor}>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="text-base">{c.flag}</span>
                      <div>
                        <div className="font-mono text-[12px]" style={{ color: 'var(--text-1)' }}>{c.corridor}</div>
                        <div className="font-mono text-[10px]" style={{ color: 'var(--text-3)' }}>{c.country}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1" style={{ background: 'var(--ink-4)' }}>
                        <div style={{ width: `${c.health_score}%`, height: '100%', background: healthColor(c.health_score) }} />
                      </div>
                      <span className="font-mono text-[11px]" style={{ color: healthColor(c.health_score) }}>
                        {c.health_score.toFixed(0)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="chip" style={{
                      color: c.actual_fail_rate > 0.4 ? 'var(--down)' : c.actual_fail_rate > 0.3 ? 'var(--warn)' : 'var(--up)',
                    }}>
                      {fmtPct(c.actual_fail_rate)}
                    </span>
                  </td>
                  <td>
                    <span className="font-mono text-[12px]" style={{ color: 'var(--text-2)' }}>
                      {fmtUSD(c.avg_liquidity_depth)}
                    </span>
                  </td>
                  <td>
                    <span className="font-mono text-[12px]" style={{ color: 'var(--text-2)' }}>
                      {c.avg_active_providers.toFixed(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Model summary */}
          <div className="card p-5" style={{ background: 'var(--ink-3)' }}>
            <div className="flex items-center justify-between mb-4">
              <span className="font-display font-600 text-[13px]" style={{ color: 'var(--text-1)' }}>Models</span>
              <Link to="/models" className="font-mono text-[11px] no-underline" style={{ color: 'var(--accent)' }}>
                Details →
              </Link>
            </div>
            {models.map((m, i) => (
              <div key={m.model_name} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'var(--rule)' }}>
                <div className="flex items-center gap-2">
                  {i === 0 && <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />}
                  <span className="font-mono text-[11px]" style={{ color: i === 0 ? 'var(--text-1)' : 'var(--text-3)' }}>
                    {m.model_name}
                  </span>
                </div>
                <span className="font-mono text-[11px]" style={{ color: i === 0 ? 'var(--accent)' : 'var(--text-3)' }}>
                  {(m.test_auc * 100).toFixed(2)}%
                </span>
              </div>
            ))}
          </div>

          {/* Top SHAP factors */}
          <div className="card p-5 flex-1" style={{ background: 'var(--ink-3)' }}>
            <div className="font-display font-600 text-[13px] mb-4" style={{ color: 'var(--text-1)' }}>
              Top Risk Drivers
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--text-3)' }}>
              SHAP importance
            </div>
            {Object.entries(shap).slice(0, 6).map(([feat, val], i) => {
              const max = Object.values(shap)[0] as number
              return (
                <div key={feat} className="mb-2.5">
                  <div className="flex justify-between mb-1">
                    <span className="font-mono text-[10px]" style={{ color: 'var(--text-3)' }}>{feat}</span>
                    <span className="font-mono text-[10px]" style={{ color: 'var(--text-2)' }}>{(val as number).toFixed(4)}</span>
                  </div>
                  <div className="h-px" style={{ background: 'var(--ink-4)', position: 'relative' }}>
                    <motion.div
                      style={{ height: '100%', background: 'var(--accent)', position: 'absolute', top: 0, left: 0 }}
                      initial={{ width: 0 }}
                      animate={{ width: `${((val as number) / max) * 100}%` }}
                      transition={{ duration: 0.8, delay: i * 0.08 }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Providers preview */}
      <div className="card" style={{ background: 'var(--ink-3)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--rule)' }}>
          <span className="font-display font-600 text-[13px]" style={{ color: 'var(--text-1)' }}>Provider Performance</span>
          <Link to="/providers" className="flex items-center gap-1 font-mono text-[11px] no-underline" style={{ color: 'var(--accent)' }}>
            Full rankings <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-px" style={{ background: 'var(--rule)' }}>
          {providers.map(p => (
            <div key={p.provider} style={{ background: 'var(--ink-3)', padding: '16px' }}>
              <div className="font-mono text-[10px] mb-2 truncate" style={{ color: 'var(--text-3)' }}>{p.provider}</div>
              <SparkBar rate={p.fail_rate} />
              <div className="font-mono text-[10px] mt-1" style={{ color: 'var(--text-3)' }}>
                {p.avg_settlement_time.toFixed(0)}m settle
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
