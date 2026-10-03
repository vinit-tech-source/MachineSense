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
        
        # Format the message (Hindi by default per YieldWatt spec)
        emoji = "🔴" if severity >= 80 else "🟠"
        message = (
            f"{emoji} *विजिल अलर्ट (VIGIL ALERT): {machine_id}*\n"
            f"गंभीरता (Severity): `{severity:.1f}%`\n\n"
            f"विवरण (Details): {details}\n"
            f"आवश्यक कार्रवाई (Action): कृपया तुरंत डैशबोर्ड की जांच करें।"
        )
        
        # YieldWatt Spec: One-tap reason codes and useful / false alarm buttons
        inline_keyboard = [
            [
                {"text": "✅ उपयोगी (Useful)", "callback_data": f"feedback_useful_{machine_id}"},
                {"text": "❌ गलत अलार्म (False Alarm)", "callback_data": f"feedback_false_{machine_id}"}
            ],
            [
                {"text": "⏸️ नियोजित ब्रेक? (Planned break?)", "callback_data": f"reason_break_{machine_id}"},
                {"text": "🔧 रखरखाव? (Maintenance?)", "callback_data": f"reason_maint_{machine_id}"}
            ]
        ]
        
        payload = {
            "chat_id": self.chat_id,
            "text": message,
            "parse_mode": "Markdown",
            "reply_markup": {"inline_keyboard": inline_keyboard}
        }
        
        # Fire and forget the async request
        asyncio.create_task(self._send_custom_payload(payload))

    async def _send_custom_payload(self, payload: dict):
        if not self.is_configured():
            return
        url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, timeout=10.0)
                response.raise_for_status()
        except Exception as e:
            logger.error(f"Failed to send Telegram alert: {e}")

    async def notify_shift_report(self, active_machines: int, total_cost: float, abnormal_machines: list[str] = None):
        """
        Sends a summary shift report.
        """
        abnormal_machines = abnormal_machines or []
        
        message = (
            f"📊 *Vigil Shift Handover Report*\n"
            f"Active Machines: `{active_machines}`\n"
            f"Energy Cost this Shift: `₹{total_cost:.2f}`\n\n"
        )
        
        if abnormal_machines:
            message += "⚠️ *Abnormal Energy Usage Detected:*\n"
            for m in abnormal_machines:
                message += f" - `{m}` (Investigate for power creep / waste)\n"
            message += "\n"
            
        message += f"System Status: Normal 🟢"
        asyncio.create_task(self.send_telegram_message(message))

# Global instance
notification_service = NotificationService()
