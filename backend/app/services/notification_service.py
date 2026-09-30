import os
import httpx
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Dict

logger = logging.getLogger(__name__)

class NotificationService:
    def __init__(self):
        self.bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
        self.chat_id = os.getenv("TELEGRAM_CHAT_ID")
        
        # Prevent spamming: only send 1 alert per machine per X minutes
        self.last_alert_times: Dict[str, datetime] = {}
        self.alert_cooldown_minutes = 5

    def is_configured(self) -> bool:
        return bool(self.bot_token and self.chat_id)

    async def send_telegram_message(self, text: str):
        if not self.is_configured():
            logger.warning("Telegram alerts are not configured. Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID.")
            return

        url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        payload = {
            "chat_id": self.chat_id,
            "text": text,
            "parse_mode": "Markdown"
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, timeout=10.0)
                response.raise_for_status()
                logger.info("Successfully sent mobile alert via Telegram.")
        except Exception as e:
            logger.error(f"Failed to send Telegram alert: {e}")

    async def notify_anomaly(self, machine_id: str, severity: float, details: str):
        """
        Sends a critical anomaly alert if the cooldown period has passed.
        """
        now = datetime.now()
        last_alert = self.last_alert_times.get(machine_id)
        
        # Check cooldown to prevent spam
        if last_alert and (now - last_alert) < timedelta(minutes=self.alert_cooldown_minutes):
            return # Too soon to alert again for this machine

        # Update last alert time
        self.last_alert_times[machine_id] = now
        
        # Format the message
        emoji = "🔴" if severity >= 80 else "🟠"
        message = (
            f"{emoji} *VIGIL ALERT: {machine_id}*\n"
            f"Severity: `{severity:.1f}%`\n\n"
            f"Details: {details}\n"
            f"Action Required: Please check the dashboard immediately."
        )
        
        # Fire and forget the async request
        asyncio.create_task(self.send_telegram_message(message))

    async def notify_shift_report(self, active_machines: int, total_cost: float):
        """
        Sends a summary shift report.
        """
        message = (
            f"📊 *Vigil Shift Handover Report*\n"
            f"Active Machines: `{active_machines}`\n"
            f"Energy Cost this Shift: `₹{total_cost:.2f}`\n\n"
            f"System Status: Normal 🟢"
        )
        asyncio.create_task(self.send_telegram_message(message))

# Global instance
notification_service = NotificationService()
