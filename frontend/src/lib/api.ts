import axios from 'axios'

const baseURL = (import.meta.env.VITE_API_URL ?? '') !== ''
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

export const api = axios.create({
  baseURL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.response.use(
  res => res,
  err => {
    console.error('[API Error]', err.response?.status, err.config?.url, err.message)
    return Promise.reject(err)
  }
)

export type CorridorStat = {
  corridor: string
  flag: string
  country: string
  total_txns: number
  actual_fail_rate: number
  avg_risk_score: number
  avg_liquidity_depth: number
  avg_active_providers: number
  avg_settlement_time: number
  total_volume_usd: number
  avg_amount_usd: number
  health_score: number
  rate_volatility: number
}

export type ModelResult = {
  model_name: string
  test_auc: number
  avg_precision: number
  f1: number
  accuracy: number
  cv_auc_mean: number
  cv_auc_std: number
  roc_curve: { fpr: number[]; tpr: number[] }
}

export type ProviderStat = {
  provider: string
  txn_count: number
  fail_rate: number
  avg_settlement_time: number
  avg_risk_score: number
  volume_usd: number
}

export type WeeklyTrend = {
  week: string
  corridor: string
  fail_rate: number
  txn_count: number
  avg_risk: number
  avg_liquidity: number
}

export type DashboardData = {
  trained_at?: string
  meta: {
    total_transactions: number
    overall_fail_rate: number
    best_model: string
    best_model_auc: number
    date_range: [string, string]
  }
  model_comparison: ModelResult[]
  shap_importance: Record<string, number>
  corridor_stats: CorridorStat[]
  provider_stats: ProviderStat[]
  weekly_trends: WeeklyTrend[]
}

export type PredictRequest = {
  corridor: string
  token?: string
  provider?: string
  delivery_channel?: string
  amount_usd: number
  active_providers?: number
  provider_concentration?: number
  liquidity_depth_usd: number
  network_congestion?: number
  hour?: number
  day_of_week?: number
}

export type PredictResponse = {
  risk_score: number
  risk_tier: 'Low' | 'Medium' | 'High'
  failure_probability: number
  recommendation: string
  top_risk_factors: Array<{ factor: string; importance: number }>
  model_used: string
  predicted_at: string
}

export const getDashboard = () => api.get<DashboardData>('/dashboard').then(r => r.data)
export const getRates = () => api.get('/rates').then(r => r.data)
export const predict = (req: PredictRequest) => api.post<PredictResponse>('/predict', req).then(r => r.data)
export const getProviders = () => api.get('/providers').then(r => r.data)
export const getTrends = (corridor?: string) => api.get('/trends', { params: { corridor } }).then(r => r.data)
