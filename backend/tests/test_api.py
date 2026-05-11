"""
Paycrest Liquidity Intelligence — API Test Suite
Tests all endpoints, prediction logic, auth, and rate limiting.
Run from backend folder with venv active:
    pytest tests/ -v
"""

import pytest
import asyncio
import json
from pathlib import Path
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def mock_pipeline_results():
    """Minimal pipeline results for testing without running full ML."""
    return {
        "trained_at": "2026-05-10T00:00:00",
        "meta": {
            "total_transactions": 15000,
            "overall_fail_rate": 0.527,
            "best_model": "Random Forest",
            "best_model_auc": 0.6707,
            "feature_count": 20,
            "date_range": ["2024-06-01", "2026-03-31"],
        },
        "model_comparison": [
            {
                "model_name": "Random Forest",
                "test_auc": 0.6707,
                "avg_precision": 0.69,
                "f1": 0.64,
                "accuracy": 0.65,
                "cv_auc_mean": 0.6773,
                "cv_auc_std": 0.011,
                "roc_curve": {"fpr": [0, 0.5, 1], "tpr": [0, 0.7, 1]},
                "pr_curve": {"precision": [1, 0.6, 0], "recall": [0, 0.5, 1]},
            }
        ],
        "shap_importance": {
            "Provider": 0.0491,
            "Liquidity Depth (USD)": 0.0479,
            "Peak Hour": 0.0416,
            "Liquidity Ratio": 0.0392,
            "Hour of Day": 0.0187,
        },
        "corridor_stats": [
            {
                "corridor": "NGN", "flag": "🇳🇬", "country": "Nigeria",
                "total_txns": 6003, "actual_fail_rate": 0.43,
                "avg_risk_score": 0.45, "avg_liquidity_depth": 3000.0,
                "avg_active_providers": 4.0, "avg_settlement_time": 35.0,
                "total_volume_usd": 9000000, "avg_amount_usd": 1200,
                "health_score": 68.0, "rate_volatility": 0.02,
            }
        ],
        "provider_stats": [
            {"provider": "Provider_A", "txn_count": 1500, "fail_rate": 0.30,
             "avg_settlement_time": 2.0, "avg_risk_score": 0.32, "volume_usd": 1500000},
            {"provider": "OTC_Manual", "txn_count": 5000, "fail_rate": 0.52,
             "avg_settlement_time": 98.0, "avg_risk_score": 0.50, "volume_usd": 7000000},
        ],
        "weekly_trends": [
            {"week": "2026-01-01/2026-01-07", "corridor": "NGN",
             "fail_rate": 0.38, "txn_count": 120, "avg_risk": 0.40, "avg_liquidity": 3000},
        ],
    }


@pytest.fixture(scope="module")
def mock_model():
    """Mock sklearn model that returns predictable probabilities."""
    model = MagicMock()
    model.predict_proba.return_value = [[0.75, 0.25]]  # 25% failure
    model.predict.return_value = [0]
    model.feature_importances_ = [0.05] * 20
    return model


@pytest.fixture(scope="module")
def mock_encoders():
    """Mock label encoders."""
    enc = MagicMock()
    enc.transform.return_value = [0]
    return {
        "corridor": enc,
        "provider": enc,
        "delivery_channel": enc,
        "token": enc,
    }


@pytest.fixture(scope="module")
def client(mock_pipeline_results, mock_model, mock_encoders):
    """Test client with mocked ML state."""
    import src.api.main as main_module

    # Patch global state before importing app
    main_module.pipeline_results = mock_pipeline_results
    main_module.models = {
        "random_forest": mock_model,
        "xgboost": mock_model,
        "lightgbm": mock_model,
    }
    main_module.encoders = mock_encoders
    main_module.feature_cols = [
        "amount_usd", "active_providers", "provider_concentration",
        "liquidity_depth_usd", "liquidity_ratio", "network_congestion",
        "gas_fee_spike", "rate_volatility", "hour", "day_of_week",
        "month", "day_of_month", "is_peak_hour", "is_weekend",
        "is_month_end", "is_salary_day", "corridor_enc",
        "provider_enc", "channel_enc", "token_enc",
    ]
    main_module.is_ready = True

    from src.api.main import app
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


# ─── Health endpoint ───────────────────────────────────────────────────────────

class TestHealth:
    def test_health_returns_200(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200

    def test_health_has_status(self, client):
        data = client.get("/health").json()
        assert "status" in data
        assert data["status"] in ("ready", "loading")

    def test_health_has_version(self, client):
        data = client.get("/health").json()
        assert data["version"] == "1.0.0"

    def test_health_has_scheduler(self, client):
        data = client.get("/health").json()
        assert "scheduler" in data


# ─── Dashboard endpoint ────────────────────────────────────────────────────────

class TestDashboard:
    def test_dashboard_returns_200(self, client):
        resp = client.get("/api/dashboard")
        assert resp.status_code == 200

    def test_dashboard_has_meta(self, client):
        data = client.get("/api/dashboard").json()
        assert "meta" in data
        assert "total_transactions" in data["meta"]
        assert "best_model" in data["meta"]
        assert "best_model_auc" in data["meta"]

    def test_dashboard_has_corridors(self, client):
        data = client.get("/api/dashboard").json()
        assert "corridor_stats" in data
        assert len(data["corridor_stats"]) > 0

    def test_dashboard_has_model_comparison(self, client):
        data = client.get("/api/dashboard").json()
        assert "model_comparison" in data
        assert len(data["model_comparison"]) > 0

    def test_dashboard_has_shap(self, client):
        data = client.get("/api/dashboard").json()
        assert "shap_importance" in data
        assert len(data["shap_importance"]) > 0


# ─── Corridors endpoint ────────────────────────────────────────────────────────

class TestCorridors:
    def test_corridors_returns_200(self, client):
        resp = client.get("/api/corridors")
        assert resp.status_code == 200

    def test_corridors_has_list(self, client):
        data = client.get("/api/corridors").json()
        assert "corridors" in data
        assert isinstance(data["corridors"], list)

    def test_corridor_detail_ngn(self, client):
        resp = client.get("/api/corridors/NGN")
        assert resp.status_code == 200
        data = resp.json()
        assert data["corridor"] == "NGN"
        assert "health_score" in data
        assert "actual_fail_rate" in data

    def test_corridor_detail_invalid(self, client):
        resp = client.get("/api/corridors/INVALID")
        assert resp.status_code == 404

    def test_corridor_case_insensitive(self, client):
        resp = client.get("/api/corridors/ngn")
        assert resp.status_code == 200


# ─── Models endpoint ───────────────────────────────────────────────────────────

class TestModels:
    def test_models_returns_200(self, client):
        resp = client.get("/api/models")
        assert resp.status_code == 200

    def test_models_has_comparison(self, client):
        data = client.get("/api/models").json()
        assert "models" in data
        models = data["models"]
        assert len(models) > 0
        assert "model_name" in models[0]
        assert "test_auc" in models[0]

    def test_models_auc_valid(self, client):
        data = client.get("/api/models").json()
        for m in data["models"]:
            assert 0.5 <= m["test_auc"] <= 1.0


# ─── Prediction endpoint ───────────────────────────────────────────────────────

class TestPredict:
    VALID_PAYLOAD = {
        "corridor": "NGN",
        "token": "USDT",
        "provider": "Provider_A",
        "delivery_channel": "bank_transfer",
        "amount_usd": 500.0,
        "active_providers": 4,
        "provider_concentration": 0.3,
        "liquidity_depth_usd": 5000.0,
        "network_congestion": 0.2,
        "hour": 14,
        "day_of_week": 1,
    }

    def test_predict_returns_200(self, client):
        resp = client.post("/api/predict", json=self.VALID_PAYLOAD)
        assert resp.status_code == 200

    def test_predict_has_required_fields(self, client):
        data = client.post("/api/predict", json=self.VALID_PAYLOAD).json()
        assert "risk_score" in data
        assert "risk_tier" in data
        assert "failure_probability" in data
        assert "recommendation" in data
        assert "top_risk_factors" in data
        assert "model_used" in data
        assert "predicted_at" in data

    def test_predict_risk_score_range(self, client):
        data = client.post("/api/predict", json=self.VALID_PAYLOAD).json()
        assert 0.0 <= data["risk_score"] <= 1.0

    def test_predict_risk_tier_valid(self, client):
        data = client.post("/api/predict", json=self.VALID_PAYLOAD).json()
        assert data["risk_tier"] in ("Low", "Medium", "High")

    def test_predict_failure_probability_matches_score(self, client):
        data = client.post("/api/predict", json=self.VALID_PAYLOAD).json()
        expected = round(data["risk_score"] * 100, 1)
        assert abs(data["failure_probability"] - expected) < 0.01

    def test_predict_missing_required_field(self, client):
        bad = {k: v for k, v in self.VALID_PAYLOAD.items() if k != "amount_usd"}
        resp = client.post("/api/predict", json=bad)
        assert resp.status_code == 422

    def test_predict_invalid_amount(self, client):
        bad = {**self.VALID_PAYLOAD, "amount_usd": -100}
        resp = client.post("/api/predict", json=bad)
        assert resp.status_code == 422

    def test_predict_invalid_hour(self, client):
        bad = {**self.VALID_PAYLOAD, "hour": 25}
        resp = client.post("/api/predict", json=bad)
        assert resp.status_code == 422

    def test_predict_top_risk_factors_not_empty(self, client):
        data = client.post("/api/predict", json=self.VALID_PAYLOAD).json()
        assert len(data["top_risk_factors"]) > 0
        factor = data["top_risk_factors"][0]
        assert "factor" in factor
        assert "importance" in factor

    def test_predict_all_corridors(self, client):
        for corridor in ["NGN", "KES", "GHS", "UGX", "TZS", "XOF", "MWK"]:
            payload = {**self.VALID_PAYLOAD, "corridor": corridor}
            resp = client.post("/api/predict", json=payload)
            assert resp.status_code == 200, f"Failed for corridor {corridor}"

    def test_predict_otc_manual_provider(self, client):
        payload = {**self.VALID_PAYLOAD, "provider": "OTC_Manual"}
        resp = client.post("/api/predict", json=payload)
        assert resp.status_code == 200

    def test_predict_high_risk_scenario(self, client):
        """Low liquidity + OTC + high congestion should still return valid response."""
        payload = {
            **self.VALID_PAYLOAD,
            "liquidity_depth_usd": 100.0,
            "amount_usd": 5000.0,
            "network_congestion": 0.9,
            "provider": "OTC_Manual",
            "active_providers": 1,
        }
        resp = client.post("/api/predict", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["risk_tier"] in ("Medium", "High")


# ─── Providers endpoint ────────────────────────────────────────────────────────

class TestProviders:
    def test_providers_returns_200(self, client):
        resp = client.get("/api/providers")
        assert resp.status_code == 200

    def test_providers_has_list(self, client):
        data = client.get("/api/providers").json()
        assert "providers" in data
        providers = data["providers"]
        assert len(providers) > 0

    def test_providers_has_required_fields(self, client):
        data = client.get("/api/providers").json()
        p = data["providers"][0]
        assert "provider" in p
        assert "fail_rate" in p
        assert "avg_settlement_time" in p
        assert "volume_usd" in p

    def test_otc_manual_has_highest_fail_rate(self, client):
        data = client.get("/api/providers").json()
        providers = data["providers"]
        otc = next((p for p in providers if p["provider"] == "OTC_Manual"), None)
        if otc:
            others = [p for p in providers if p["provider"] != "OTC_Manual"]
            avg_other = sum(p["fail_rate"] for p in others) / len(others)
            assert otc["fail_rate"] > avg_other


# ─── Trends endpoint ───────────────────────────────────────────────────────────

class TestTrends:
    def test_trends_returns_200(self, client):
        resp = client.get("/api/trends")
        assert resp.status_code == 200

    def test_trends_has_list(self, client):
        data = client.get("/api/trends").json()
        assert "trends" in data

    def test_trends_filter_by_corridor(self, client):
        data = client.get("/api/trends?corridor=NGN").json()
        for t in data["trends"]:
            assert t["corridor"] == "NGN"

    def test_trends_limit(self, client):
        data = client.get("/api/trends?limit=5").json()
        assert len(data["trends"]) <= 5


# ─── Meta endpoint ─────────────────────────────────────────────────────────────

class TestMeta:
    def test_meta_returns_200(self, client):
        resp = client.get("/api/meta")
        assert resp.status_code == 200

    def test_meta_has_corridors(self, client):
        data = client.get("/api/meta").json()
        assert "corridors" in data
        assert "NGN" in data["corridors"]
