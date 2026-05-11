import { motion } from 'framer-motion'
import { useState } from 'react'
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import GlassCard from '@/components/ui/GlassCard'
import { cn, fmtPct, fmtUSD, healthColor, riskColor } from '@/lib/utils'
import type { CorridorStat } from '@/lib/api'

interface Props {
  corridors: CorridorStat[]
}

function HealthRing({ score, size = 64 }: { score: number; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = healthColor(score)

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
      <motion.circle
        cx={size/2} cy={size/2} r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        whileInView={{ strokeDashoffset: offset }}
        viewport={{ once: true }}
        transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1] }}
      />
    </svg>
  )
}

function TrendIcon({ rate }: { rate: number }) {
  if (rate > 0.35) return <TrendingDown className="w-3.5 h-3.5 text-paycrest-danger" />
  if (rate > 0.25) return <Minus className="w-3.5 h-3.5 text-paycrest-warning" />
  return <TrendingUp className="w-3.5 h-3.5 text-paycrest-success" />
}

export default function CorridorsSection({ corridors }: Props) {
  const [selected, setSelected] = useState<CorridorStat | null>(corridors[0] ?? null)

  return (
    <section id="corridors" className="py-28 relative">
      <div className="absolute inset-0 mesh-bg" />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <p className="text-xs font-medium text-paycrest-blue uppercase tracking-widest mb-3">Corridor Intelligence</p>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
            Health across every<br />
            <span className="gradient-text italic">African corridor.</span>
          </h2>
          <p className="text-paycrest-gray max-w-xl text-lg">
            Real-time failure prediction, liquidity depth, and provider utilisation — scored and ranked.
          </p>
        </motion.div>

        {/* Corridor grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-10">
          {corridors.map((c, i) => (
            <motion.button
              key={c.corridor}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              onClick={() => setSelected(c)}
              className={cn(
                'glass-card glossy water-droplet rounded-2xl p-4 flex flex-col items-center gap-2 transition-all duration-300 text-center',
                selected?.corridor === c.corridor
                  ? 'border-paycrest-blue/40 shadow-glow-sm'
                  : 'border-transparent'
              )}
            >
              <span className="text-2xl">{c.flag}</span>
              <span className="text-xs font-semibold text-white">{c.corridor}</span>
              <div className="relative">
                <HealthRing score={c.health_score} size={52} />
                <span
                  className="absolute inset-0 flex items-center justify-center text-[11px] font-bold rotate-90"
                  style={{ color: healthColor(c.health_score) }}
                >
                  {Math.round(c.health_score)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <TrendIcon rate={c.actual_fail_rate} />
                <span className="text-[10px] text-paycrest-gray">{fmtPct(c.actual_fail_rate)}</span>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Detail panel */}
        {selected && (
          <motion.div
            key={selected.corridor}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <GlassCard waterDrop glossy className="p-8">
              <div className="flex items-start justify-between mb-8">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-4xl">{selected.flag}</span>
                    <div>
                      <h3 className="text-2xl font-bold text-white">{selected.corridor}</h3>
                      <p className="text-sm text-paycrest-gray">{selected.country}</p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className="text-4xl font-bold"
                    style={{ color: healthColor(selected.health_score) }}
                  >
                    {selected.health_score.toFixed(1)}
                  </div>
                  <div className="text-xs text-paycrest-gray">Health Score</div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { label: 'Failure Rate', value: fmtPct(selected.actual_fail_rate), color: riskColor(selected.actual_fail_rate) },
                  { label: 'Avg Liquidity', value: fmtUSD(selected.avg_liquidity_depth), color: '#1A6BFF' },
                  { label: 'Active Providers', value: selected.avg_active_providers.toFixed(1), color: '#7B5EA7' },
                  { label: 'Total Volume', value: fmtUSD(selected.total_volume_usd), color: '#22C55E' },
                  { label: 'Avg Settlement', value: `${selected.avg_settlement_time.toFixed(0)}m`, color: '#F59E0B' },
                  { label: 'Transactions', value: selected.total_txns.toLocaleString(), color: '#4D8FFF' },
                  { label: 'Avg Amount', value: fmtUSD(selected.avg_amount_usd), color: '#C084FC' },
                  { label: 'Rate Volatility', value: fmtPct(selected.rate_volatility), color: '#94A3B8' },
                ].map(stat => (
                  <div key={stat.label} className="glass rounded-xl p-4">
                    <div className="text-xs text-paycrest-gray mb-2">{stat.label}</div>
                    <div className="text-xl font-bold" style={{ color: stat.color }}>
                      {stat.value}
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        )}
      </div>
    </section>
  )
}
