# FRIDAY Intelligence System

A full-stack data science solution that predicts transaction failures, monitors corridor health, and surfaces liquidity gaps across Paycrest's African payment network.

## Architecture

```
paycrest-intelligence/
├── frontend/          # React + Vite + TypeScript (Paycrest-styled UI)
├── backend/           # FastAPI + Python ML pipeline
├── data/              # Raw, processed data and saved models
└── .vscode/           # VSCode workspace settings
```

## Step-by-Step Setup

### Prerequisites
- Node.js 18+ and npm
- Python 3.10+
- Git

---

### Step 1 — Clone and enter the project
```bash
git clone <your-repo>
cd paycrest-intelligence
```

### Step 2 — Backend setup
```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Step 3 — Configure environment variables
```bash
cp .env.example .env
# Edit .env and add your Paycrest API key if available
```

### Step 4 — Run the ML pipeline (trains + saves models)
```bash
cd backend
python -m src.ml.pipeline
```

### Step 5 — Start the backend API
```bash
cd backend
uvicorn src.api.main:app --reload --port 8000
```
API docs available at: http://localhost:8000/docs

### Step 6 — Frontend setup (new terminal)
```bash
cd frontend
npm install
npm run dev
```
App available at: http://localhost:5173

---

## Data Sources
- **Real data**: Paycrest public API (rates, corridors)
- **Augmented**: Simulated transaction history based on real corridor parameters
- **Live**: Noblocks rates API for real-time stablecoin rates

## ML Models
| Model | CV AUC | Notes |
|-------|--------|-------|
| Random Forest | 0.64 | Best explainability (SHAP) |
| XGBoost | 0.64 | Best speed |
| LightGBM | 0.62 | Most memory efficient |

## Key Findings
- Liquidity depth is the #1 failure predictor (SHAP)
- OTC/Manual routing has 22x worse settlement time
- MWK corridor needs urgent provider expansion
