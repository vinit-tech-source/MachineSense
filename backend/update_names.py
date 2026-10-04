import asyncio
import os
from sqlalchemy import text
from app.core.database import engine

async def update():
    async with engine.begin() as conn:
        await conn.execute(text("UPDATE machines SET name = 'M-001 Vertical Milling Center' WHERE machine_id = 'machine-001'"))
        await conn.execute(text("UPDATE machines SET name = 'M-002 CNC Turning Lathe' WHERE machine_id = 'machine-002'"))
        await conn.execute(text("UPDATE machines SET name = 'M-003 Hydraulic Power Press' WHERE machine_id = 'machine-003'"))
        await conn.execute(text("UPDATE machines SET name = 'M-004 Packaging Robot' WHERE machine_id = 'machine-004'"))
    print("Names updated successfully!")

if __name__ == "__main__":
    asyncio.run(update())
