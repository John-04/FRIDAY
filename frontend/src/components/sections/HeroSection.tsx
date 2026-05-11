import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import CountUp from 'react-countup'
import { useInView } from 'react-intersection-observer'
import { useQuery } from '@tanstack/react-query'
import MeshGraphic from '@/components/ui/MeshGraphic'
import { getDashboard } from '@/lib/api'

const BADGES = ['NGN', 'KES', 'GHS', 'UGX', 'TZS', 'XOF', 'MWK']

export default function HeroSection() {
  const { ref, inView } = useInView({ triggerOnce: true })
  const { data } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard })

  const stats = [
    {
      label: 'Transactions analysed',
      value: data?.meta.total_transactions ?? 15000,
      suffix: '',
      color: '#1A6BFF',
    },
    {
      label: 'Overall failure rate',
      value: data ? +(data.meta.overall_fail_rate * 100).toFixed(1) : 35.6,
      suffix: '%',
      color: '#EF4444',
    },
    {
      label: 'Best model AUC',
      value: data ? +(data.meta.best_model_auc * 100).toFixed(1) : 64.3,
      suffix: '%',
      color: '#22C55E',
    },
    {
      label: 'Corridors monitored',
      value: data?.corridor_stats.length ?? 7,
      suffix: '',
      color: '#7B5EA7',
    },
  ]

  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 bg-paycrest-dark" />
      <div className="absolute inset-0 grid-overlay opacity-60" />
      <div className="absolute inset-0 mesh-bg" />

      {/* Hero glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-paycrest-blue/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Mesh graphic */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-40 pointer-events-none">
        <MeshGraphic />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-32 pb-20">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-paycrest-blue/20 text-xs text-paycrest-blue font-medium mb-8"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-paycrest-blue live-pulse" />
          ML-Powered · Real-Time · African Corridors
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-6 max-w-3xl"
        >
          The liquidity{' '}
          <span className="gradient-text italic font-extrabold">intelligence</span>{' '}
          layer.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg text-paycrest-gray max-w-xl mb-10 leading-relaxed"
        >
          Predict transaction failures before they happen. Monitor corridor
          health in real-time. Built on top of the Paycrest protocol with full ML
          explainability.
        </motion.p>

        {/* Currency badges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex items-center gap-3 mb-10 flex-wrap"
        >
          <span className="text-xs text-paycrest-gray">USDT →</span>
          {BADGES.map((b, i) => (
            <motion.span
              key={b}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.35 + i * 0.05 }}
              className="px-2.5 py-1 rounded-full text-xs font-medium glass border border-white/10 text-white/80"
            >
              {b}
            </motion.span>
          ))}
        </motion.div>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex items-center gap-4 mb-20"
        >
          <a
            href="#corridors"
            className="btn-glow flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white bg-paycrest-blue text-sm"
          >
            Explore Dashboard
            <ArrowRight className="w-4 h-4" />
          </a>
          <a
            href="#predictor"
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white/70 glass border border-white/10 text-sm hover:border-white/20 transition-colors"
          >
            Try Live Predictor
          </a>
        </motion.div>

        {/* Live stats — pulls real values from backend */}
        <div ref={ref} className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.5 + i * 0.1 }}
              className="glass-card water-droplet glossy rounded-2xl p-5"
            >
              <div className="text-3xl font-bold mb-1" style={{ color: stat.color }}>
                {inView && (
                  <CountUp
                    end={stat.value}
                    duration={2}
                    decimals={stat.suffix === '%' ? 1 : 0}
                    delay={0.5 + i * 0.1}
                  />
                )}
                {stat.suffix}
              </div>
              <div className="text-xs text-paycrest-gray">{stat.label}</div>
              {data && (
                <div className="text-[10px] text-paycrest-blue/60 mt-1 font-mono">live</div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Tech stack */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-16 flex items-center gap-6 flex-wrap"
        >
          <span className="text-xs text-paycrest-gray/50 uppercase tracking-widest">Powered by</span>
          {['Random Forest', 'XGBoost', 'LightGBM', 'SHAP', 'FastAPI', 'Paycrest API'].map(tech => (
            <span key={tech} className="text-xs text-paycrest-gray/70 font-mono">{tech}</span>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
