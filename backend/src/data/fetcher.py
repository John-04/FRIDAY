"""
Paycrest Liquidity Intelligence — Real Data Fetcher

Data priority:
  1. Paycrest /v1/currencies  → real live rates, real corridors, real institutions
  2. Paycrest /v1/sender/orders → your real orders (grows as you use the API)
  3. Simulation calibrated from real corridor rates above
"""

import httpx
import asyncio
import logging
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from ..config.settings import settings

logger = logging.getLogger(__name__)

# ─── Fallback corridor metadata (used if API unavailable) ───────────────────
CORRIDOR_META = {
    "NGN": {"country": "Nigeria",     "flag": "🇳🇬", "channel": "bank_transfer", "base_fail": 0.22, "avg_usd": 1200, "volume_rank": 1},
    "KES": {"country": "Kenya",       "flag": "🇰🇪", "channel": "mobile_money",  "base_fail": 0.18, "avg_usd": 850,  "volume_rank": 2},
    "GHS": {"country": "Ghana",       "flag": "🇬🇭", "channel": "bank_transfer", "base_fail": 0.25, "avg_usd": 600,  "volume_rank": 3},
    "UGX": {"country": "Uganda",      "flag": "🇺🇬", "channel": "mobile_money",  "base_fail": 0.30, "avg_usd": 400,  "volume_rank": 4},
    "TZS": {"country": "Tanzania",    "flag": "🇹🇿", "channel": "mobile_money",  "base_fail": 0.28, "avg_usd": 380,  "volume_rank": 5},
    "XOF": {"country": "West Africa", "flag": "🇧🇯", "channel": "bank_transfer", "base_fail": 0.32, "avg_usd": 320,  "volume_rank": 6},
    "MWK": {"country": "Malawi",      "flag": "🇲🇼", "channel": "bank_transfer", "base_fail": 0.38, "avg_usd": 200,  "volume_rank": 7},
}

# Country code → flag mapping
FLAG_MAP = {
    "NG": "🇳🇬", "KE": "🇰🇪", "GH": "🇬🇭", "UG": "🇺🇬",
    "TZ": "🇹🇿", "BJ": "🇧🇯", "CI": "🇨🇮", "SN": "🇸🇳",
    "MW": "🇲🇼", "CM": "🇨🇲", "ZA": "🇿🇦", "RW": "🇷🇼",
}

STABLECOINS = ["USDT", "USDC", "cNGN"]


def _paycrest_headers() -> dict:
    """Correct Paycrest API header format (API-Key, not Bearer)."""
    return {
        "API-Key": settings.paycrest_api_key,
        "Content-Type": "application/json",
    }


async def fetch_paycrest_currencies() -> dict:
    """
    Fetch live currencies + rates from Paycrest API.
    Returns dict keyed by currency code with rate, institutions, etc.
    Uses correct API-Key header (not Bearer token).
    """
    if not settings.paycrest_api_key:
        logger.warning("No Paycrest API key configured")
        return {}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"{settings.paycrest_base_url}/currencies",
                headers=_paycrest_headers(),
            )
            if resp.status_code == 200:
                data = resp.json()
                currencies = {}
                items = data.get("data", data) if isinstance(data, dict) else data
                if isinstance(items, list):
                    for item in items:
                        code = item.get("code", "")
                        if code:
                            currencies[code] = {
                                "name": item.get("name", code),
                                "symbol": item.get("symbol", ""),
                                "market_buy_rate": float(item.get("marketBuyRate", 0) or 0),
                                "market_sell_rate": float(item.get("marketSellRate", 0) or 0),
                                "decimals": item.get("decimals", 2),
                                "institutions": item.get("institutions", []),
                            }
                logger.info(f"✓ Fetched {len(currencies)} live currencies from Paycrest API")
                return currencies
            else:
                logger.warning(f"Paycrest currencies API returned {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        logger.warning(f"Paycrest currencies API unavailable: {e}")
    return {}


async def fetch_paycrest_orders() -> list[dict]:
    """
    Fetch your real sender orders from Paycrest API.
    These are real transactions — used directly in the dataset when available.
    """
    if not settings.paycrest_api_key:
        return []
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"{settings.paycrest_base_url}/sender/orders",
                headers=_paycrest_headers(),
                params={"page": 1, "pageSize": 100},
            )
            if resp.status_code == 200:
                data = resp.json()
                orders = data.get("data", [])
                if isinstance(orders, dict):
                    orders = orders.get("orders", [])
                logger.info(f"✓ Fetched {len(orders)} real orders from Paycrest API")
                return orders if isinstance(orders, list) else []
            else:
                logger.warning(f"Paycrest orders API returned {resp.status_code}")
    except Exception as e:
        logger.warning(f"Paycrest orders API unavailable: {e}")
    return []


def _build_corridor_meta_from_api(currencies: dict) -> dict:
    """
    Build enriched CORRIDOR_META using real API data.
    Merges live rates into the base metadata.
    """
    meta = {}
    for code, fallback in CORRIDOR_META.items():
        entry = dict(fallback)
        if code in currencies:
            api_data = currencies[code]
            entry["live_buy_rate"] = api_data["market_buy_rate"]
            entry["live_sell_rate"] = api_data["market_sell_rate"]
            entry["name"] = api_data["name"]
            entry["institutions_count"] = len(api_data.get("institutions", []))
            entry["data_source"] = "live"
            # Use institution count as a proxy for provider depth
            if entry["institutions_count"] > 5:
                entry["base_fail"] = max(0.12, fallback["base_fail"] - 0.05)
            elif entry["institutions_count"] < 3:
                entry["base_fail"] = min(0.55, fallback["base_fail"] + 0.08)
        else:
            entry["live_buy_rate"] = None
            entry["live_sell_rate"] = None
            entry["data_source"] = "simulated"
        meta[code] = entry

    # Add any extra corridors from API not in our default set
    for code, api_data in currencies.items():
        if code not in meta and len(code) == 3:
            meta[code] = {
                "country": api_data["name"],
                "flag": "🌍",
                "channel": "bank_transfer",
                "base_fail": 0.30,
                "avg_usd": 500,
                "volume_rank": len(meta) + 1,
                "live_buy_rate": api_data["market_buy_rate"],
                "live_sell_rate": api_data["market_sell_rate"],
                "data_source": "live",
            }
    return meta


def _real_orders_to_df(orders: list[dict], corridor_meta: dict) -> pd.DataFrame:
    """Convert real Paycrest API orders into our transaction dataframe format."""
    rows = []
    for order in orders:
        try:
            amount = float(order.get("amount", 0) or 0)
            rate = float(order.get("rate", 1) or 1)
            amount_usd = amount  # amount is already in stablecoin (≈ USD)
            status = order.get("status", "")
            failed = 1 if status in ["expired", "refunded"] else 0
            settled = 1 if status == "settled" else 0

            created_at = order.get("createdAt", "")
            updated_at = order.get("updatedAt", "")
            try:
                ts = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                if updated_at and settled:
                    ts_end = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
                    settlement_min = (ts_end - ts).total_seconds() / 60
                else:
                    settlement_min = 5.0
            except Exception:
                ts = datetime.now()
                settlement_min = 5.0

            recipient = order.get("recipient", {})
            institution = recipient.get("institution", "")

            # Try to infer corridor from rate and institution
            corridor = "NGN"  # default
            for code, meta in corridor_meta.items():
                rate_val = meta.get("live_buy_rate") or 0
                if rate_val > 0 and abs(rate - rate_val) / rate_val < 0.15:
                    corridor = code
                    break

            meta = corridor_meta.get(corridor, CORRIDOR_META.get(corridor, CORRIDOR_META["NGN"]))
            hour = ts.hour
            dow = ts.weekday()
            dom = ts.day

            rows.append({
                "timestamp": ts,
                "corridor": corridor,
                "token": order.get("token", "USDT"),
                "provider": institution or "Provider_A",
                "delivery_channel": meta.get("channel", "bank_transfer"),
                "amount_usd": round(amount_usd, 2),
                "active_providers": 4,
                "provider_concentration": 0.3,
                "liquidity_depth_usd": amount_usd * 5,
                "liquidity_ratio": 5.0,
                "network_congestion": 0.2,
                "gas_fee_spike": 0,
                "rate_volatility": 0.01,
                "settlement_time_min": round(settlement_min, 2),
                "hour": hour,
                "day_of_week": dow,
                "month": ts.month,
                "day_of_month": dom,
                "is_peak_hour": 1 if 8 <= hour <= 20 else 0,
                "is_weekend": 1 if dow >= 5 else 0,
                "is_month_end": 1 if dom >= 25 else 0,
                "is_salary_day": 1 if dom in [25, 26, 27, 28] else 0,
                "transaction_failed": failed,
                "failure_prob_true": 0.35,
                "data_source": "real",
            })
        except Exception as e:
            logger.warning(f"Skipping malformed order: {e}")
            continue
    return pd.DataFrame(rows) if rows else pd.DataFrame()


def simulate_realistic_transactions(
    n: int = 15000,
    start_date: str = "2024-06-01",
    end_date: str = "2026-03-31",
    corridor_meta: Optional[dict] = None,
    seed: int = 42,
) -> pd.DataFrame:
    """
    Generate realistic transaction data calibrated from real API corridor parameters.
    When live rates are available, simulation is anchored to real market conditions.
    """
    np.random.seed(seed)
    meta = corridor_meta or CORRIDOR_META

    corridors = [c for c in meta.keys() if len(c) == 3]
    volume_weights = np.array(
        [1 / meta[c].get("volume_rank", 5) for c in corridors], dtype=float
    )
    volume_weights /= volume_weights.sum()

    timestamps = pd.date_range(start_date, end_date, periods=n)
    rows = []

    for ts in timestamps:
        corridor = np.random.choice(corridors, p=volume_weights)
        m = meta[corridor]

        hour = ts.hour
        dow = ts.dayofweek
        dom = ts.day

        is_peak_hour = 1 if 8 <= hour <= 20 else 0
        is_weekend = 1 if dow >= 5 else 0
        is_month_end = 1 if dom >= 25 else 0
        is_salary_day = 1 if dom in [25, 26, 27, 28] else 0

        active_providers = np.random.randint(1, 8)
        provider_concentration = np.random.beta(2, 3)

        # Use real institution count to adjust liquidity depth if available
        inst_count = m.get("institutions_count", 4)
        base_liq = m["avg_usd"] * max(active_providers, inst_count * 0.5) * 0.8
        liquidity_depth_usd = max(50, np.random.exponential(base_liq))

        amount_usd = max(10, min(50000, np.random.lognormal(
            mean=np.log(m["avg_usd"]), sigma=0.8
        )))
        liquidity_ratio = liquidity_depth_usd / (amount_usd + 1)

        if active_providers <= 2 or liquidity_ratio < 0.5:
            provider = "OTC_Manual"
        else:
            provider = np.random.choice([f"Provider_{c}" for c in "ABCDEF"])

        channel = m.get("channel", "bank_transfer")
        token = np.random.choice(STABLECOINS, p=[0.55, 0.40, 0.05])
        network_congestion = np.random.beta(2, 5)
        gas_fee_spike = 1 if np.random.random() < 0.08 else 0

        base_time = 0.5 if provider != "OTC_Manual" else 45
        settlement_time = base_time * (1 + network_congestion * 3) * np.random.lognormal(0, 0.4)

        # Rate volatility anchored to real live rate if available
        live_rate = m.get("live_buy_rate")
        if live_rate and live_rate > 0:
            rate_volatility = abs(np.random.normal(0, 0.015))  # tighter with real data
        else:
            rate_volatility = abs(np.random.normal(0, 0.025))

        p = m["base_fail"]
        p *= (1 + 0.4 * (1 - min(liquidity_ratio, 3) / 3))
        p *= (1 + 0.25 * network_congestion)
        p *= (1.35 if provider == "OTC_Manual" else 1.0)
        p *= (1.20 if is_month_end else 1.0)
        p *= (0.85 if is_peak_hour else 1.10)
        p *= (1.15 if is_weekend else 1.0)
        p *= (1.10 if gas_fee_spike else 1.0)
        p *= (1 + 0.15 * provider_concentration)
        p *= (1 + 2 * rate_volatility)
        p = float(np.clip(p, 0.02, 0.92))

        failed = int(np.random.random() < p)

        rows.append({
            "timestamp": ts,
            "corridor": corridor,
            "token": token,
            "provider": provider,
            "delivery_channel": channel,
            "amount_usd": round(float(amount_usd), 2),
            "active_providers": int(active_providers),
            "provider_concentration": round(float(provider_concentration), 4),
            "liquidity_depth_usd": round(float(liquidity_depth_usd), 2),
            "liquidity_ratio": round(float(liquidity_ratio), 4),
            "network_congestion": round(float(network_congestion), 4),
            "gas_fee_spike": gas_fee_spike,
            "rate_volatility": round(float(rate_volatility), 4),
            "settlement_time_min": round(float(settlement_time), 2),
            "hour": int(hour),
            "day_of_week": int(dow),
            "month": int(ts.month),
            "day_of_month": int(dom),
            "is_peak_hour": is_peak_hour,
            "is_weekend": is_weekend,
            "is_month_end": is_month_end,
            "is_salary_day": is_salary_day,
            "transaction_failed": failed,
            "failure_prob_true": round(p, 4),
            "data_source": "simulated",
        })

    df = pd.DataFrame(rows)
    logger.info(f"Generated {len(df)} simulated transactions | Failure rate: {df['transaction_failed'].mean():.1%}")
    return df


async def load_or_generate_data(force_regenerate: bool = False) -> pd.DataFrame:
    """
    Load or generate transaction data.
    Always fetches live Paycrest API data to calibrate the simulation.
    Merges any real orders on top of the simulation.
    """
    raw_path = settings.data_path / "raw" / "transactions.parquet"
    meta_path = settings.data_path / "raw" / "corridor_meta.json"
    raw_path.parent.mkdir(parents=True, exist_ok=True)

    # Always refresh corridor meta from API (fast call)
    logger.info("Fetching live corridor data from Paycrest API...")
    currencies = await fetch_paycrest_currencies()

    if currencies:
        corridor_meta = _build_corridor_meta_from_api(currencies)
        # Save enriched meta for use by other modules
        with open(meta_path, "w") as f:
            json.dump(corridor_meta, f, indent=2, default=str)
        logger.info(f"✓ Corridor meta enriched from {len(currencies)} live currencies")
    else:
        corridor_meta = CORRIDOR_META
        logger.warning("Using fallback corridor metadata (API unavailable)")

    # Fetch real orders
    real_orders = await fetch_paycrest_orders()

    if raw_path.exists() and not force_regenerate:
        df = pd.read_parquet(raw_path)
        logger.info(f"Loaded {len(df)} cached transactions")
    else:
        df = simulate_realistic_transactions(
            n=15000,
            corridor_meta=corridor_meta,
        )

    # Merge real orders if we have them
    if real_orders:
        real_df = _real_orders_to_df(real_orders, corridor_meta)
        if not real_df.empty:
            # Ensure columns match
            for col in df.columns:
                if col not in real_df.columns:
                    real_df[col] = df[col].mean() if df[col].dtype in [float, int] else df[col].mode()[0]
            df = pd.concat([real_df, df], ignore_index=True)
            logger.info(f"✓ Merged {len(real_df)} real orders + {len(df)-len(real_df)} simulated = {len(df)} total")

    df.to_parquet(raw_path, index=False)
    logger.info(f"Saved {len(df)} transactions to {raw_path}")
    return df


async def get_live_rates() -> list[dict]:
    """Get current live rates from Paycrest API for the dashboard ticker."""
    currencies = await fetch_paycrest_currencies()
    if currencies:
        rates = []
        for code, data in currencies.items():
            if data["market_buy_rate"] > 0:
                rates.append({
                    "corridor": code,
                    "token": "USDT",
                    "rate": data["market_buy_rate"],
                    "sell_rate": data["market_sell_rate"],
                    "name": data["name"],
                    "source": "live",
                })
        if rates:
            logger.info(f"✓ Returning {len(rates)} live rates from Paycrest API")
            return rates

    # Fallback
    return [
        {"corridor": "NGN", "token": "USDT", "rate": 1580.45, "name": "Nigerian Naira",    "source": "fallback"},
        {"corridor": "KES", "token": "USDT", "rate": 129.19,  "name": "Kenyan Shilling",   "source": "fallback"},
        {"corridor": "GHS", "token": "USDT", "rate": 14.85,   "name": "Ghanaian Cedi",     "source": "fallback"},
        {"corridor": "UGX", "token": "USDT", "rate": 3820.00, "name": "Ugandan Shilling",  "source": "fallback"},
        {"corridor": "TZS", "token": "USDT", "rate": 2560.00, "name": "Tanzanian Shilling","source": "fallback"},
        {"corridor": "XOF", "token": "USDT", "rate": 620.00,  "name": "West African CFA",  "source": "fallback"},
        {"corridor": "MWK", "token": "USDT", "rate": 1740.00, "name": "Malawian Kwacha",   "source": "fallback"},
    ]


if __name__ == "__main__":
    async def main():
        print("Testing Paycrest API connection...")
        currencies = await fetch_paycrest_currencies()
        print(f"Currencies fetched: {list(currencies.keys())}")
        for code, data in list(currencies.items())[:3]:
            print(f"  {code}: buy={data['market_buy_rate']}, institutions={data['institutions_count']}")
        orders = await fetch_paycrest_orders()
        print(f"Real orders: {len(orders)}")
        rates = await get_live_rates()
        print(f"Live rates: {[r['corridor'] for r in rates]}")

    asyncio.run(main())
