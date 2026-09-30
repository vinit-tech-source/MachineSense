import asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect('postgresql://postgres:Vinit%40123@localhost:5432/vigil')
    await conn.execute('ALTER TABLE sensor_readings ADD COLUMN IF NOT EXISTS rul_severity_pct FLOAT;')
    print("Added column rul_severity_pct to sensor_readings.")
    await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
