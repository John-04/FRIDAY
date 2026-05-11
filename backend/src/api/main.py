"""
Paycrest Liquidity Intelligence API
FastAPI — auth, rate limiting, scheduler, structured logging.
"""

import logging
import joblib
import time
import pandas as pd
from datetime import datetime
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pydantic import BaseModel, Field

from ..config.settings import settings
from ..config.auth import verify_api_key
from ..config.scheduler import start_scheduler, stop_scheduler, get_scheduler_status
from ..config.logger import setup_logging, RequestLogger
from ..ml.pipeline import run_full_pipeline
from ..data.fetcher import get_live_rates, CORRIDOR_META

# Set up structured logging first
setup_logging()
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)

pipeline_results: dict = {}
models: dict = {}
encoders: dict = {}
feature_cols: list = []
is_ready: bool = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    global pipeline_results, models, encoders, feature_cols, is_ready
    logger.info("Starting Paycrest Liquidity Intelligence API...")
    try:
        pipeline_results = await run_full_pipeline()
        model_dir = settings.model_path
        for name in ["random_forest", "xgboost", "lightgbm"]:
            path = model_dir / f"{name}.pkl"
            if path.exists():
                models[name] = joblib.load(path)
        enc_path = model_dir / "encoders.pkl"
        if enc_path.exists():
            encoders = joblib.load(enc_path)
        feat_path = model_dir / "feature_cols.pkl"
        if feat_path.exists():
            feature_cols = joblib.load(feat_path)
        is_ready = True
        logger.info("✓ API ready — all models loaded")
        start_scheduler()
    except Exception as e:
        logger.error(f"Startup error: {e}", exc_info=True)
    yield
    stop_scheduler()
    logger.info("API shut down cleanly")


app = FastAPI(
    title="Paycrest Liquidity Intelligence API",
    description="ML-powered transaction failure prediction and corridor health monitoring",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request timing middleware ────────────────────────────────────────────────

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    # Only log API calls, not static/docs
    if request.url.path.startswith("/api") or request.url.path == "/health":
        RequestLogger.log_request(
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=duration_ms,
            client_ip=request.client.host if request.client else "",
        )
    return response


# ─── Schemas ──────────────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    corridor: str = Field(..., example="NGN")
    token: str = Field("USDT", example="USDT")
    provider: str = Field("Provider_A", example="Provider_A")
    delivery_channel: str = Field("bank_transfer", example="bank_transfer")
    amount_usd: float = Field(..., gt=0, example=500.0)
    active_providers: int = Field(4, ge=1, le=7)
    provider_concentration: float = Field(0.3, ge=0, le=1)
    liquidity_depth_usd: float = Field(5000.0, gt=0)
    network_congestion: float = Field(0.2, ge=0, le=1)
    hour: int = Field(14, ge=0, le=23)
    day_of_week: int = Field(1, ge=0, le=6)


class PredictResponse(BaseModel):
    risk_score: float
    risk_tier: str
    failure_probability: float
    recommendation: str
    top_risk_factors: list[dict]
    model_used: str
    predicted_at: str


# ─── Public routes ────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
async def health():
    return {
        "status": "ready" if is_ready else "loading",
        "version": "1.0.0",
        "environment": settings.environment,
        "scheduler": get_scheduler_status(),
    }


# ─── Protected routes ─────────────────────────────────────────────────────────

@app.get("/api/dashboard", tags=["Dashboard"])
@limiter.limit("60/minute")
async def get_dashboard(request: Request, _key: str = Depends(verify_api_key)):
    if not pipeline_results:
        raise HTTPException(503, "Pipeline not ready")
    return pipeline_results


@app.get("/api/corridors", tags=["Corridors"])
@limiter.limit("60/minute")
async def get_corridors(request: Request, _key: str = Depends(verify_api_key)):
    if not pipeline_results:
        raise HTTPException(503, "Pipeline not ready")
    return {"corridors": pipeline_results.get("corridor_stats", [])}


@app.get("/api/corridors/{corridor}", tags=["Corridors"])
@limiter.limit("60/minute")
async def get_corridor(corridor: str, request: Request, _key: str = Depends(verify_api_key)):
    corridors = pipeline_results.get("corridor_stats", [])
    match = next((c for c in corridors if c["corridor"] == corridor.upper()), None)
    if not match:
        raise HTTPException(404, f"Corridor {corridor} not found")
    return match


@app.get("/api/models", tags=["Models"])
@limiter.limit("30/minute")
async def get_models(request: Request, _key: str = Depends(verify_api_key)):
    if not pipeline_results:
        raise HTTPException(503, "Pipeline not ready")
    return {
        "models": pipeline_results.get("model_comparison", []),
        "shap_importance": pipeline_results.get("shap_importance", {}),
        "meta": pipeline_results.get("meta", {}),
    }


@app.get("/api/trends", tags=["Analytics"])
@limiter.limit("30/minute")
async def get_trends(
    request: Request,
    corridor: Optional[str] = None,
    limit: int = 200,
    _key: str = Depends(verify_api_key),
):
    trends = pipeline_results.get("weekly_trends", [])
    if corridor:
        trends = [t for t in trends if t["corridor"] == corridor.upper()]
    return {"trends": trends[:limit]}


@app.get("/api/providers", tags=["Analytics"])
@limiter.limit("30/minute")
async def get_providers(request: Request, _key: str = Depends(verify_api_key)):
    if not pipeline_results:
        raise HTTPException(503, "Pipeline not ready")
    return {"providers": pipeline_results.get("provider_stats", [])}


@app.get("/api/rates", tags=["Rates"])
@limiter.limit("30/minute")
async def get_rates(request: Request, _key: str = Depends(verify_api_key)):
    rates = await get_live_rates()
    return {"rates": rates, "fetched_at": datetime.now().isoformat()}


@app.post("/api/predict", response_model=PredictResponse, tags=["Prediction"])
@limiter.limit("30/minute")
async def predict(
    req: PredictRequest,
    request: Request,
    _key: str = Depends(verify_api_key),
):
    if not models or "random_forest" not in models:
        raise HTTPException(503, "Models not loaded")

    t0 = time.perf_counter()
    best_name = pipeline_results.get("meta", {}).get("best_model", "Random Forest")
    model_key = best_name.replace(" ", "_").lower()
    model = models.get(model_key, models.get("random_forest"))

    def safe_encode(enc, val, fallback=0):
        try:
            return int(enc.transform([val])[0])
        except Exception:
            return fallback

    month = datetime.now().month
    dom = datetime.now().day

    features = {
        "amount_usd": req.amount_usd,
        "active_providers": req.active_providers,
        "provider_concentration": req.provider_concentration,
        "liquidity_depth_usd": req.liquidity_depth_usd,
        "liquidity_ratio": req.liquidity_depth_usd / (req.amount_usd + 1),
        "network_congestion": req.network_congestion,
        "gas_fee_spike": 0,
        "rate_volatility": 0.01,
        "hour": req.hour,
        "day_of_week": req.day_of_week,
        "month": month,
        "day_of_month": dom,
        "is_peak_hour": 1 if 8 <= req.hour <= 20 else 0,
        "is_weekend": 1 if req.day_of_week >= 5 else 0,
        "is_month_end": 1 if dom >= 25 else 0,
        "is_salary_day": 1 if dom in [25, 26, 27, 28] else 0,
        "corridor_enc": safe_encode(encoders.get("corridor"), req.corridor),
        "provider_enc": safe_encode(encoders.get("provider"), req.provider),
        "channel_enc": safe_encode(encoders.get("delivery_channel"), req.delivery_channel),
        "token_enc": safe_encode(encoders.get("token"), req.token),
    }

    X = pd.DataFrame([features])[feature_cols if feature_cols else list(features.keys())]
    risk_score = float(model.predict_proba(X)[0][1])
    tier = "Low" if risk_score < 0.35 else "Medium" if risk_score < 0.60 else "High"
    rec_map = {
        "Low":    "Transaction looks healthy. Proceed normally.",
        "Medium": "Moderate risk. Consider routing to a higher-rated provider.",
        "High":   "High failure risk. Recommend delaying or rerouting to increase liquidity.",
    }
    shap_imp = pipeline_results.get("shap_importance", {})
    top_factors = [{"factor": k, "importance": v} for k, v in list(shap_imp.items())[:5]]

    duration_ms = (time.perf_counter() - t0) * 1000
    RequestLogger.log_prediction(req.corridor, risk_score, tier, best_name, duration_ms)

    return PredictResponse(
        risk_score=round(risk_score, 4),
        risk_tier=tier,
        failure_probability=round(risk_score * 100, 1),
        recommendation=rec_map[tier],
        top_risk_factors=top_factors,
        model_used=best_name,
        predicted_at=datetime.now().isoformat(),
    )


@app.post("/api/retrain", tags=["System"])
@limiter.limit("5/hour")
async def retrain(
    request: Request,
    background_tasks: BackgroundTasks,
    _key: str = Depends(verify_api_key),
):
    global pipeline_results, is_ready
    is_ready = False

    async def do_retrain():
        global pipeline_results, is_ready
        t0 = time.perf_counter()
        try:
            pipeline_results = await run_full_pipeline(force_retrain=True)
            is_ready = True
            RequestLogger.log_retrain(
                trigger="manual",
                success=True,
                best_model=pipeline_results["meta"]["best_model"],
                auc=pipeline_results["meta"]["best_model_auc"],
                duration_s=time.perf_counter() - t0,
            )
        except Exception as e:
            is_ready = True
            RequestLogger.log_retrain("manual", False, error=str(e))

    background_tasks.add_task(do_retrain)
    return {"message": "Retraining started in background"}


@app.get("/api/scheduler", tags=["System"])
async def scheduler_status(request: Request, _key: str = Depends(verify_api_key)):
    return get_scheduler_status()


@app.get("/api/meta", tags=["System"])
@limiter.limit("30/minute")
async def get_meta(request: Request, _key: str = Depends(verify_api_key)):
    return {"corridors": CORRIDOR_META}
