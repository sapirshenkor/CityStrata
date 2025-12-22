import asyncio
from app.core.database import init_db_pool, close_db_pool, get_pool

"""
This script tests the database connection by creating a pool of connections and executing a simple query.
"""

async def main():
    try:
        await init_db_pool()
        pool = get_pool()
        async with pool.acquire() as conn:
            value = await conn.fetchval("SELECT 1")
            print(f"Database connection successful. Value: {value}")
        await close_db_pool()
        print("Database connection closed.")
    except Exception as e:
        print(f"Error: {e}")
        await close_db_pool()
        raise

if __name__ == "__main__":
    asyncio.run(main())