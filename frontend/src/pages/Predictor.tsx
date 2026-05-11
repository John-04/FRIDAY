import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Zap, AlertTriangle, CheckCircle, XCircle, Loader2, ChevronDown } from 'lucide-react'
import { predict, getDashboard } from '@/lib/api'
import { riskColor } from '@/lib/utils'
import type { PredictResponse } from '@/lib/api'

const T1='var(--text-1)',T2='var(--text-2)',T3='var(--text-3)',RULE='var(--rule)',ACCENT='var(--accent)'

const CORRIDORS = ['NGN','KES','GHS','UGX','TZS','XOF','MWK']
const TOKENS = ['USDT','USDC','cNGN']
const PROVIDERS = ['Provider_A','Provider_B','Provider_C','Provider_D','Provider_E','Provider_F','OTC_Manual']

function Select({ label, value, options, onChange }: any) {
  return (
    <div>
      <label className="font-mono text-[10px] uppercase tracking-widest block mb-2" style={{ color: T3 }}>{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            width: '100%', background: 'var(--ink-4)', border: '1px solid var(--rule)',
            borderRadius: 2, color: T1, fontSize: 13, fontFamily: 'DM Mono',
            padding: '8px 32px 8px 12px', appearance: 'none', cursor: 'pointer',
          }}
        >
          {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: T3 }} />
      </div>
    </div>
  )
}

function NumInput({ label, value, onChange, min, max, step }: any) {
  return (
    <div>
      <label className="font-mono text-[10px] uppercase tracking-widest block mb-2" style={{ color: T3 }}>{label}</label>
      <input
        type="number" value={value} min={min} max={max} step={step}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{
          width: '100%', background: 'var(--ink-4)', border: '1px solid var(--rule)',
          borderRadius: 2, color: T1, fontSize: 13, fontFamily: 'DM Mono',
          padding: '8px 12px',
        }}
      />
    </div>
  )
}

function Slider({ label, value, min, max, step, format, onChange }: any) {
  return (
    <div>
      <div className="flex justify-between mb-2">
        <label className="font-mono text-[10px] uppercase tracking-widest" style={{ color: T3 }}>{label}</label>
        <span className="font-mono text-[11px]" style={{ color: ACCENT }}>{format(value)}</span>
      </div>
      <input
        type="range" value={value} min={min} max={max} step={step}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full" style={{ accentColor: 'var(--accent)' }}
      />
    </div>
  )
}

function RiskGauge({ score, tier }: { score: number; tier: string }) {
  const color = riskColor(score)
  const pct = score * 100
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-widest mb-3" style={{ color: T3 }}>Failure Probability</div>
      <div className="font-mono mb-2 leading-none" style={{ color, fontSize: 52, letterSpacing: '-0.03em' }}>
        {pct.toFixed(1)}<span style={{ fontSize: 20 }}>%</span>
      </div>
      {/* Gauge bar */}
      <div className="relative h-1.5 mb-3" style={{ background: 'var(--ink-4)' }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, height: '100%',
          width: `${pct}%`, background: color, transition: 'width 0.5s ease',
        }} />
      </div>
      <div className="flex items-center gap-2">
        <span className="chip" style={{
          color,
          borderColor: color + '40',
          background: color + '15',
        }}>
          {tier === 'Low' ? <CheckCircle className="w-3 h-3" /> : tier === 'Medium' ? <AlertTriangle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
          {tier} Risk
        </span>
      </div>
    </div>
  )
}

export default function PredictorPage() {
  const { data: dash } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard })

  const [form, setForm] = useState({
    corridor: 'NGN', token: 'USDT', provider: 'Provider_A',
    amount_usd: 500, liquidity_depth_usd: 5000,
    active_providers: 4, network_congestion: 0.2,
    hour: new Date().getHours(),
  })
  const [result, setResult] = useState<PredictResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    setLoading(true); setError('')
    try {
      const res = await predict(form)
      setResult(res)
    } catch (e: any) {
      setError('Backend unavailable. Ensure the FastAPI server is running on port 8000.')
    } finally { setLoading(false) }
  }

  const shap = dash?.shap_importance ?? {}

  return (
    <div className="page-in pt-24 pb-20 max-w-7xl mx-auto px-6">
      <div className="pt-8 mb-10">
        <div className="font-mono text-[10px] uppercase tracking-widest mb-3" style={{ color: T3 }}>Live Risk Engine</div>
        <h1 className="font-display text-[40px] font-700 leading-none tracking-tight mb-3" style={{ color: T1 }}>
          Predict Failure<br />Before It Happens
        </h1>
        <p style={{ color: T2, fontSize: 14, maxWidth: 480 }}>
          Enter transaction parameters and receive an instant failure probability score from the trained Random Forest model, with SHAP-derived risk factor attribution.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Input panel */}
        <div className="card p-6" style={{ background: 'var(--ink-3)' }}>
          <div className="font-mono text-[10px] uppercase tracking-widest mb-5" style={{ color: T3 }}>
            Transaction Parameters
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Select label="Corridor" value={form.corridor} options={CORRIDORS} onChange={(v: string) => set('corridor', v)} />
              <Select label="Token" value={form.token} options={TOKENS} onChange={(v: string) => set('token', v)} />
            </div>
            <Select label="Provider" value={form.provider} options={PROVIDERS} onChange={(v: string) => set('provider', v)} />
            <div className="grid grid-cols-2 gap-4">
              <NumInput label="Amount (USD)" value={form.amount_usd} min={10} max={50000} step={10} onChange={(v: number) => set('amount_usd', v)} />
              <NumInput label="Liquidity Depth (USD)" value={form.liquidity_depth_usd} min={100} max={100000} step={100} onChange={(v: number) => set('liquidity_depth_usd', v)} />
            </div>
            <Slider label="Active Providers" value={form.active_providers} min={1} max={7} step={1} format={(v: number) => v} onChange={(v: number) => set('active_providers', v)} />
            <Slider label="Network Congestion" value={form.network_congestion} min={0} max={1} step={0.05} format={(v: number) => `${(v*100).toFixed(0)}%`} onChange={(v: number) => set('network_congestion', v)} />
            <Slider label="Hour of Day" value={form.hour} min={0} max={23} step={1} format={(v: number) => `${v}:00`} onChange={(v: number) => set('hour', v)} />
          </div>

          <button
            onClick={handleSubmit} disabled={loading}
            className="btn btn-primary w-full mt-6 justify-center"
            style={{ fontFamily: '"DM Mono", monospace', letterSpacing: '0.06em', borderRadius: 2 }}
          >
            {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> COMPUTING...</> : <><Zap className="w-3.5 h-3.5" /> RUN PREDICTION</>}
          </button>

          {error && (
            <p className="font-mono text-[11px] mt-3 text-center" style={{ color: 'var(--warn)' }}>{error}</p>
          )}
        </div>

        {/* Result panel */}
        <div className="flex flex-col gap-4">
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                {/* Main result */}
                <div className="card p-6 mb-4" style={{ background: 'var(--ink-3)' }}>
                  <RiskGauge score={result.risk_score} tier={result.risk_tier} />
                  <p className="font-mono text-[12px] mt-4 pt-4 border-t" style={{ borderColor: RULE, color: T2 }}>
                    {result.recommendation}
                  </p>
                  <div className="font-mono text-[10px] mt-2" style={{ color: T3 }}>
                    Model: {result.model_used} · {new Date(result.predicted_at).toLocaleTimeString()}
                  </div>
                </div>

                {/* SHAP factors */}
                <div className="card p-6" style={{ background: 'var(--ink-3)' }}>
                  <div className="font-mono text-[10px] uppercase tracking-widest mb-4" style={{ color: T3 }}>
                    Top Risk Factors (SHAP)
                  </div>
                  {result.top_risk_factors.map((f, i) => (
                    <div key={f.factor} className="mb-3">
                      <div className="flex justify-between mb-1">
                        <span className="font-mono text-[11px]" style={{ color: T2 }}>{f.factor}</span>
                        <span className="font-mono text-[11px]" style={{ color: T3 }}>{f.importance.toFixed(5)}</span>
                      </div>
                      <div className="h-px" style={{ background: 'var(--ink-4)', position: 'relative' }}>
                        <motion.div
                          style={{ height: '100%', background: ACCENT, position: 'absolute', top: 0 }}
                          initial={{ width: 0 }}
                          animate={{ width: `${(f.importance / result.top_risk_factors[0].importance) * 100}%` }}
                          transition={{ duration: 0.6, delay: i * 0.1 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="card p-12 flex flex-col items-center justify-center text-center"
                style={{ background: 'var(--ink-3)', minHeight: 400 }}
              >
                <div className="w-10 h-10 flex items-center justify-center mb-4" style={{ border: '1px solid var(--rule)', borderRadius: 2 }}>
                  <Zap className="w-5 h-5" style={{ color: T3 }} />
                </div>
                <p className="font-mono text-[12px]" style={{ color: T3 }}>
                  Configure parameters and run prediction
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* How it works */}
          <div className="card p-5" style={{ background: 'var(--ink-3)' }}>
            <div className="font-mono text-[10px] uppercase tracking-widest mb-3" style={{ color: T3 }}>How It Works</div>
            {[
              ['01', 'Input transaction parameters including corridor, provider, amount, and liquidity depth'],
              ['02', 'Random Forest model (AUC 67.07%) scores failure probability using 20 engineered features'],
              ['03', 'SHAP TreeExplainer attributes the score to specific risk drivers for interpretability'],
            ].map(([n, text]) => (
              <div key={n} className="flex gap-3 mb-3 last:mb-0">
                <span className="font-mono text-[10px] pt-0.5 flex-shrink-0" style={{ color: ACCENT }}>{n}</span>
                <span className="font-mono text-[11px]" style={{ color: T3 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
