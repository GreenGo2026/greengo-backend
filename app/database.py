# app/database.py
from __future__ import annotations

import logging

import certifi
from motor.motor_asyncio import (
    AsyncIOMotorClient,
    AsyncIOMotorCollection,
    AsyncIOMotorDatabase,
)
from pymongo import ASCENDING, DESCENDING, IndexModel

from app.config import get_settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Motor client -- None until connect_db() is awaited at startup
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
# Lifespan helpers -- called from main.py
# ---------------------------------------------------------------------------

async def connect_db() -> None:
    """
    Open the Motor client and verify Atlas reachability with a ping.

    The `tlsCAFile=certifi.where()` argument resolves the Windows SSL/TLS
    certificate issue that causes ReplicaSetNoPrimary errors when connecting
    to MongoDB Atlas Free Tier clusters from Windows machines.

    Call this at FastAPI startup inside the lifespan context manager.
    """
    global _client

    settings = get_settings()
    logger.info(
        "[DB] Connecting to MongoDB -- URI: %s",
        settings.MONGODB_URI[:40],
    )

    _client = AsyncIOMotorClient(
        settings.MONGODB_URI,
        # -- Windows SSL fix --------------------------------------------------
        # certifi ships a current CA bundle, bypassing the Windows certificate
        # store resolution issue that causes ReplicaSetNoPrimary on Atlas.
        tlsCAFile=certifi.where(),
        # -- Connection pool ---------------------------------------------------
        maxPoolSize=10,
        minPoolSize=2,
        # -- Timeouts ------------------------------------------------------------
        serverSelectionTimeoutMS=8_000,
        connectTimeoutMS=10_000,
        socketTimeoutMS=30_000,
    )


    try:
        await _client.admin.command("ping")
        logger.info("[DB] Ping successful -- connected to %s.", settings.MONGO_DB_NAME)
    except Exception as _e:
        logger.warning("[DB] Ping failed -- starting without DB: %s", _e)
    await _init_indexes()


def close_db() -> None:
    """Close the Motor client gracefully at FastAPI shutdown."""
    global _client
    if _client is not None:
        _client.close()
        _client = None
        logger.info("[DB] Motor client closed.")


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
def customers_col()       -> AsyncIOMotorCollection: return _col("customers")
def paniers_col()         -> AsyncIOMotorCollection: return _col("paniers")
def reviews_col()         -> AsyncIOMotorCollection: return _col("reviews")
def newsletter_col()      -> AsyncIOMotorCollection: return _col("newsletter")
def audit_log_col()       -> AsyncIOMotorCollection: return _col("audit_log")
def notifications_col()   -> AsyncIOMotorCollection: return _col("notifications")
def session_log_col()     -> AsyncIOMotorCollection: return _col("session_log")
def challenges_col()             -> AsyncIOMotorCollection: return _col("challenges")
def challenge_completions_col()  -> AsyncIOMotorCollection: return _col("challenge_completions")
def recipes_col()                -> AsyncIOMotorCollection: return _col("recipes")


# ---------------------------------------------------------------------------
# Index bootstrap -- idempotent, runs automatically inside connect_db()
# ---------------------------------------------------------------------------

async def _init_indexes() -> None:
    # Each collection's indexes are created independently -- an
    # IndexOptionsConflict (or any other failure) on one collection must not
    # silently skip every collection listed after it, which is what wrapping
    # the whole function body in a single try/except previously did.
    index_groups: list[tuple[str, AsyncIOMotorCollection, list[IndexModel]]] = [
        ("users", users_col(), [
            IndexModel([("phone_number", ASCENDING)], unique=True, name="uq_phone"),
        ]),
        ("products", products_col(), [
            IndexModel([("category",        ASCENDING)], name="idx_category"),
            IndexModel([("is_vacuum_sealed", ASCENDING)], name="idx_vacuum"),
            IndexModel([("stock",            ASCENDING)], name="idx_stock"),
        ]),
        ("orders", orders_col(), [
            IndexModel([("user_id",    ASCENDING)],  name="idx_user"),
            IndexModel([("status",     ASCENDING)],  name="idx_status"),
            IndexModel([("created_at", DESCENDING)], name="idx_created_desc"),
        ]),
        ("whatsapp_orders", whatsapp_orders_col(), [
            IndexModel([("customer_phone", ASCENDING)],  name="idx_wa_phone"),
            IndexModel([("status",         ASCENDING)],  name="idx_wa_status"),
            IndexModel([("created_at",     DESCENDING)], name="idx_wa_created_desc"),
        ]),
        ("newsletter", newsletter_col(), [
            IndexModel([("email", ASCENDING)], unique=True, name="uq_newsletter_email"),
        ]),
        ("customers", customers_col(), [
            # The loyalty upsert in create_order() already matches/dedupes by
            # exact phone string, so this index cannot fail against existing
            # data -- it just makes that guarantee explicit.
            IndexModel([("phone", ASCENDING)], unique=True, name="uq_customer_phone"),
            IndexModel([("segment", ASCENDING)], name="idx_customer_segment"),
            IndexModel([("total_spent", DESCENDING)], name="idx_customer_total_spent"),
            # Sparse -- most customers don't have a referral code yet (only
            # granted at their 3rd order), so this can't be a plain unique index.
            IndexModel([("referral_code", ASCENDING)], unique=True, sparse=True, name="uq_customer_referral_code"),
        ]),
        ("audit_log", audit_log_col(), [
            IndexModel(
                [("entity_type", ASCENDING), ("entity_id", ASCENDING), ("timestamp", DESCENDING)],
                name="idx_entity_timestamp",
            ),
            # 90-day retention -- MongoDB's TTL monitor deletes documents whose
            # "timestamp" is older than this, no manual cleanup job needed.
            IndexModel([("timestamp", ASCENDING)], expireAfterSeconds=7_776_000, name="ttl_90d"),
        ]),
        ("notifications", notifications_col(), [
            IndexModel([("status", ASCENDING), ("created_at", DESCENDING)], name="status_created_idx"),
            # 30-day retention.
            IndexModel([("created_at", ASCENDING)], expireAfterSeconds=2_592_000, name="ttl_30d_notifications"),
        ]),
        ("session_log", session_log_col(), [
            IndexModel([("event", ASCENDING), ("timestamp", DESCENDING)], name="event_timestamp_idx"),
            # 90-day retention.
            IndexModel([("timestamp", ASCENDING)], expireAfterSeconds=7_776_000, name="ttl_90d_sessions"),
        ]),
        ("challenge_completions", challenge_completions_col(), [
            # The weekly challenge check queries by phone + completed_at range
            # every order -- this is the hot path for that lookup.
            IndexModel([("phone", ASCENDING), ("completed_at", DESCENDING)], name="idx_challenge_phone_date"),
        ]),
        ("recipes", recipes_col(), [
            IndexModel([("slug", ASCENDING)], unique=True, name="uq_recipe_slug"),
        ]),
    ]

    for name, col, models in index_groups:
        try:
            await col.create_indexes(models)
        except Exception as exc:
            logger.error("[DB] Index bootstrap failed for %s: %s", name, exc)

    logger.info("[DB] Index bootstrap complete.")
