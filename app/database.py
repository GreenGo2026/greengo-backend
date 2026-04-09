# app/database.py
from __future__ import annotations

import logging

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection, AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING, IndexModel

from app.config import get_settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Motor client — None until connect_db() is awaited at startup
# ---------------------------------------------------------------------------

_client: AsyncIOMotorClient | None = None


def get_db_client() -> AsyncIOMotorClient:
    if _client is None:
        raise RuntimeError(
            "Database client is not initialised. "
            "Ensure connect_db() is awaited inside the FastAPI lifespan startup."
        )
    return _client


# ---------------------------------------------------------------------------
# Lifespan helpers — called from main.py
# ---------------------------------------------------------------------------

async def connect_db() -> None:
    """
    Open the Motor client and verify Atlas reachability with a ping.
    Call this at FastAPI startup inside the lifespan context manager.
    """
    global _client

    settings = get_settings()
    logger.info("🔌 [DB] Connecting to MongoDB — URI: %s", settings.MONGODB_URI[:40])

    _client = AsyncIOMotorClient(
        settings.MONGODB_URI,
        maxPoolSize=10,
        minPoolSize=2,
        serverSelectionTimeoutMS=8_000,
        connectTimeoutMS=10_000,
        socketTimeoutMS=30_000,
    )

    # Eagerly verify — raises immediately if creds / IP / URI are wrong
    await _client.admin.command("ping")
    logger.info("✅ [DB] Ping successful — connected to '%s'.", settings.MONGO_DB_NAME)

    await _init_indexes()


def close_db() -> None:
    """Close the Motor client gracefully at FastAPI shutdown."""
    global _client
    if _client is not None:
        _client.close()
        _client = None
        logger.info("🔌 [DB] Motor client closed.")


# ---------------------------------------------------------------------------
# Database & collection accessors
# ---------------------------------------------------------------------------

def get_database() -> AsyncIOMotorDatabase:
    return get_db_client()[get_settings().MONGO_DB_NAME]


def _col(name: str) -> AsyncIOMotorCollection:
    return get_database()[name]


def users_col()           -> AsyncIOMotorCollection: return _col("users")
def products_col()        -> AsyncIOMotorCollection: return _col("products")
def orders_col()          -> AsyncIOMotorCollection: return _col("orders")
def whatsapp_orders_col() -> AsyncIOMotorCollection: return _col("whatsapp_orders")


# ---------------------------------------------------------------------------
# Index bootstrap — idempotent, runs automatically inside connect_db()
# ---------------------------------------------------------------------------

async def _init_indexes() -> None:
    try:
        await users_col().create_indexes([
            IndexModel([("phone_number", ASCENDING)], unique=True, name="uq_phone"),
        ])
        await products_col().create_indexes([
            IndexModel([("category",        ASCENDING)], name="idx_category"),
            IndexModel([("is_vacuum_sealed", ASCENDING)], name="idx_vacuum"),
            IndexModel([("stock",           ASCENDING)], name="idx_stock"),
        ])
        await orders_col().create_indexes([
            IndexModel([("user_id",    ASCENDING)],  name="idx_user"),
            IndexModel([("status",     ASCENDING)],  name="idx_status"),
            IndexModel([("created_at", DESCENDING)], name="idx_created_desc"),
        ])
        await whatsapp_orders_col().create_indexes([
            IndexModel([("customer_phone", ASCENDING)],  name="idx_wa_phone"),
            IndexModel([("status",         ASCENDING)],  name="idx_wa_status"),
            IndexModel([("created_at",     DESCENDING)], name="idx_wa_created_desc"),
        ])
        logger.info("✅ [DB] All indexes verified / created.")
    except Exception as exc:
        logger.error("❌ [DB] Index bootstrap failed: %s", exc)