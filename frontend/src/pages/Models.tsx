import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'
import { getDashboard } from '@/lib/api'

const T1='var(--text-1)',T2='var(--text-2)',T3='var(--text-3)',RULE='var(--rule)',ACCENT='var(--accent)'

export default function ModelsPage() {
  const { data } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard })
  const models = data?.model_comparison ?? []
  const shap = data?.shap_importance ?? {}
  const best = models[0]

  const rocData = best?.roc_curve
    ? best.roc_curve.fpr.map((f: number, i: number) => ({ fpr: +f.toFixed(3), tpr: +best.roc_curve.tpr[i].toFixed(3) }))
    : []

  const shapEntries = Object.entries(shap).slice(0, 14)
  const maxShap = shapEntries[0]?.[1] as number ?? 1

  const MODEL_COLORS = ['var(--accent)', 'var(--text-2)', 'var(--text-3)']

  return (
    <div className="page-in pt-24 pb-20 max-w-7xl mx-auto px-6">
      <div className="pt-8 mb-10">
        <div className="font-mono text-[10px] uppercase tracking-widest mb-3" style={{ color: T3 }}>ML Pipeline</div>
        <h1 className="font-display text-[40px] font-700 leading-none tracking-tight mb-3" style={{ color: T1 }}>
          Three Models.<br />Full Explainability.
        </h1>
        <p style={{ color: T2, fontSize: 14, maxWidth: 520 }}>
          Random Forest, XGBoost, and LightGBM trained with 5-fold stratified cross-validation.
          Explainability via SHAP TreeExplainer on 500 held-out test samples.
        </p>
      </div>

      {/* Model comparison */}
      <div className="grid grid-cols-3 gap-px mb-8" style={{ background: RULE }}>
        {models.map((m, i) => (
          <div key={m.model_name} style={{ background: 'var(--ink-3)', padding: '24px' }}>
            <div className="flex items-center justify-between mb-5">
              <div className="font-display font-600 text-[15px]" style={{ color: T1 }}>{m.model_name}</div>
              {i === 0 && (
                <span className="chip accent">★ Best</span>
              )}
            </div>
            <div className="space-y-3">
              {[
                { label: 'Test AUC', val: (m.test_auc * 100).toFixed(4) + '%', highlight: i === 0 },
                { label: 'CV AUC', val: `${(m.cv_auc_mean * 100).toFixed(4)}% ± ${(m.cv_auc_std * 100).toFixed(4)}%`, highlight: false },
                { label: 'Avg Precision', val: (m.avg_precision * 100).toFixed(4) + '%', highlight: false },
                { label: 'F1 Score', val: (m.f1 * 100).toFixed(4) + '%', highlight: false },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: T3 }}>{row.label}</span>
                  <span className="font-mono text-[12px]" style={{ color: row.highlight ? ACCENT : T2 }}>{row.val}</span>
                </div>
              ))}
            </div>
            {/* AUC progress */}
            <div className="mt-4 h-px" style={{ background: 'var(--ink-4)' }}>
              <motion.div
                style={{ height: '100%', background: MODEL_COLORS[i] }}
                initial={{ width: 0 }}
                animate={{ width: `${((m.test_auc - 0.5) / 0.3) * 100}%` }}
                transition={{ duration: 1, delay: i * 0.15 }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* ROC Curve */}
        <div className="card p-6" style={{ background: 'var(--ink-3)' }}>
          <div className="font-mono text-[10px] uppercase tracking-widest mb-1" style={{ color: T3 }}>
            ROC Curve
          </div>
          <div className="font-display font-600 text-[14px] mb-5" style={{ color: T1 }}>
            {best?.model_name} · AUC = {best ? (best.test_auc * 100).toFixed(4) : '–'}%
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={rocData}>
              <CartesianGrid stroke={RULE} />
              <XAxis dataKey="fpr" tick={{ fontSize: 9, fill: T3, fontFamily: 'DM Mono' }} tickCount={6} domain={[0,1]} label={{ value: 'FPR', position: 'insideBottom', offset: -2, fontSize: 9, fill: T3 }} />
              <YAxis tick={{ fontSize: 9, fill: T3, fontFamily: 'DM Mono' }} tickCount={6} domain={[0,1]} label={{ value: 'TPR', angle: -90, position: 'insideLeft', fontSize: 9, fill: T3 }} />
              <Tooltip contentStyle={{ background: 'var(--ink-4)', border: `1px solid ${RULE}`, borderRadius: 2, fontFamily: 'DM Mono', fontSize: 10 }} />
              <Line type="linear" dataKey="tpr" stroke={ACCENT} strokeWidth={1.5} dot={false} name="Model" />
              <Line data={[{fpr:0,tpr:0},{fpr:1,tpr:1}]} type="linear" dataKey="tpr" stroke={T3} strokeWidth={1} strokeDasharray="3 3" dot={false} name="Baseline" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* SHAP */}
        <div className="card p-6" style={{ background: 'var(--ink-3)' }}>
          <div className="font-mono text-[10px] uppercase tracking-widest mb-1" style={{ color: T3 }}>
            SHAP Feature Importance
          </div>
          <div className="font-display font-600 text-[14px] mb-5" style={{ color: T1 }}>
            What Drives Transaction Failures
          </div>
          <div className="space-y-3">
            {shapEntries.map(([feat, val], i) => (
              <div key={feat}>
                <div className="flex justify-between mb-1">
                  <span className="font-mono text-[10px]" style={{ color: T3 }}>{feat}</span>
                  <span className="font-mono text-[10px]" style={{ color: T2 }}>{(val as number).toFixed(5)}</span>
                </div>
                <div className="h-px" style={{ background: 'var(--ink-4)', position: 'relative' }}>
                  <motion.div
                    style={{ height: '100%', background: ACCENT, position: 'absolute', top: 0, left: 0, opacity: 0.4 + (1 - i/shapEntries.length) * 0.6 }}
                    initial={{ width: 0 }}
                    animate={{ width: `${((val as number) / maxShap) * 100}%` }}
                    transition={{ duration: 0.8, delay: i * 0.05 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Training details */}
      <div className="card p-6" style={{ background: 'var(--ink-3)' }}>
        <div className="font-display font-600 text-[14px] mb-5" style={{ color: T1 }}>Pipeline Details</div>
        <div className="grid grid-cols-4 gap-px" style={{ background: RULE }}>
          {[
            { label: 'Training samples', val: '12,000' },
            { label: 'Test samples', val: '3,000' },
            { label: 'CV folds', val: '5-fold stratified' },
            { label: 'Features', val: '20 engineered' },
            { label: 'Explainability', val: 'SHAP TreeExplainer' },
            { label: 'SHAP samples', val: '500 test rows' },
            { label: 'Best model', val: data?.meta.best_model ?? '–' },
            { label: 'Trained at', val: data?.trained_at ? new Date(data.trained_at).toLocaleDateString() : '–' },
          ].map(d => (
            <div key={d.label} style={{ background: 'var(--ink-4)', padding: '16px' }}>
              <div className="stat-label mb-2">{d.label}</div>
              <div className="font-mono text-[13px]" style={{ color: T1 }}>{d.val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
