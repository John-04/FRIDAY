import { motion } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import GlassCard from '@/components/ui/GlassCard'
import { cn, fmtPct, fmtUSD, riskColor } from '@/lib/utils'
import type { ProviderStat, WeeklyTrend } from '@/lib/api'

interface Props {
  providers: ProviderStat[]
  trends: WeeklyTrend[]
}

const CORRIDOR_COLORS: Record<string, string> = {
  NGN: '#1A6BFF', KES: '#22C55E', GHS: '#F59E0B',
  UGX: '#7B5EA7', TZS: '#EF4444', XOF: '#C084FC', MWK: '#94A3B8',
}

function riskTier(rate: number) {
  if (rate < 0.30) return { label: 'Low', cls: 'risk-low-bg text-paycrest-success' }
  if (rate < 0.40) return { label: 'Medium', cls: 'risk-medium-bg text-paycrest-warning' }
  return { label: 'High', cls: 'risk-high-bg text-paycrest-danger' }
}

export default function ProvidersSection({ providers, trends }: Props) {
  // Build chart data: weekly, top 3 corridors by volume
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

  return (
    <section id="providers" className="py-28 relative">
      <div className="absolute inset-0 mesh-bg" />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <p className="text-xs font-medium text-paycrest-blue uppercase tracking-widest mb-3">Provider Analytics</p>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
            Provider performance<br />
            <span className="gradient-text italic">ranked and scored.</span>
          </h2>
        </motion.div>

        {/* Provider table */}
        <GlassCard waterDrop className="mb-10 overflow-hidden">
          <div className="p-6 border-b border-white/[0.06]">
            <h3 className="text-sm font-medium text-white">Liquidity Provider Rankings</h3>
            <p className="text-xs text-paycrest-gray mt-1">Sorted by failure rate · OTC/Manual highlighted</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {['Provider', 'Failure Rate', 'Avg Settlement', 'Volume (USD)', 'Transactions', 'Risk'].map(h => (
                    <th key={h} className="text-left text-[11px] text-paycrest-gray font-normal uppercase tracking-wider px-6 py-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {providers.map((p, i) => {
                  const tier = riskTier(p.fail_rate)
                  const isOtc = p.provider === 'OTC_Manual'
                  return (
                    <motion.tr
                      key={p.provider}
                      initial={{ opacity: 0, x: -16 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.04 }}
                      className={cn(
                        'border-b border-white/[0.03] transition-colors hover:bg-white/[0.02]',
                        isOtc && 'bg-paycrest-danger/[0.03]'
                      )}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{p.provider}</span>
                          {isOtc && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-paycrest-danger/20 text-paycrest-danger border border-paycrest-danger/20">
                              Manual
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-mono" style={{ color: riskColor(p.fail_rate) }}>
                          {fmtPct(p.fail_rate)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-paycrest-gray font-mono">
                        {p.avg_settlement_time.toFixed(1)} min
                      </td>
                      <td className="px-6 py-4 text-sm text-paycrest-gray">{fmtUSD(p.volume_usd)}</td>
                      <td className="px-6 py-4 text-sm text-paycrest-gray">{p.txn_count.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className={cn('text-[11px] px-2.5 py-1 rounded-full border font-medium', tier.cls)}>
                          {tier.label}
                        </span>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>

        {/* Weekly trends chart */}
        <GlassCard waterDrop className="p-8">
          <h3 className="text-sm font-medium text-white mb-1">Weekly Failure Rate Trend</h3>
          <p className="text-xs text-paycrest-gray mb-6">Top 3 corridors by volume · Last 32 weeks</p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 10, fill: '#8892A4' }}
                tickCount={8}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#8892A4' }}
                tickFormatter={v => `${v}%`}
                domain={[0, 70]}
              />
              <Tooltip
                contentStyle={{ background: '#111118', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
                formatter={(v: number) => [`${v}%`]}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, color: '#8892A4', paddingTop: 16 }}
              />
              {topCorridors.map(c => (
                <Line
                  key={c}
                  type="monotone"
                  dataKey={c}
                  stroke={CORRIDOR_COLORS[c]}
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                  name={`${c} Fail Rate`}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>
    </section>
  )
}
