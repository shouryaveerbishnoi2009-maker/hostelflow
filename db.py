"""
HostelFlow — Database Connection Layer
PostgreSQL Connection Pooling using psycopg2
- Zero ORM black-boxes: 100% transparent, parameterized SQL queries
- Supabase Connection Pooler / PgBouncer & SSL ready
- Automatic connection allocation via Flask's request lifecycle
"""

import os
import logging
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from flask import g, current_app

logger = logging.getLogger("hostelflow.db")

_pool: Optional[pool.ThreadedConnectionPool] = None


def get_sanitized_db_url(raw_url: str) -> str:
    """
    Ensures connection URL has sslmode=require enabled for Supabase / Cloud Postgres.
    """
    if not raw_url:
        return ""
    
    parsed = urlparse(raw_url)
    qs = parse_qs(parsed.query)
    
    # Supabase direct & pooler both require SSL
    if "sslmode" not in qs:
        qs["sslmode"] = ["require"]
    
    new_query = urlencode(qs, doseq=True)
    sanitized = urlunparse((
        parsed.scheme,
        parsed.netloc,
        parsed.path,
        parsed.params,
        new_query,
        parsed.fragment
    ))
    return sanitized


def init_db_pool(app=None) -> Optional[pool.ThreadedConnectionPool]:
    """
    Initializes a ThreadedConnectionPool for high-concurrency requests.
    """
    global _pool
    database_url = os.environ.get("DATABASE_URL", "").strip()

    if not database_url:
        logger.warning("DATABASE_URL is not configured. Database operations will fail until provided.")
        return None

    try:
        sanitized_url = get_sanitized_db_url(database_url)
        min_conn = int(os.environ.get("DB_POOL_MIN", 1))
        max_conn = int(os.environ.get("DB_POOL_MAX", 10))

        _pool = pool.ThreadedConnectionPool(
            minconn=min_conn,
            maxconn=max_conn,
            dsn=sanitized_url
        )
        logger.info("HostelFlow PostgreSQL Connection Pool successfully initialized.")
        return _pool
    except Exception as exc:
        logger.error(f"Failed to initialize PostgreSQL pool: {exc}")
        return None


def get_db():
    """
    Retrieves or acquires a database connection for the current Flask request context.
    """
    global _pool
    if "db_conn" not in g:
        if _pool is None:
            init_db_pool()
        if _pool is None:
            raise RuntimeError("Database connection pool is uninitialized. Verify DATABASE_URL in .env.")
        g.db_conn = _pool.getconn()
    return g.db_conn


def close_db(e=None):
    """
    Releases connection back to the pool at the end of the Flask request lifecycle.
    """
    global _pool
    conn = g.pop("db_conn", None)
    if conn is not None and _pool is not None:
        try:
            # If the connection was left in an aborted or dirty state, rollback cleanly
            if not conn.closed:
                conn.rollback()
            _pool.putconn(conn)
        except Exception as exc:
            logger.warning(f"Error returning connection to pool: {exc}")


def execute_query(sql: str, params: Optional[tuple] = None, commit: bool = True) -> int:
    """
    Executes a parameterized write query (INSERT, UPDATE, DELETE).
    Returns rowcount affected.
    """
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute(sql, params or ())
        rowcount = cur.rowcount
    if commit:
        conn.commit()
    return rowcount


def fetch_one(sql: str, params: Optional[tuple] = None) -> Optional[Dict[str, Any]]:
    """
    Executes a parameterized query and returns a single row as a standard Python dict.
    """
    conn = get_db()
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, params or ())
        row = cur.fetchone()
        return dict(row) if row is not None else None


def fetch_all(sql: str, params: Optional[tuple] = None) -> List[Dict[str, Any]]:
    """
    Executes a parameterized query and returns all matching rows as a list of dicts.
    """
    conn = get_db()
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, params or ())
        rows = cur.fetchall()
        return [dict(r) for r in rows]
