import asyncio
import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, func

from app.core.database import AsyncSessionLocal
from app.models.models import Machine, EnergySession
from app.services.notification_service import notification_service

logger = logging.getLogger(__name__)

async def shift_report_loop(interval_hours: int = 8):
    """
    Runs in the background and sends a shift report every N hours.
    """
    logger.info(f"Starting shift report scheduler. Interval: {interval_hours} hours.")
    while True:
        await asyncio.sleep(interval_hours * 3600)
        
        if not notification_service.is_configured():
            continue

        try:
            async with AsyncSessionLocal() as db:
                # Count active machines
                machines_result = await db.execute(select(func.count(Machine.machine_id)))
                active_machines = machines_result.scalar() or 0
                
                # Calculate energy cost for the last 8 hours
                since = datetime.now(timezone.utc) - timedelta(hours=interval_hours)
                
                # Get energy cost per machine
                machine_costs_result = await db.execute(
                    select(EnergySession.machine_id, func.sum(EnergySession.cost_inr).label("machine_cost"))
                    .where(EnergySession.session_start >= since)
                    .group_by(EnergySession.machine_id)
                )
                machine_costs = machine_costs_result.all()
                
                total_cost = sum((row.machine_cost or 0.0) for row in machine_costs)
                
                # Spot power creep / abnormal energy
                abnormal_machines = []
                if active_machines > 0:
                    avg_cost = total_cost / active_machines
                    # If a machine uses 50% more than the average, flag it
                    threshold = avg_cost * 1.5
                    for row in machine_costs:
                        if (row.machine_cost or 0.0) > threshold and (row.machine_cost or 0.0) > 10.0:
                            abnormal_machines.append(row.machine_id)

            logger.info("Sending scheduled shift report...")
            await notification_service.notify_shift_report(
                active_machines=active_machines, 
                total_cost=total_cost,
                abnormal_machines=abnormal_machines
            )
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Error generating shift report: {e}")
