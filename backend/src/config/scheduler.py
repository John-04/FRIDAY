"""
Background scheduler for automatic model retraining.
Runs every 24 hours, pulls fresh Paycrest API rates,
regenerates simulation calibrated to live data, retrains all 3 models.
"""

import logging
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger

from ..config.settings import settings

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler = AsyncIOScheduler(timezone="UTC")

# Track last retrain
last_retrain: datetime | None = None
retrain_in_progress: bool = False


async def _retrain_job():
    """The actual retraining task that runs on schedule."""
    global last_retrain, retrain_in_progress

    if retrain_in_progress:
        logger.info("Skipping scheduled retrain — one already in progress")
        return

    retrain_in_progress = True
    logger.info("═══ Scheduled retrain starting ═══")

    try:
        # Import here to avoid circular imports
        from ..ml.pipeline import run_full_pipeline

        results = await run_full_pipeline(force_retrain=True)
        last_retrain = datetime.now()

        logger.info(
            f"✓ Scheduled retrain complete | "
            f"Best model: {results['meta']['best_model']} | "
            f"AUC: {results['meta']['best_model_auc']} | "
            f"Failure rate: {results['meta']['overall_fail_rate']:.1%}"
        )

        # Update the global pipeline results in main
        try:
            from ..api.main import pipeline_results as pr
            pr.clear()
            pr.update(results)
            logger.info("✓ Live dashboard updated with new results")
        except Exception as e:
            logger.warning(f"Could not update live results: {e}")

    except Exception as e:
        logger.error(f"Scheduled retrain failed: {e}", exc_info=True)
    finally:
        retrain_in_progress = False


def start_scheduler():
    """Start the background scheduler."""
    if scheduler.running:
        logger.info("Scheduler already running")
        return

    # Retrain every N hours (configurable via .env)
    scheduler.add_job(
        _retrain_job,
        trigger=IntervalTrigger(hours=settings.retrain_interval_hours),
        id="auto_retrain",
        name="Auto Model Retrain",
        replace_existing=True,
        misfire_grace_time=3600,  # 1 hour grace if server was down
    )

    # Also retrain every day at 3 AM UTC (off-peak)
    scheduler.add_job(
        _retrain_job,
        trigger=CronTrigger(hour=3, minute=0, timezone="UTC"),
        id="daily_retrain",
        name="Daily 3AM Retrain",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    scheduler.start()
    logger.info(
        f"✓ Scheduler started — auto retrain every "
        f"{settings.retrain_interval_hours}h + daily at 03:00 UTC"
    )


def stop_scheduler():
    """Stop the scheduler gracefully."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")


def get_scheduler_status() -> dict:
    """Return current scheduler status for the API."""
    jobs = []
    if scheduler.running:
        for job in scheduler.get_jobs():
            jobs.append({
                "id": job.id,
                "name": job.name,
                "next_run": str(job.next_run_time) if job.next_run_time else None,
            })

    return {
        "running": scheduler.running,
        "last_retrain": str(last_retrain) if last_retrain else None,
        "retrain_in_progress": retrain_in_progress,
        "jobs": jobs,
    }
