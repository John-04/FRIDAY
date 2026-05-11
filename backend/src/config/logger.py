"""
Structured logging for Paycrest Intelligence API.
Outputs JSON-formatted logs for easy parsing and monitoring.
"""

import logging
import json
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path

from ..config.settings import settings

LOG_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "logs"


class JSONFormatter(logging.Formatter):
    """Formats log records as single-line JSON for structured logging."""

    def format(self, record: logging.LogRecord) -> str:
        log = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "module": record.module,
            "func": record.funcName,
            "line": record.lineno,
        }
        if record.exc_info:
            log["exception"] = self.formatException(record.exc_info)
        if hasattr(record, "extra"):
            log.update(record.extra)
        return json.dumps(log, default=str)


class RequestLogger:
    """Logs API requests with timing and status."""

    @staticmethod
    def log_request(
        method: str,
        path: str,
        status: int,
        duration_ms: float,
        client_ip: str = "",
    ):
        logger = logging.getLogger("api.requests")
        level = logging.WARNING if status >= 400 else logging.INFO
        logger.log(level, f"{method} {path} {status} {duration_ms:.1f}ms", extra={
            "method": method,
            "path": path,
            "status": status,
            "duration_ms": round(duration_ms, 1),
            "client_ip": client_ip,
        })

    @staticmethod
    def log_prediction(
        corridor: str,
        risk_score: float,
        risk_tier: str,
        model: str,
        duration_ms: float,
    ):
        logger = logging.getLogger("api.predictions")
        logger.info(f"Prediction: {corridor} → {risk_tier} ({risk_score:.3f})", extra={
            "corridor": corridor,
            "risk_score": round(risk_score, 4),
            "risk_tier": risk_tier,
            "model": model,
            "duration_ms": round(duration_ms, 1),
        })

    @staticmethod
    def log_retrain(
        trigger: str,
        success: bool,
        best_model: str = "",
        auc: float = 0.0,
        duration_s: float = 0.0,
        error: str = "",
    ):
        logger = logging.getLogger("api.retraining")
        if success:
            logger.info(f"Retrain complete [{trigger}]: {best_model} AUC={auc:.4f}", extra={
                "trigger": trigger,
                "success": True,
                "best_model": best_model,
                "auc": auc,
                "duration_s": round(duration_s, 1),
            })
        else:
            logger.error(f"Retrain failed [{trigger}]: {error}", extra={
                "trigger": trigger,
                "success": False,
                "error": error,
            })


def setup_logging():
    """
    Configure structured logging:
    - Console: human-readable in development, JSON in production
    - File: always JSON, rotated daily, kept for 30 days
    """
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    root = logging.getLogger()
    root.setLevel(logging.INFO)

    # Remove existing handlers
    root.handlers.clear()

    is_dev = settings.environment == "development"

    # ── Console handler ──────────────────────────────────────────────────────
    console = logging.StreamHandler(sys.stdout)
    if is_dev:
        # Human readable in dev
        console.setFormatter(logging.Formatter(
            "%(asctime)s | %(levelname)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        ))
    else:
        # JSON in production
        console.setFormatter(JSONFormatter())
    root.addHandler(console)

    # ── File handler — JSON always ───────────────────────────────────────────
    try:
        from logging.handlers import TimedRotatingFileHandler
        log_file = LOG_DIR / "paycrest_intel.log"
        file_handler = TimedRotatingFileHandler(
            log_file,
            when="midnight",
            backupCount=30,
            encoding="utf-8",
        )
        file_handler.setFormatter(JSONFormatter())
        file_handler.setLevel(logging.INFO)
        root.addHandler(file_handler)

        # Separate error log
        error_file = LOG_DIR / "errors.log"
        error_handler = TimedRotatingFileHandler(
            error_file,
            when="midnight",
            backupCount=30,
            encoding="utf-8",
        )
        error_handler.setFormatter(JSONFormatter())
        error_handler.setLevel(logging.ERROR)
        root.addHandler(error_handler)

        logging.getLogger(__name__).info(
            f"Logging to {log_file} (JSON, 30-day rotation)"
        )
    except Exception as e:
        logging.getLogger(__name__).warning(f"Could not set up file logging: {e}")

    # Quiet noisy libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("watchfiles").setLevel(logging.WARNING)
    logging.getLogger("apscheduler").setLevel(logging.INFO)
