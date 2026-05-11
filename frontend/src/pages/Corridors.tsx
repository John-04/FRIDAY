import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { getDashboard, getTrends } from '@/lib/api'
import { fmtPct, fmtUSD, healthColor, riskColor } from '@/lib/utils'
import type { CorridorStat } from '@/lib/api'

const ACCENT = 'var(--accent)'
const T1 = 'var(--text-1)'
const T2 = 'var(--text-2)'
const T3 = 'var(--text-3)'
const RULE = 'var(--rule)'

function HealthBar({ score }: { score: number }) {
  const color = healthColor(score)
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5" style={{ background: 'var(--ink-4)' }}>
        <motion.div
          style={{ height: '100%', background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
        />
      </div>
      <span className="font-mono text-[12px] w-8" style={{ color }}>{score.toFixed(0)}</span>
    </div>
  )
}

function CorridorDetail({ c, trends }: { c: CorridorStat; trends: any[] }) {
  const filtered = trends.filter(t => t.corridor === c.corridor).slice(-16)
  const chartData = filtered.map(t => ({
    week: t.week.slice(5, 10),
    fail: +(t.fail_rate * 100).toFixed(1),
    liq: Math.round(t.avg_liquidity),
  }))

  return (
    <motion.div
      key={c.corridor}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="card mt-4"
      style={{ background: 'var(--ink-3)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between p-6 border-b" style={{ borderColor: RULE }}>
        <div className="flex items-center gap-4">
          <span className="text-4xl">{c.flag}</span>
          <div>
            <div className="font-display font-700 text-[22px] leading-none mb-1" style={{ color: T1 }}>
              {c.corridor}
            </div>
            <div className="font-mono text-[11px] uppercase tracking-wider" style={{ color: T3 }}>
              {c.country}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[11px] uppercase tracking-wider mb-1" style={{ color: T3 }}>Health Score</div>
          <div className="font-mono text-[32px] leading-none" style={{ color: healthColor(c.health_score) }}>
            {c.health_score.toFixed(1)}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-px" style={{ background: RULE }}>
        {[
          { label: 'Failure Rate', val: fmtPct(c.actual_fail_rate), color: riskColor(c.actual_fail_rate) },
          { label: 'Avg Liquidity', val: fmtUSD(c.avg_liquidity_depth), color: T1 },
          { label: 'Active Providers', val: c.avg_active_providers.toFixed(1), color: T1 },
          { label: 'Total Volume', val: fmtUSD(c.total_volume_usd), color: T1 },
          { label: 'Avg Settlement', val: `${c.avg_settlement_time.toFixed(0)}m`, color: T1 },
          { label: 'Transactions', val: c.total_txns.toLocaleString(), color: T1 },
          { label: 'Avg Amount', val: fmtUSD(c.avg_amount_usd), color: T1 },
          { label: 'Rate Volatility', val: fmtPct(c.rate_volatility), color: T1 },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--ink-3)', padding: '16px 20px' }}>
            <div className="stat-label mb-2">{s.label}</div>
            <div className="font-mono text-[18px]" style={{ color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="p-6">
          <div className="font-mono text-[10px] uppercase tracking-widest mb-4" style={{ color: T3 }}>
            Weekly Failure Rate — Last 16 weeks
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData}>
              <CartesianGrid stroke="var(--rule)" />
              <XAxis dataKey="week" tick={{ fontSize: 9, fill: T3, fontFamily: 'DM Mono' }} />
              <YAxis tick={{ fontSize: 9, fill: T3, fontFamily: 'DM Mono' }} tickFormatter={v => `${v}%`} domain={[0, 80]} />
              <Tooltip
                contentStyle={{ background: 'var(--ink-4)', border: '1px solid var(--rule)', borderRadius: 2, fontFamily: 'DM Mono', fontSize: 11 }}
                formatter={(v: number) => [`${v}%`, 'Failure Rate']}
              />
              <Line type="monotone" dataKey="fail" stroke="var(--accent)" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  )
}

export default function CorridorsPage() {
  const { data } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard })
  const { data: trendsData } = useQuery({ queryKey: ['trends'], queryFn: () => getTrends() })
  const [selected, setSelected] = useState<string>('NGN')

  const corridors = data?.corridor_stats ?? []
  const trends = trendsData?.trends ?? []
  const selectedCorridor = corridors.find(c => c.corridor === selected)

  const sorted = [...corridors].sort((a, b) => b.health_score - a.health_score)

  return (
    <div className="page-in pt-24 pb-20 max-w-7xl mx-auto px-6">
      <div className="pt-8 mb-10">
        <div className="font-mono text-[10px] uppercase tracking-widest mb-3" style={{ color: T3 }}>
          Corridor Intelligence
        </div>
        <h1 className="font-display text-[40px] font-700 leading-none tracking-tight mb-3" style={{ color: T1 }}>
          Health Across Every<br />African Corridor
        </h1>
        <p style={{ color: T2, fontSize: 14, maxWidth: 480 }}>
          Real-time failure prediction, liquidity depth, and provider utilisation — scored and ranked across {corridors.length} active markets.
        </p>
      </div>

      {/* Corridor selector */}
      <div className="grid grid-cols-7 gap-px mb-2" style={{ background: RULE }}>
        {sorted.map(c => (
          <button
            key={c.corridor}
            onClick={() => setSelected(c.corridor)}
            style={{
              background: selected === c.corridor ? 'var(--ink-4)' : 'var(--ink-3)',
              padding: '16px 12px',
              cursor: 'pointer',
              border: 'none',
              borderBottom: `2px solid ${selected === c.corridor ? 'var(--accent)' : 'transparent'}`,
              textAlign: 'center',
              transition: 'all 0.15s',
            }}
          >
            <div className="text-xl mb-1">{c.flag}</div>
            <div className="font-mono text-[11px] mb-2" style={{ color: selected === c.corridor ? T1 : T3 }}>
              {c.corridor}
            </div>
            <HealthBar score={c.health_score} />
            <div className="font-mono text-[10px] mt-1.5" style={{ color: riskColor(c.actual_fail_rate) }}>
              {fmtPct(c.actual_fail_rate)}
            </div>
          </button>
        ))}
      </div>

      {/* Detail */}
      <AnimatePresence mode="wait">
        {selectedCorridor && (
          <CorridorDetail key={selected} c={selectedCorridor} trends={trends} />
        )}
      </AnimatePresence>

      {/* Full comparison table */}
      <div className="card mt-8" style={{ background: 'var(--ink-3)' }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: RULE }}>
          <span className="font-display font-600 text-[13px]" style={{ color: T1 }}>Full Corridor Comparison</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Market</th>
              <th>Health Score</th>
              <th>Failure Rate</th>
              <th>Avg Liquidity</th>
              <th>Settlement Time</th>
              <th>Volume</th>
              <th>Transactions</th>
              <th>Volatility</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(c => (
              <tr key={c.corridor} style={{ cursor: 'pointer' }} onClick={() => setSelected(c.corridor)}>
                <td>
                  <div className="flex items-center gap-2">
                    <span>{c.flag}</span>
                    <div>
                      <div className="font-mono text-[12px]" style={{ color: T1 }}>{c.corridor}</div>
                      <div className="font-mono text-[10px]" style={{ color: T3 }}>{c.country}</div>
                    </div>
                  </div>
                </td>
                <td><HealthBar score={c.health_score} /></td>
                <td><span style={{ color: riskColor(c.actual_fail_rate), fontFamily: 'DM Mono', fontSize: 12 }}>{fmtPct(c.actual_fail_rate)}</span></td>
                <td><span className="font-mono text-[12px]" style={{ color: T2 }}>{fmtUSD(c.avg_liquidity_depth)}</span></td>
                <td><span className="font-mono text-[12px]" style={{ color: T2 }}>{c.avg_settlement_time.toFixed(0)}m</span></td>
                <td><span className="font-mono text-[12px]" style={{ color: T2 }}>{fmtUSD(c.total_volume_usd)}</span></td>
                <td><span className="font-mono text-[12px]" style={{ color: T2 }}>{c.total_txns.toLocaleString()}</span></td>
                <td><span className="font-mono text-[12px]" style={{ color: T2 }}>{fmtPct(c.rate_volatility)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
