import { motion } from 'framer-motion'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import GlassCard from '@/components/ui/GlassCard'
import { cn } from '@/lib/utils'
import type { ModelResult } from '@/lib/api'

interface Props {
  models: ModelResult[]
  shap: Record<string, number>
  bestModel: string
}

const MODEL_COLORS: Record<string, string> = {
  'Random Forest': '#1A6BFF',
  'XGBoost':       '#7B5EA7',
  'LightGBM':      '#22C55E',
}

export default function ModelsSection({ models, shap, bestModel }: Props) {
  const best = models.find(m => m.model_name === bestModel) ?? models[0]

  // ROC data
  const rocData = best?.roc_curve
    ? best.roc_curve.fpr.map((fpr, i) => ({
        fpr: parseFloat(fpr.toFixed(3)),
        tpr: parseFloat(best.roc_curve.tpr[i].toFixed(3)),
      }))
    : []

  // SHAP data
  const shapEntries = Object.entries(shap).slice(0, 12)
  const maxShap = shapEntries[0]?.[1] ?? 1

  return (
    <section id="models" className="py-28 relative">
      <div className="absolute inset-0 grid-overlay opacity-40" />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <p className="text-xs font-medium text-paycrest-blue uppercase tracking-widest mb-3">ML Pipeline</p>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
            Three models.<br />
            <span className="gradient-text italic">Full explainability.</span>
          </h2>
          <p className="text-paycrest-gray text-lg max-w-xl">
            Random Forest, XGBoost, and LightGBM trained with 5-fold cross-validation,
            explained with SHAP.
          </p>
        </motion.div>

        {/* Model comparison cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {models.map((m, i) => (
            <GlassCard
              key={m.model_name}
              delay={i * 0.1}
              waterDrop
              glossy
              className={cn(
                'p-6',
                m.model_name === bestModel && 'border-paycrest-blue/30'
              )}
            >
              {m.model_name === bestModel && (
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-paycrest-blue/15 border border-paycrest-blue/25 text-[10px] text-paycrest-blue font-medium mb-4">
                  ★ Best Model
                </div>
              )}
              <h3 className="text-base font-semibold text-white mb-4">{m.model_name}</h3>

              <div className="space-y-3">
                {[
                  { label: 'Test AUC', value: m.test_auc.toFixed(4) },
                  { label: 'CV AUC', value: `${m.cv_auc_mean.toFixed(4)} ± ${m.cv_auc_std.toFixed(4)}` },
                  { label: 'Avg Precision', value: m.avg_precision.toFixed(4) },
                  { label: 'F1 Score', value: m.f1.toFixed(4) },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center">
                    <span className="text-xs text-paycrest-gray">{row.label}</span>
                    <span
                      className="text-sm font-mono font-medium"
                      style={{ color: MODEL_COLORS[m.model_name] ?? '#fff' }}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* AUC bar */}
              <div className="mt-5">
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: MODEL_COLORS[m.model_name] ?? '#1A6BFF' }}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${((m.test_auc - 0.5) / 0.25) * 100}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.2, delay: i * 0.15 }}
                  />
                </div>
              </div>
            </GlassCard>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ROC Curve */}
          <GlassCard waterDrop className="p-6">
            <h3 className="text-sm font-medium text-paycrest-gray mb-1">ROC Curve</h3>
            <p className="text-xs text-paycrest-gray/60 mb-5">
              {bestModel} · AUC = {best?.test_auc.toFixed(4)}
            </p>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={rocData}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="fpr" tick={{ fontSize: 10, fill: '#8892A4' }} tickCount={6} domain={[0,1]} />
                <YAxis tick={{ fontSize: 10, fill: '#8892A4' }} tickCount={6} domain={[0,1]} />
                <Tooltip
                  contentStyle={{ background: '#111118', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
                  formatter={(v: number) => v.toFixed(3)}
                />
                <ReferenceLine x={0} y={0} stroke="rgba(255,255,255,0.1)" />
                <Line type="linear" dataKey="tpr" stroke="#1A6BFF" strokeWidth={2} dot={false} name="TPR" />
                {/* Diagonal baseline */}
                <Line
                  data={[{fpr:0,tpr:0},{fpr:1,tpr:1}]}
                  type="linear" dataKey="tpr"
                  stroke="rgba(255,255,255,0.15)" strokeWidth={1}
                  strokeDasharray="4 3" dot={false} name="Baseline"
                />
              </LineChart>
            </ResponsiveContainer>
          </GlassCard>

          {/* SHAP Importance */}
          <GlassCard waterDrop className="p-6">
            <h3 className="text-sm font-medium text-paycrest-gray mb-1">SHAP Feature Importance</h3>
            <p className="text-xs text-paycrest-gray/60 mb-5">What drives transaction failures</p>
            <div className="space-y-2.5">
              {shapEntries.map(([feat, val], i) => (
                <div key={feat} className="flex items-center gap-3">
                  <span className="text-[11px] text-paycrest-gray w-36 text-right flex-shrink-0 truncate">{feat}</span>
                  <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: `linear-gradient(90deg, #1A6BFF, #7B5EA7)`,
                        opacity: 0.6 + (1 - i / shapEntries.length) * 0.4
                      }}
                      initial={{ width: 0 }}
                      whileInView={{ width: `${(val / maxShap) * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: i * 0.06 }}
                    />
                  </div>
                  <span className="text-[11px] text-paycrest-gray font-mono w-14 flex-shrink-0">
                    {val.toFixed(4)}
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </section>
  )
}
