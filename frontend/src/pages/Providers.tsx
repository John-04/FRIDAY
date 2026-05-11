import { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'
import { getDashboard, getTrends } from '@/lib/api'
import { fmtPct, fmtUSD, riskColor } from '@/lib/utils'

const T1='var(--text-1)',T2='var(--text-2)',T3='var(--text-3)',RULE='var(--rule)',ACCENT='var(--accent)'

const CORRIDOR_COLORS: Record<string,string> = {
  NGN: '#00E5CC', KES: '#22C55E', GHS: '#F59E0B',
  UGX: '#9BA3B0', TZS: '#5A6272', XOF: '#EF4444', MWK: '#7C3AED',
}

function RiskBadge({ rate }: { rate: number }) {
  const color = riskColor(rate)
  const label = rate < 0.35 ? 'Low' : rate < 0.45 ? 'Medium' : 'High'
  return (
    <span className="chip" style={{ color, borderColor: color + '40', background: color + '15' }}>
      {label}
    </span>
  )
}

export default function ProvidersPage() {
  const { data } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard })
  const { data: trendsData } = useQuery({ queryKey: ['trends'], queryFn: () => getTrends() })

  const providers = data?.provider_stats ?? []
  const trends = trendsData?.trends ?? []

  const topCorridors = ['NGN', 'KES', 'GHS']
  const weekMap: Record<string, Record<string, number>> = {}
  trends.forEach(t => {
    if (!topCorridors.includes(t.corridor)) return
    const key = t.week.slice(0, 10)
    if (!weekMap[key]) weekMap[key] = {}
    weekMap[key][t.corridor] = +(t.fail_rate * 100).toFixed(1)
  })
  const chartData = Object.entries(weekMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-32)
    .map(([week, vals]) => ({ week: week.slice(5), ...vals }))

  const otc = providers.find(p => p.provider === 'OTC_Manual')
  const automated = providers.filter(p => p.provider !== 'OTC_Manual')
  const avgAutoFail = automated.length ? automated.reduce((s, p) => s + p.fail_rate, 0) / automated.length : 0

  return (
    <div className="page-in pt-24 pb-20 max-w-7xl mx-auto px-6">
      <div className="pt-8 mb-10">
        <div className="font-mono text-[10px] uppercase tracking-widest mb-3" style={{ color: T3 }}>Provider Analytics</div>
        <h1 className="font-display text-[40px] font-700 leading-none tracking-tight mb-3" style={{ color: T1 }}>
          Provider Performance<br />Ranked and Scored
        </h1>
        <p style={{ color: T2, fontSize: 14, maxWidth: 480 }}>
          Liquidity provider comparison by failure rate, settlement time, and volume.
          OTC/Manual routing accounts for the majority of volume at significantly higher risk.
        </p>
      </div>

      {/* Key insight */}
      {otc && (
        <div className="card p-5 mb-8" style={{ background: 'var(--ink-3)', borderLeft: '2px solid var(--down)' }}>
          <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--down)' }}>
            ⚠ Critical Finding
          </div>
          <p className="font-mono text-[12px]" style={{ color: T2, lineHeight: 1.7 }}>
            OTC/Manual routing processes <span style={{ color: T1 }}>{fmtUSD(otc.volume_usd)}</span> ({otc.txn_count.toLocaleString()} transactions)
            at a failure rate of <span style={{ color: 'var(--down)' }}>{fmtPct(otc.fail_rate)}</span> and
            <span style={{ color: T1 }}> {otc.avg_settlement_time.toFixed(0)} minute</span> average settlement —
            vs <span style={{ color: 'var(--up)' }}>{fmtPct(avgAutoFail)}</span> failure and{' '}
            <span style={{ color: T1 }}>~2 minute</span> settlement for automated providers.
            Eliminating OTC fallback is the single highest-impact improvement available.
          </p>
        </div>
      )}

      {/* Summary metrics */}
      <div className="grid grid-cols-4 gap-px mb-8" style={{ background: RULE }}>
        {[
          { label: 'Automated Providers', val: String(automated.length), sub: 'Active in network' },
          { label: 'Avg Auto Fail Rate', val: fmtPct(avgAutoFail), sub: 'Automated only', color: 'var(--up)' },
          { label: 'OTC Fail Rate', val: otc ? fmtPct(otc.fail_rate) : '–', sub: 'Manual routing', color: 'var(--down)' },
          { label: 'OTC Settlement', val: otc ? `${otc.avg_settlement_time.toFixed(0)}m` : '–', sub: 'vs ~2m automated', color: 'var(--warn)' },
        ].map(m => (
          <div key={m.label} style={{ background: 'var(--ink-3)', padding: '20px 24px' }}>
            <div className="stat-label mb-2">{m.label}</div>
            <div className="stat-val mb-1" style={{ color: m.color }}>{m.val}</div>
            <div className="font-mono text-[10px]" style={{ color: T3 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Provider table */}
      <div className="card mb-8" style={{ background: 'var(--ink-3)' }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: RULE }}>
          <span className="font-display font-600 text-[13px]" style={{ color: T1 }}>Liquidity Provider Rankings</span>
          <span className="font-mono text-[10px] ml-3" style={{ color: T3 }}>Sorted by failure rate — OTC highlighted</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Provider</th>
              <th>Failure Rate</th>
              <th>Avg Settlement</th>
              <th>Volume (USD)</th>
              <th>Transactions</th>
              <th>Risk Score</th>
              <th>Risk Tier</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((p, i) => {
              const isOtc = p.provider === 'OTC_Manual'
              return (
                <tr key={p.provider} style={{ background: isOtc ? 'rgba(239,68,68,0.04)' : undefined }}>
                  <td><span className="font-mono text-[11px]" style={{ color: T3 }}>{String(i+1).padStart(2,'0')}</span></td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[12px]" style={{ color: T1 }}>{p.provider}</span>
                      {isOtc && <span className="chip down">Manual</span>}
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-1" style={{ background: 'var(--ink-4)' }}>
                        <div style={{ width: `${p.fail_rate * 100}%`, height: '100%', background: riskColor(p.fail_rate) }} />
                      </div>
                      <span className="font-mono text-[12px]" style={{ color: riskColor(p.fail_rate) }}>
                        {fmtPct(p.fail_rate)}
                      </span>
                    </div>
                  </td>
                  <td><span className="font-mono text-[12px]" style={{ color: isOtc ? 'var(--down)' : T2 }}>{p.avg_settlement_time.toFixed(1)}m</span></td>
                  <td><span className="font-mono text-[12px]" style={{ color: T2 }}>{fmtUSD(p.volume_usd)}</span></td>
                  <td><span className="font-mono text-[12px]" style={{ color: T2 }}>{p.txn_count.toLocaleString()}</span></td>
                  <td><span className="font-mono text-[12px]" style={{ color: T2 }}>{p.avg_risk_score.toFixed(3)}</span></td>
                  <td><RiskBadge rate={p.fail_rate} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Weekly trends chart */}
      <div className="card p-6" style={{ background: 'var(--ink-3)' }}>
        <div className="font-mono text-[10px] uppercase tracking-widest mb-1" style={{ color: T3 }}>Weekly Failure Rate Trend</div>
        <div className="font-display font-600 text-[14px] mb-5" style={{ color: T1 }}>
          Top 3 Corridors by Volume · Last 32 Weeks
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData}>
            <CartesianGrid stroke={RULE} />
            <XAxis dataKey="week" tick={{ fontSize: 9, fill: T3, fontFamily: 'DM Mono' }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9, fill: T3, fontFamily: 'DM Mono' }} tickFormatter={v => `${v}%`} domain={[0,80]} />
            <Tooltip contentStyle={{ background: 'var(--ink-4)', border: `1px solid ${RULE}`, borderRadius: 2, fontFamily: 'DM Mono', fontSize: 10 }} formatter={(v: number) => [`${v}%`]} />
            {topCorridors.map(c => (
              <Line key={c} type="monotone" dataKey={c} stroke={CORRIDOR_COLORS[c]} strokeWidth={1.5} dot={false} name={`${c} Fail Rate`} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-6 mt-4">
          {topCorridors.map(c => (
            <div key={c} className="flex items-center gap-2">
              <div className="w-6 h-px" style={{ background: CORRIDOR_COLORS[c] }} />
              <span className="font-mono text-[10px]" style={{ color: T3 }}>{c}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
