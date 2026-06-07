"""Read-only access to the gold warehouse. Single source of truth for queries."""
import sqlite3
from .config import WAREHOUSE

def warehouse():
    """Open the warehouse strictly read-only (mode=ro)."""
    con = sqlite3.connect(f"file:{WAREHOUSE}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    return con

def query(sql, params=()):
    """Run one SELECT/WITH and return a list of dicts. Read-only is enforced here."""
    s = sql.strip().lower()
    if not (s.startswith("select") or s.startswith("with")):
        raise ValueError("warehouse is read-only: only SELECT/WITH allowed")
    if ";" in sql.rstrip(";"):
        raise ValueError("single statement only")
    con = warehouse()
    try:
        rows = [dict(r) for r in con.execute(sql, params).fetchall()]
    finally:
        con.close()
    return rows
