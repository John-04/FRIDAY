import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmt(n: number, decimals = 1) {
  return n.toFixed(decimals)
}

export function fmtPct(n: number) {
  return `${(n * 100).toFixed(1)}%`
}

export function fmtUSD(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

export function fmtCount(n: number) {
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function riskColor(score: number) {
  if (score < 0.35) return '#22C55E'
  if (score < 0.60) return '#F59E0B'
  return '#EF4444'
}

export function riskLabel(score: number): 'Low' | 'Medium' | 'High' {
  if (score < 0.35) return 'Low'
  if (score < 0.60) return 'Medium'
  return 'High'
}

export function healthColor(score: number) {
  if (score >= 70) return '#22C55E'
  if (score >= 50) return '#F59E0B'
  return '#EF4444'
}
