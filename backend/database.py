import os
import sqlite3

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("DB_PATH", os.path.join(BASE_DIR, "warehouse.db"))


def connect():
    # FastAPI may open and close the connection in different threads,
    # that is fine here because each request gets its own connection
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row  # rows act like dicts: row["name"]
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def get_db():
    """FastAPI dependency: one connection per request.
    Write routes call conn.commit() themselves. If a route fails before
    commit, closing the connection throws the changes away (rollback)."""
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()


def run_sql_file(conn, filename):
    with open(os.path.join(BASE_DIR, filename), encoding="utf-8") as f:
        conn.executescript(f.read())


def create_tables():
    conn = connect()
    run_sql_file(conn, "schema.sql")
    conn.commit()
    conn.close()


def rows_to_list(rows):
    return [dict(r) for r in rows]
