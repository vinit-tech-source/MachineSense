import asyncio
from app.core.database import engine, Base
from app.models.models import *

async def reset():
    async with engine.begin() as conn:
        print("Dropping all tables...")
        await conn.run_sync(Base.metadata.drop_all)
        print("Creating all tables...")
        await conn.run_sync(Base.metadata.create_all)
        print("Done.")

asyncio.run(reset())
