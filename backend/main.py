import os

import pymysql
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from auth import hash_password
from database import BASE_DIR, Database, create_tables, run_sql_file
from routes import (auth_routes, dashboard, employees, products, reports, requests, scrap,
                    transactions, users, vendor_jobs, vendors)

app = FastAPI(title="Warehouse Management Software")

for r in (auth_routes, dashboard, products, employees, vendors, transactions,
          vendor_jobs, requests, scrap, reports, users):
    app.include_router(r.router)


@app.on_event("startup")
def setup_database():
    create_tables()
    db = Database()
    # first run: make the admin account and put some sample data
    if db.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"] == 0:
        db.execute(
            "INSERT INTO users (username, password_hash, full_name, role) VALUES (%s, %s, %s, %s)",
            ("admin", hash_password("admin123"), "Administrator", "admin"),
        )
        run_sql_file(db, "sample_data.sql")
        db.commit()
        print("New database created. Login: admin / admin123")
    db.close()


@app.exception_handler(pymysql.err.IntegrityError)
def integrity_error(request: Request, exc: pymysql.err.IntegrityError):
    # e.g. duplicate value in a UNIQUE column, or a foreign key that does not exist
    return JSONResponse(status_code=400, content={"detail": "Invalid or duplicate value: " + str(exc.args[-1])})


# serve the React build (frontend/dist) from the same server
DIST = os.path.join(BASE_DIR, "..", "frontend", "dist")

if os.path.isdir(DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST, "assets")), name="assets")

    @app.get("/{path:path}")
    def frontend(path: str):
        file = os.path.join(DIST, path)
        if path and os.path.isfile(file):
            return FileResponse(file)
        return FileResponse(os.path.join(DIST, "index.html"))
