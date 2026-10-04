from fastapi import APIRouter, Depends
import google.generativeai as genai
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.models import SensorReading, Machine
from sqlalchemy import select

router = APIRouter()

import os

# Configure Gemini with the provided API key
genai.configure(api_key=os.getenv("GEMINI_API_KEY", "dummy_key_for_testing"))
model = genai.GenerativeModel('gemini-2.5-flash')

class ChatRequest(BaseModel):
    message: str
    machine_id: str

@router.post("/chat")
async def copilot_chat(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    # Try to fetch some recent telemetry to ground the AI response
    context = ""
    try:
        # Get machine details
        stmt = select(Machine).where(Machine.machine_id == req.machine_id)
        res = await db.execute(stmt)
        machine = res.scalar_one_or_none()

        if machine:
            # Get latest 5 telemetry readings
            tel_stmt = select(SensorReading).where(SensorReading.machine_id == req.machine_id).order_by(SensorReading.timestamp.desc()).limit(5)
            tel_res = await db.execute(tel_stmt)
            readings = tel_res.scalars().all()
            
            context += f"Machine context: {machine.name} (ID: {machine.machine_id}, Location: {machine.location}, Power: {machine.rated_power_kw}kW).\n"
            context += "Recent telemetry data:\n"
            for r in readings:
                context += f"- Time: {r.timestamp}, Mode: {r.operating_state}, Volts: {r.voltage_v}V, Current: {r.current_a}A, Temp: {r.temp_c}C, Vib: {r.vibration_mm_s}mm/s\n"
    except Exception as e:
        context = "No specific machine data available."

    prompt = f"""You are EcoStruxure Copilot, an AI factory assistant integrated into MachineSense.
Your job is to answer the user's questions about factory operations, maintenance, and energy usage.
Provide concise, helpful, and professional answers. If the data shows anomalies (like fault_vibration), point them out as a risk for maintenance. Don't use markdown formatting, just plain text with occasional newlines.

Here is the current live data context for the machine the user is asking about:
{context}

User's question: {req.message}
"""
    try:
        response = model.generate_content(prompt)
        return {"response": response.text}
    except Exception as e:
        return {"response": f"I'm sorry, I encountered an error connecting to my AI brain: {str(e)}"}
