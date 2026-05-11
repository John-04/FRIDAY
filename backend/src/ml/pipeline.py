"""
Paycrest Liquidity Intelligence — Full ML Pipeline

Models: Random Forest (baseline) + XGBoost + LightGBM
Explainability: SHAP values for all models
Evaluation: 5-fold StratifiedKFold CV + test set metrics
"""

import logging
import joblib
import json
import asyncio
import numpy as np
import pandas as pd
import shap
from pathlib import Path
from datetime import datetime

from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import (
    roc_auc_score, average_precision_score, classification_report,
    confusion_matrix, roc_curve, precision_recall_curve, f1_score
)
from sklearn.pipeline import Pipeline
from sklearn.calibration import CalibratedClassifierCV

import xgboost as xgb
import lightgbm as lgb

from ..data.fetcher import load_or_generate_data
from ..config.settings import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

FEATURE_COLS = [
    "amount_usd", "active_providers", "provider_concentration",
    "liquidity_depth_usd", "liquidity_ratio", "network_congestion",
    "gas_fee_spike", "rate_volatility",
    "hour", "day_of_week", "month", "day_of_month",
    "is_peak_hour", "is_weekend", "is_month_end", "is_salary_day",
    "corridor_enc", "provider_enc", "channel_enc", "token_enc",
]

TARGET_COL = "transaction_failed"

FEATURE_NAMES_DISPLAY = {
    "liquidity_depth_usd": "Liquidity Depth (USD)",
    "liquidity_ratio": "Liquidity Ratio",
    "is_peak_hour": "Peak Hour",
    "corridor_enc": "Corridor",
    "provider_enc": "Provider",
    "hour": "Hour of Day",
    "is_month_end": "Month-End Flag",
    "active_providers": "Active Providers",
    "amount_usd": "Transaction Amount",
    "network_congestion": "Network Congestion",
    "rate_volatility": "Rate Volatility",
    "gas_fee_spike": "Gas Fee Spike",
    "provider_concentration": "Provider Concentration",
    "day_of_week": "Day of Week",
    "month": "Month",
    "day_of_month": "Day of Month",
    "is_weekend": "Weekend Flag",
    "is_salary_day": "Salary Day",
    "channel_enc": "Delivery Channel",
    "token_enc": "Stablecoin Token",
}


def engineer_features(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Encode categoricals and return encoders for inference."""
    df = df.copy()
    encoders = {}

    for col, enc_col in [
        ("corridor", "corridor_enc"),
        ("provider", "provider_enc"),
        ("delivery_channel", "channel_enc"),
        ("token", "token_enc"),
    ]:
        le = LabelEncoder()
        df[enc_col] = le.fit_transform(df[col].astype(str))
        encoders[col] = le

    return df, encoders


def evaluate_model(model, X_test, y_test, model_name: str) -> dict:
    """Full evaluation suite for a single model."""
    y_prob = model.predict_proba(X_test)[:, 1]
    y_pred = model.predict(X_test)

    fpr, tpr, roc_thresh = roc_curve(y_test, y_prob)
    prec, rec, pr_thresh = precision_recall_curve(y_test, y_prob)

    # Downsample curves for JSON storage
    step = max(1, len(fpr) // 100)
    report = classification_report(y_test, y_pred, output_dict=True)

    return {
        "model_name": model_name,
        "test_auc": float(roc_auc_score(y_test, y_prob)),
        "avg_precision": float(average_precision_score(y_test, y_prob)),
        "f1": float(f1_score(y_test, y_pred)),
        "accuracy": float(report["accuracy"]),
        "precision_class1": float(report["1"]["precision"]),
        "recall_class1": float(report["1"]["recall"]),
        "classification_report": report,
        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
        "roc_curve": {
            "fpr": fpr[::step].tolist(),
            "tpr": tpr[::step].tolist(),
        },
        "pr_curve": {
            "precision": prec[::step].tolist(),
            "recall": rec[::step].tolist(),
        },
    }


def compute_shap(model, X_sample: pd.DataFrame, model_name: str) -> dict:
    """Compute SHAP feature importance."""
    logger.info(f"Computing SHAP for {model_name}...")
    try:
        explainer = shap.TreeExplainer(model)
        shap_result = explainer(X_sample)
        
        if hasattr(shap_result, 'values'):
            sv = np.array(shap_result.values)
        else:
            sv = np.array(shap_result)

        if sv.ndim == 3:
            sv = sv[:, :, 1]

        mean_abs = np.abs(sv).mean(axis=0)
        importance = {
            FEATURE_NAMES_DISPLAY.get(f, f): round(float(v), 5)
            for f, v in zip(X_sample.columns.tolist(), mean_abs)
        }
        importance = dict(sorted(importance.items(), key=lambda x: x[1], reverse=True))
        return importance

    except Exception as e:
        logger.error(f"SHAP failed for {model_name}: {e}")
        return {}


def compute_corridor_analytics(df: pd.DataFrame) -> list[dict]:
    """Compute per-corridor health metrics."""
    df = df.copy()
    stats = df.groupby("corridor").agg(
        total_txns=("transaction_failed", "count"),
        actual_fail_rate=("transaction_failed", "mean"),
        avg_risk_score=("failure_prob_true", "mean"),
        avg_liquidity_depth=("liquidity_depth_usd", "mean"),
        avg_active_providers=("active_providers", "mean"),
        avg_settlement_time=("settlement_time_min", "mean"),
        total_volume_usd=("amount_usd", "sum"),
        avg_amount_usd=("amount_usd", "mean"),
        rate_volatility=("rate_volatility", "mean"),
    ).reset_index()

    max_liq = stats["avg_liquidity_depth"].max()
    max_prov = 7

    stats["health_score"] = (
        (1 - stats["actual_fail_rate"]) * 0.40 +
        (stats["avg_active_providers"] / max_prov) * 0.30 +
        (stats["avg_liquidity_depth"] / max_liq) * 0.30
    ) * 100

    from ..data.fetcher import CORRIDOR_META
    stats["flag"] = stats["corridor"].map(lambda c: CORRIDOR_META.get(c, {}).get("flag", "🌍"))
    stats["country"] = stats["corridor"].map(lambda c: CORRIDOR_META.get(c, {}).get("country", c))

    return stats.round(3).to_dict(orient="records")


def compute_weekly_trends(df: pd.DataFrame) -> list[dict]:
    """Compute weekly per-corridor failure rate trends."""
    df = df.copy()
    df["week"] = df["timestamp"].dt.to_period("W").astype(str)
    weekly = df.groupby(["week", "corridor"]).agg(
        fail_rate=("transaction_failed", "mean"),
        txn_count=("transaction_failed", "count"),
        avg_risk=("failure_prob_true", "mean"),
        avg_liquidity=("liquidity_depth_usd", "mean"),
    ).reset_index()
    return weekly.round(4).to_dict(orient="records")


def compute_provider_stats(df: pd.DataFrame) -> list[dict]:
    """Provider performance ranking."""
    stats = df.groupby("provider").agg(
        txn_count=("transaction_failed", "count"),
        fail_rate=("transaction_failed", "mean"),
        avg_settlement_time=("settlement_time_min", "mean"),
        avg_risk_score=("failure_prob_true", "mean"),
        volume_usd=("amount_usd", "sum"),
    ).reset_index().sort_values("fail_rate")
    return stats.round(3).to_dict(orient="records")


async def run_full_pipeline(force_retrain: bool = False) -> dict:
    """
    Main pipeline entry point.
    Returns full results dict for API serving.
    """
    model_dir = settings.model_path
    model_dir.mkdir(parents=True, exist_ok=True)
    results_path = model_dir / "results.json"

    if results_path.exists() and not force_retrain:
        logger.info("Loading cached pipeline results...")
        with open(results_path) as f:
            return json.load(f)

    logger.info("═══════ Running Full ML Pipeline ═══════")

    # ── 1. Data ─────────────────────────────────────────────────────────
    df = await load_or_generate_data(force_regenerate=force_retrain)
    df, encoders = engineer_features(df)

    X = df[FEATURE_COLS]
    y = df[TARGET_COL]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    logger.info(f"Train: {len(X_train)} | Test: {len(X_test)} | Failure rate: {y.mean():.1%}")

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    # ── 2. Models ───────────────────────────────────────────────────────
    model_configs = {
        "Random Forest": RandomForestClassifier(
            n_estimators=300, max_depth=12, min_samples_leaf=5,
            class_weight="balanced", random_state=42, n_jobs=-1
        ),
        "XGBoost": xgb.XGBClassifier(
            n_estimators=300, max_depth=6, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8, scale_pos_weight=(y==0).sum()/(y==1).sum(),
            eval_metric="logloss", random_state=42, verbosity=0
        ),
        "LightGBM": lgb.LGBMClassifier(
            n_estimators=300, max_depth=8, learning_rate=0.05,
            num_leaves=63, subsample=0.8, class_weight="balanced",
            random_state=42, verbose=-1
        ),
    }

    model_results = []
    trained_models = {}
    best_model = None
    best_auc = 0

    for name, model in model_configs.items():
        logger.info(f"Training {name}...")

        cv_scores = cross_val_score(model, X_train, y_train, cv=cv, scoring="roc_auc", n_jobs=-1)
        model.fit(X_train, y_train)

        eval_result = evaluate_model(model, X_test, y_test, name)
        eval_result["cv_auc_mean"] = float(cv_scores.mean())
        eval_result["cv_auc_std"] = float(cv_scores.std())

        model_results.append(eval_result)
        trained_models[name] = model

        logger.info(
            f"  CV AUC: {cv_scores.mean():.4f} ± {cv_scores.std():.4f} | "
            f"Test AUC: {eval_result['test_auc']:.4f} | "
            f"AP: {eval_result['avg_precision']:.4f}"
        )

        if eval_result["test_auc"] > best_auc:
            best_auc = eval_result["test_auc"]
            best_model = (name, model)

    # ── 3. SHAP (best model) ─────────────────────────────────────────────
    logger.info(f"Best model: {best_model[0]} (AUC={best_auc:.4f})")
    shap_sample = X_test.sample(min(500, len(X_test)), random_state=42)
    shap_importance = compute_shap(best_model[1], shap_sample, best_model[0])

    # ── 4. Analytics ─────────────────────────────────────────────────────
    df["risk_score"] = best_model[1].predict_proba(X)[:, 1]
    corridor_stats = compute_corridor_analytics(df)
    weekly_trends = compute_weekly_trends(df)
    provider_stats = compute_provider_stats(df)

    # ── 5. Save everything ───────────────────────────────────────────────
    for name, model in trained_models.items():
        joblib.dump(model, model_dir / f"{name.replace(' ', '_').lower()}.pkl")
    joblib.dump(encoders, model_dir / "encoders.pkl")
    joblib.dump(X.columns.tolist(), model_dir / "feature_cols.pkl")

    results = {
        "trained_at": datetime.now().isoformat(),
        "meta": {
            "total_transactions": int(len(df)),
            "overall_fail_rate": round(float(y.mean()), 4),
            "best_model": best_model[0],
            "best_model_auc": round(best_auc, 4),
            "feature_count": len(FEATURE_COLS),
            "date_range": [
                str(df["timestamp"].min().date()),
                str(df["timestamp"].max().date()),
            ],
        },
        "model_comparison": model_results,
        "shap_importance": shap_importance,
        "corridor_stats": corridor_stats,
        "provider_stats": provider_stats,
        "weekly_trends": weekly_trends[:200],  # cap for JSON size
    }

    with open(results_path, "w") as f:
        json.dump(results, f, indent=2, default=str)

    logger.info(f"✓ Pipeline complete. Results saved to {results_path}")
    return results


if __name__ == "__main__":
    import sys
    force = "--force" in sys.argv
    results = asyncio.run(run_full_pipeline(force_retrain=force))
    print(f"\n✓ Best model: {results['meta']['best_model']} | AUC: {results['meta']['best_model_auc']}")
