import datetime
import decimal
import os
import ssl

import certifi
import pymysql
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# database details come from environment variables
# (on my laptop they are in backend/.env, on Render they are set in the dashboard)
load_dotenv(os.path.join(BASE_DIR, ".env"))

DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = int(os.environ.get("DB_PORT", "3306"))
DB_USER = os.environ.get("DB_USER", "root")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "")
DB_NAME = os.environ.get("DB_NAME", "warehouse")
# cloud databases (like TiDB Cloud) need a secure (TLS) connection
DB_SSL = os.environ.get("DB_SSL", "false" if DB_HOST == "localhost" else "true").lower() == "true"


class Database:
    """Small wrapper around a pymysql connection so the routes can write
    conn.execute(sql, params) and get rows back as dictionaries."""

    def __init__(self, use_db=True):
        self.conn = pymysql.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME if use_db else None,
            cursorclass=pymysql.cursors.DictCursor,
            ssl=ssl.create_default_context(cafile=certifi.where()) if DB_SSL else None,
            # rowcount = rows matched by the WHERE (not only rows that really changed)
            client_flag=pymysql.constants.CLIENT.FOUND_ROWS,
            autocommit=False,
        )
        # show all dates and times in Indian time
        self.execute("SET time_zone = '+05:30'")

    def execute(self, sql, params=None):
        cur = self.conn.cursor()
        cur.execute(sql, params)
        return Result(cur)

    def commit(self):
        self.conn.commit()

    def close(self):
        self.conn.close()


class Result:
    def __init__(self, cur):
        self.cur = cur
        self.lastrowid = cur.lastrowid
        self.rowcount = cur.rowcount

    def fetchone(self):
        row = self.cur.fetchone()
        return clean_row(row) if row else None

    def fetchall(self):
        return [clean_row(r) for r in self.cur.fetchall()]


def clean_row(row):
    # MySQL gives back Decimal and datetime objects, change them to
    # normal numbers and text so they look the same in the frontend
    for key, value in row.items():
        if isinstance(value, decimal.Decimal):
            row[key] = int(value) if value == int(value) else float(value)
        elif isinstance(value, datetime.datetime):
            row[key] = value.strftime("%Y-%m-%d %H:%M:%S")
        elif isinstance(value, datetime.date):
            row[key] = value.strftime("%Y-%m-%d")
    return row


def get_db():
    """FastAPI dependency: one connection per request.
    Write routes call conn.commit() themselves. If a route fails before
    commit, closing the connection throws the changes away (rollback)."""
    db = Database()
    try:
        yield db
    finally:
        db.close()


def run_sql_file(db, filename):
    with open(os.path.join(BASE_DIR, filename), encoding="utf-8") as f:
        text = f.read()
    # remove comment lines and run the statements one by one
    lines = [line for line in text.splitlines() if not line.strip().startswith("--")]
    for statement in "\n".join(lines).split(";"):
        if statement.strip():
            db.execute(statement)


def create_tables():
    first = Database(use_db=False)
    first.execute(f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}`")
    first.close()

    db = Database()
    run_sql_file(db, "schema.sql")
    db.commit()
    db.close()


def rows_to_list(rows):
    return list(rows)
