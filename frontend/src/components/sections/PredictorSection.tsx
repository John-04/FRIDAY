import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import GlassCard from '@/components/ui/GlassCard'
import { predict } from '@/lib/api'
import { cn, riskColor } from '@/lib/utils'
import type { PredictResponse } from '@/lib/api'

const CORRIDORS = ['NGN', 'KES', 'GHS', 'UGX', 'TZS', 'XOF', 'MWK']
const TOKENS = ['USDT', 'USDC', 'cNGN']
const PROVIDERS = ['Provider_A', 'Provider_B', 'Provider_C', 'Provider_D', 'Provider_E', 'Provider_F', 'OTC_Manual']

const RiskIcon = ({ tier }: { tier: string }) => {
  if (tier === 'Low') return <CheckCircle className="w-8 h-8 text-paycrest-success" />
  if (tier === 'Medium') return <AlertTriangle className="w-8 h-8 text-paycrest-warning" />
  return <XCircle className="w-8 h-8 text-paycrest-danger" />
}

export default function PredictorSection() {
  const [form, setForm] = useState({
    corridor: 'NGN',
    token: 'USDT',
    provider: 'Provider_A',
    amount_usd: 500,
    liquidity_depth_usd: 5000,
    active_providers: 4,
    network_congestion: 0.2,
    hour: new Date().getHours(),
  })
  const [result, setResult] = useState<PredictResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const field = (key: string, val: string | number) =>
    setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await predict(form)
      setResult(res)
    } catch {
      setError('Backend unavailable. Start the FastAPI server to use live predictions.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id="predictor" className="py-28 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-paycrest-blue/[0.03] to-transparent pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <p className="text-xs font-medium text-paycrest-blue uppercase tracking-widest mb-3">Live Risk Engine</p>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
            Predict failure<br />
            <span className="gradient-text italic">before it happens.</span>
          </h2>
          <p className="text-paycrest-gray text-lg max-w-xl">
            Enter transaction parameters and get an instant failure probability from the trained ML model.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input form */}
          <GlassCard waterDrop glossy className="p-8">
            <h3 className="text-sm font-medium text-paycrest-gray mb-6 uppercase tracking-wider">Transaction Parameters</h3>

            <div className="space-y-5">
              {/* Corridor + Token */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-paycrest-gray mb-2 block">Corridor</label>
                  <select
                    value={form.corridor}
                    onChange={e => field('corridor', e.target.value)}
                    className="w-full glass border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white bg-transparent focus:outline-none focus:border-paycrest-blue/40"
                  >
                    {CORRIDORS.map(c => <option key={c} value={c} className="bg-paycrest-dark-3">{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-paycrest-gray mb-2 block">Token</label>
                  <select
                    value={form.token}
                    onChange={e => field('token', e.target.value)}
                    className="w-full glass border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white bg-transparent focus:outline-none focus:border-paycrest-blue/40"
                  >
                    {TOKENS.map(t => <option key={t} value={t} className="bg-paycrest-dark-3">{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Provider */}
              <div>
                <label className="text-xs text-paycrest-gray mb-2 block">Provider</label>
                <select
                  value={form.provider}
                  onChange={e => field('provider', e.target.value)}
                  className="w-full glass border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white bg-transparent focus:outline-none focus:border-paycrest-blue/40"
                >
                  {PROVIDERS.map(p => <option key={p} value={p} className="bg-paycrest-dark-3">{p}</option>)}
                </select>
              </div>

              {/* Amount + Liquidity */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'amount_usd', label: 'Amount (USD)', min: 10, max: 50000, step: 10 },
                  { key: 'liquidity_depth_usd', label: 'Liquidity Depth (USD)', min: 100, max: 100000, step: 100 },
                ].map(({ key, label, min, max, step }) => (
                  <div key={key}>
                    <label className="text-xs text-paycrest-gray mb-2 block">{label}</label>
                    <input
                      type="number"
                      min={min} max={max} step={step}
                      value={form[key as keyof typeof form]}
                      onChange={e => field(key, parseFloat(e.target.value))}
                      className="w-full glass border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white bg-transparent focus:outline-none focus:border-paycrest-blue/40"
                    />
                  </div>
                ))}
              </div>

              {/* Sliders */}
              {[
                { key: 'active_providers', label: 'Active Providers', min: 1, max: 7, step: 1, format: (v: number) => v },
                { key: 'network_congestion', label: 'Network Congestion', min: 0, max: 1, step: 0.05, format: (v: number) => `${(v * 100).toFixed(0)}%` },
                { key: 'hour', label: 'Hour of Day', min: 0, max: 23, step: 1, format: (v: number) => `${v}:00` },
              ].map(({ key, label, min, max, step, format }) => (
                <div key={key}>
                  <div className="flex justify-between mb-2">
                    <label className="text-xs text-paycrest-gray">{label}</label>
                    <span className="text-xs text-paycrest-blue font-mono">
                      {format(form[key as keyof typeof form] as number)}
                    </span>
                  </div>
                  <input
                    type="range" min={min} max={max} step={step}
                    value={form[key as keyof typeof form]}
                    onChange={e => field(key, parseFloat(e.target.value))}
                    className="w-full accent-paycrest-blue"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="btn-glow w-full mt-8 py-3.5 rounded-xl font-semibold text-white bg-paycrest-blue flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Predicting...</>
                : <><Zap className="w-4 h-4" /> Predict Risk</>
              }
            </button>

            {error && (
              <p className="mt-3 text-xs text-paycrest-warning text-center">{error}</p>
            )}
          </GlassCard>

          {/* Result panel */}
          <div className="flex flex-col gap-4">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-4"
                >
                  {/* Risk score card */}
                  <GlassCard waterDrop glossy glowBlue={result.risk_tier === 'Low'} className="p-8">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <p className="text-xs text-paycrest-gray mb-1">Failure Probability</p>
                        <div
                          className="text-6xl font-bold"
                          style={{ color: riskColor(result.risk_score) }}
                        >
                          {result.failure_probability.toFixed(1)}%
                        </div>
                      </div>
                      <RiskIcon tier={result.risk_tier} />
                    </div>

                    {/* Risk bar */}
                    <div className="relative h-3 rounded-full overflow-hidden mb-4"
                      style={{ background: 'linear-gradient(90deg, #22C55E, #F59E0B, #EF4444)' }}>
                      <motion.div
                        className="absolute top-0 bottom-0 w-3 rounded-full bg-white shadow-lg"
                        initial={{ left: 0 }}
                        animate={{ left: `calc(${result.risk_score * 100}% - 6px)` }}
                        transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                      />
                    </div>

                    <div
                      className="inline-flex px-3 py-1 rounded-full text-xs font-semibold border mb-4"
                      style={{
                        color: riskColor(result.risk_score),
                        borderColor: riskColor(result.risk_score) + '40',
                        background: riskColor(result.risk_score) + '15',
                      }}
                    >
                      {result.risk_tier} Risk
                    </div>

                    <p className="text-sm text-paycrest-gray">{result.recommendation}</p>
                    <p className="text-[11px] text-paycrest-gray/50 mt-3 font-mono">
                      Model: {result.model_used}
                    </p>
                  </GlassCard>

                  {/* Top risk factors */}
                  <GlassCard className="p-6">
                    <h4 className="text-xs text-paycrest-gray uppercase tracking-wider mb-4">Top Risk Factors (SHAP)</h4>
                    <div className="space-y-3">
                      {result.top_risk_factors.map((f, i) => (
                        <div key={f.factor} className="flex items-center gap-3">
                          <span className="text-xs text-paycrest-gray w-36 truncate">{f.factor}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <motion.div
                              className="h-full rounded-full bg-paycrest-blue"
                              initial={{ width: 0 }}
                              animate={{ width: `${(f.importance / result.top_risk_factors[0].importance) * 100}%` }}
                              transition={{ duration: 0.8, delay: i * 0.1 }}
                            />
                          </div>
                          <span className="text-[11px] text-paycrest-gray font-mono w-12 text-right">
                            {f.importance.toFixed(4)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="glass-card rounded-2xl p-12 flex flex-col items-center justify-center text-center gap-4 h-full min-h-[400px]"
                >
                  <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center mb-2">
                    <Zap className="w-7 h-7 text-paycrest-blue/60" />
                  </div>
                  <p className="text-white/50 text-sm">Configure parameters and hit<br /><strong className="text-paycrest-blue">Predict Risk</strong> to see results</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}
