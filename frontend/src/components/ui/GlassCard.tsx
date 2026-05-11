import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface GlassCardProps {
  children: ReactNode
  className?: string
  waterDrop?: boolean
  glossy?: boolean
  glowBlue?: boolean
  hover?: boolean
  delay?: number
  onClick?: () => void
}

export default function GlassCard({
  children,
  className,
  waterDrop = false,
  glossy = false,
  glowBlue = false,
  hover = true,
  delay = 0,
  onClick,
}: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay, ease: [0.4, 0, 0.2, 1] }}
      whileHover={hover ? { y: -3, scale: 1.005 } : undefined}
      onClick={onClick}
      className={cn(
        'rounded-2xl overflow-hidden',
        glowBlue ? 'glass-blue' : 'glass-card',
        waterDrop && 'water-droplet',
        glossy && 'glossy',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </motion.div>
  )
}

/* ── Stat card variant ───────────────────────────────────────────────────── */
interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  icon?: ReactNode
  color?: 'blue' | 'green' | 'amber' | 'red' | 'default'
  delay?: number
}

const colorMap = {
  blue:    'text-paycrest-blue',
  green:   'text-paycrest-success',
  amber:   'text-paycrest-warning',
  red:     'text-paycrest-danger',
  default: 'text-white',
}

export function StatCard({ label, value, sub, icon, color = 'default', delay = 0 }: StatCardProps) {
  return (
    <GlassCard delay={delay} waterDrop className="p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-paycrest-gray uppercase tracking-wider">{label}</p>
        {icon && <div className="text-paycrest-gray/60">{icon}</div>}
      </div>
      <p className={cn('text-3xl font-bold tracking-tight', colorMap[color])}>
        {value}
      </p>
      {sub && <p className="text-xs text-paycrest-gray mt-1.5">{sub}</p>}
    </GlassCard>
  )
}
