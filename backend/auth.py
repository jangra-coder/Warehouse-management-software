import secrets

import bcrypt
from fastapi import Depends, Header, HTTPException

from database import get_db


def hash_password(password):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def check_password(password, password_hash):
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def new_session(conn, user_id):
    token = secrets.token_hex(32)
    conn.execute("INSERT INTO sessions (token, user_id) VALUES (%s, %s)", (token, user_id))
    return token


def get_current_user(authorization: str = Header(default=""), conn=Depends(get_db)):
    # the frontend sends:  Authorization: Bearer <token>
    token = authorization.replace("Bearer ", "").strip()
    if not token:
        raise HTTPException(401, "Please log in")
    user = conn.execute(
        """SELECT u.user_id, u.username, u.full_name, u.role
           FROM sessions s JOIN users u ON u.user_id = s.user_id
           WHERE s.token = %s AND u.is_active = 1""",
        (token,),
    ).fetchone()
    if user is None:
        raise HTTPException(401, "Session expired, please log in again")
    return dict(user)


def require_role(*roles):
    """Use like: user = Depends(require_role("admin", "manager"))"""

    def checker(user=Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, "You are not allowed to do this")
        return user

    return checker


# admin and manager can change stock, user can only view and make requests
staff_only = require_role("admin", "manager")
admin_only = require_role("admin")
