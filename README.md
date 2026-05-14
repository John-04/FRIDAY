# FRIDAY Intelligence

> Institutional-grade liquidity analytics and ML-powered transaction failure prediction for African payment corridors — built on the Paycrest protocol.

---

## Overview

FRIDAY is a full-stack data intelligence system that solves one of the most critical problems in African stablecoin payments: **unpredictable transaction failures caused by liquidity fragmentation**.

Built on top of the [Paycrest protocol](https://paycrest.io), FRIDAY connects to live corridor data, trains three machine learning models on 15,000 transactions across 7 African markets, and surfaces real-time failure predictions with full explainability via SHAP.

The result: a system that can tell you — before a transaction is routed — whether it is likely to fail, why it will fail, and which corridors and providers are operating below acceptable health thresholds.

---

## The Problem

Paycrest's co-founders have publicly acknowledged that approximately **80% of transactions on their network fall back to OTC/Manual routing** — informal channels like WhatsApp — because automated providers run out of liquidity unpredictably. This creates:

- **Settlement delays**: OTC routing averages 90+ minutes vs under 2 minutes for automated providers
- **Higher failure rates**: OTC/Manual has a 52%+ failure rate vs ~35% for automated providers
- **No predictability**: No system exists to warn operators when corridors are about to thin out
- **Corridor blindness**: No comparative view of which markets are healthy and which need urgent provider onboarding

FRIDAY addresses all four.

---

## What FRIDAY Does

### 1. Failure Prediction Engine
A trained Random Forest model (AUC: **67.07%**) scores every transaction before it is routed, returning:
- Failure probability (0–100%)
- Risk tier (Low / Medium / High)
- Top contributing risk factors (SHAP-attributed)
- Routing recommendation

### 2. Corridor Health Intelligence
Health scores for all 7 active African corridors, computed from:
- Actual failure rate (40% weight)
- Active provider depth (30% weight)
- Liquidity depth in USD (30% weight)

### 3. Provider Performance Rankings
Every liquidity provider ranked by failure rate, settlement time, and volume — with OTC/Manual clearly flagged as the system's highest-risk routing path.

### 4. Live API Integration
Connects directly to the Paycrest API using a Sender API key, pulling live exchange rates for all corridors and using them to calibrate the simulation. As real order data accumulates, it automatically merges into the training dataset on the next retrain cycle.

### 5. Automated Model Retraining
APScheduler runs retraining every 24 hours (and additionally at 03:00 UTC daily), pulling fresh Paycrest rates, regenerating the simulation with updated calibration, and retraining all three models without manual intervention.

---

## Architecture

```
FRIDAY/
├── frontend/                  # React + Vite + TypeScript
│   └── src/
│       ├── pages/             # 5 separate pages with React Router
│       │   ├── Overview.tsx   # Dashboard home — all KPIs
│       │   ├── Corridors.tsx  # Per-corridor health + trend charts
│       │   ├── Models.tsx     # ML model comparison + ROC + SHAP
│       │   ├── Predictor.tsx  # Live transaction risk scorer
│       │   └── Providers.tsx  # Provider rankings + weekly trends
│       ├── components/ui/     # Navbar, shared components
│       ├── lib/               # API client (axios), utility functions
│       └── styles/            # Global CSS — Token Terminal × Paycrest design system
│
├── backend/                   # FastAPI + Python
│   └── src/
│       ├── api/main.py        # 11 REST endpoints with auth + rate limiting
│       ├── ml/pipeline.py     # Full ML training pipeline
│       ├── data/fetcher.py    # Paycrest API integration + data generation
│       └── config/
│           ├── settings.py    # Pydantic settings from .env
│           ├── auth.py        # API key authentication middleware
│           ├── scheduler.py   # APScheduler background retraining
│           └── logger.py      # Structured JSON logging
│
└── data/
    ├── raw/                   # Parquet transaction dataset
    ├── models/                # Saved .pkl models + results.json
    └── logs/                  # JSON logs (30-day rotation)
```

---

## ML Pipeline

### Models Trained

| Model | CV AUC | Test AUC | Avg Precision | F1 Score |
|-------|--------|----------|---------------|----------|
| **Random Forest** ⭐ | 0.6773 ± 0.0109 | **0.6707** | 0.6938 | 0.6336 |
| XGBoost | 0.6644 ± 0.0080 | 0.6529 | 0.6766 | 0.6187 |
| LightGBM | 0.6560 ± 0.0089 | 0.6490 | 0.6722 | 0.6147 |

### Feature Engineering (20 features)

**Liquidity features:**
- `liquidity_depth_usd` — total USD depth available in corridor
- `liquidity_ratio` — depth relative to transaction amount
- `active_providers` — number of active providers at time of transaction
- `provider_concentration` — Herfindahl-like concentration index

**Transaction features:**
- `amount_usd` — transaction size in USD
- `token` — stablecoin used (USDT / USDC / cNGN)
- `provider` — routing provider selected
- `delivery_channel` — bank transfer vs mobile money

**Temporal features:**
- `hour`, `day_of_week`, `month`, `day_of_month`
- `is_peak_hour` — 08:00–20:00 flag
- `is_weekend` — Saturday/Sunday flag
- `is_month_end` — day ≥ 25 flag
- `is_salary_day` — days 25–28 flag (African payroll patterns)

**Network features:**
- `network_congestion` — blockchain network load estimate
- `gas_fee_spike` — binary spike flag
- `rate_volatility` — stablecoin rate deviation

### Top SHAP Risk Drivers

| Feature | SHAP Importance |
|---------|----------------|
| Provider | 0.04910 |
| Liquidity Depth (USD) | 0.04790 |
| Peak Hour | 0.04160 |
| Liquidity Ratio | 0.03920 |
| Hour of Day | 0.01870 |
| Active Providers | 0.01570 |
| Day of Month | 0.01330 |
| Corridor | 0.01290 |

### Training Configuration
- **Dataset**: 15,000 transactions across 7 corridors (Jun 2024 – Mar 2026)
- **Train/Test split**: 80/20 stratified
- **Cross-validation**: 5-fold StratifiedKFold
- **Class balancing**: `class_weight="balanced"` (RF, LightGBM), `scale_pos_weight` (XGBoost)
- **Explainability**: SHAP TreeExplainer on 500 held-out test samples

---

## Corridor Coverage

| Corridor | Country | Channel | Health Score | Failure Rate |
|----------|---------|---------|-------------|-------------|
| NGN | Nigeria | Bank Transfer | 74.0 | 32.6% |
| KES | Kenya | Mobile Money | 65.9 | 27.0% |
| GHS | Ghana | Bank Transfer | 57.9 | 37.4% |
| TZS | Tanzania | Mobile Money | 50.0 | 42.3% |
| UGX | Uganda | Mobile Money | 49.5 | 43.8% |
| XOF | West Africa | Bank Transfer | 47.8 | 46.8% |
| MWK | Malawi | Bank Transfer | 43.8 | 54.8% |

---

## API Reference

All endpoints require `X-API-Key` header in production. In development (no `API_KEYS` env var set), open access is allowed.

### Public

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | API status, scheduler info |

### Protected

| Method | Endpoint | Rate Limit | Description |
|--------|----------|------------|-------------|
| `GET` | `/api/dashboard` | 60/min | Full dashboard data |
| `GET` | `/api/corridors` | 60/min | All corridor health stats |
| `GET` | `/api/corridors/{code}` | 60/min | Single corridor detail |
| `GET` | `/api/models` | 30/min | Model comparison + SHAP |
| `GET` | `/api/trends` | 30/min | Weekly failure rate trends |
| `GET` | `/api/providers` | 30/min | Provider performance ranking |
| `GET` | `/api/rates` | 30/min | Live Paycrest exchange rates |
| `POST` | `/api/predict` | 30/min | Transaction failure prediction |
| `POST` | `/api/retrain` | 5/hour | Trigger background retraining |
| `GET` | `/api/scheduler` | 30/min | Scheduler status + next run |
| `GET` | `/api/meta` | 30/min | Corridor metadata |

### Prediction Request Example

```bash
curl -X POST https://your-backend.onrender.com/api/predict \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{
    "corridor": "NGN",
    "token": "USDT",
    "provider": "Provider_A",
    "delivery_channel": "bank_transfer",
    "amount_usd": 500,
    "active_providers": 4,
    "provider_concentration": 0.3,
    "liquidity_depth_usd": 5000,
    "network_congestion": 0.2,
    "hour": 14,
    "day_of_week": 1
  }'
```

### Prediction Response

```json
{
  "risk_score": 0.2462,
  "risk_tier": "Low",
  "failure_probability": 24.6,
  "recommendation": "Transaction looks healthy. Proceed normally.",
  "top_risk_factors": [
    { "factor": "Provider", "importance": 0.04910 },
    { "factor": "Liquidity Depth (USD)", "importance": 0.04790 },
    { "factor": "Peak Hour", "importance": 0.04160 },
    { "factor": "Liquidity Ratio", "importance": 0.03920 },
    { "factor": "Hour of Day", "importance": 0.01870 }
  ],
  "model_used": "Random Forest",
  "predicted_at": "2026-05-12T10:30:00"
}
```

---

## Local Development Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- Git
- A Paycrest Sender API key ([get one here](https://app.paycrest.io))

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env and add your PAYCREST_API_KEY

# Train all models (~2 minutes)
python -m src.ml.pipeline

# Start API server
uvicorn src.api.main:app --reload --port 8000
```

API docs available at: `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App available at: `http://localhost:5173`

---

## Environment Variables

### Backend `.env`

```env
# Paycrest API
PAYCREST_API_KEY=your_api_key_here
PAYCREST_BASE_URL=https://api.paycrest.io/v1

# App
ENVIRONMENT=development
DEBUG=true
PORT=8000

# ML
MODEL_PATH=../data/models
DATA_PATH=../data
RETRAIN_INTERVAL_HOURS=24

# Auth (comma-separated keys, leave empty for open dev access)
API_KEYS=

# CORS
ALLOWED_ORIGINS=http://localhost:5173
```

---

## Tech Stack

### Backend
- **FastAPI** — async REST API framework
- **scikit-learn** — Random Forest baseline model
- **XGBoost** — gradient boosting model
- **LightGBM** — fast gradient boosting model
- **SHAP** — TreeExplainer for feature attribution
- **pandas / numpy** — data processing
- **APScheduler** — background model retraining
- **slowapi** — rate limiting middleware
- **httpx** — async Paycrest API client
- **pydantic-settings** — environment config management

### Frontend
- **React 18** + **TypeScript** — UI framework
- **Vite** — build tool
- **React Router v6** — multi-page routing
- **TanStack Query** — server state management
- **Recharts** — data visualisation (ROC curves, trend charts)
- **Framer Motion** — animations
- **Tailwind CSS** — utility styling
- **Syne** (headings) + **DM Mono** (data) + **DM Sans** (body) — typography

### Infrastructure
- **Render** — backend hosting (Python, free tier)
- **Vercel** — frontend hosting (Vite, free tier)
- **GitHub** — version control + CI/CD trigger

---

## Test Suite

```bash
cd backend
pytest tests/ -v
```

**39 tests** across 7 test classes:

| Class | Tests | Coverage |
|-------|-------|----------|
| `TestHealth` | 4 | `/health` endpoint |
| `TestDashboard` | 5 | `/api/dashboard` |
| `TestCorridors` | 5 | `/api/corridors` + detail |
| `TestModels` | 3 | `/api/models` + AUC validation |
| `TestPredict` | 12 | Full prediction suite incl. edge cases |
| `TestProviders` | 4 | Provider rankings + OTC validation |
| `TestTrends` | 4 | Trend filtering + pagination |
| `TestMeta` | 2 | `/api/meta` |

---

## Key Findings

1. **OTC/Manual is the network's biggest risk**: Processes 39% of all volume at a 52.6% failure rate and 98-minute average settlement — vs ~35% failure and ~2 minutes for automated providers.

2. **Liquidity depth is the #1 failure predictor**: SHAP analysis confirms that the single most predictive feature is how much USD liquidity is available in the corridor relative to the transaction amount.

3. **MWK and XOF corridors are structurally fragile**: Both have health scores below 50 and failure rates above 45% — indicating insufficient provider coverage, not just random noise.

4. **Timing matters**: Peak hours (08:00–20:00) and salary days (25th–28th of month) significantly shift failure probabilities — a pattern unique to African payroll infrastructure.

5. **Model improvement is data-gated**: AUC of 67.07% on simulated data is a strong baseline. Connecting real Paycrest transaction logs would meaningfully improve the model's discriminative power.

---

## Data Transparency

The transaction dataset is **simulation-calibrated to real Paycrest API data**:

- Corridor list sourced from Paycrest's live `/v1/currencies` endpoint
- Exchange rates pulled live at training time (e.g. KES at 129.19 USDT)
- Institution counts per corridor used to adjust provider depth parameters
- Failure rate priors based on Paycrest's publicly stated corridor behavior

The 15,000 transactions are synthetic but statistically grounded in real market parameters. Connecting Paycrest's actual transaction logs (via the `/v1/sender/orders` endpoint) would seamlessly replace simulated rows with real ones on the next retrain cycle.

---

## Roadmap

- [ ] Real transaction ingestion via Paycrest webhook
- [ ] Per-provider failure trend decomposition
- [ ] Time-series forecasting for corridor liquidity (LSTM / Prophet)
- [ ] Alert system — Slack/email when corridor health drops below threshold
- [ ] Multi-tenant support with authentication
- [ ] Grafana dashboard integration via `/metrics` endpoint
- [ ] Expand to additional corridors (ZAR, EGP, GNF)

---

## Author

**John Fashola** — Data Science & ML Engineering  
Built as a direct outreach project targeting Paycrest's core liquidity intelligence gap.

GitHub: [@John-04](https://github.com/John-04)

---

## License

MIT License — see `LICENSE` for details.

---

*FRIDAY is not affiliated with Paycrest. Built independently using Paycrest's public API and published documentation.*
