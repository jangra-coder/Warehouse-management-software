from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from auth import check_password, get_current_user, hash_password, new_session
from database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginForm(BaseModel):
    username: str
    password: str


class PasswordForm(BaseModel):
    old_password: str
    new_password: str


@router.post("/login")
def login(form: LoginForm, conn=Depends(get_db)):
    user = conn.execute(
        "SELECT * FROM users WHERE username = %s", (form.username.strip(),)
    ).fetchone()
    if user is None or not check_password(form.password, user["password_hash"]):
        raise HTTPException(401, "Wrong username or password")
    if not user["is_active"]:
        raise HTTPException(403, "This account is disabled")

    token = new_session(conn, user["user_id"])
    conn.commit()
    return {
        "token": token,
        "user": {
            "user_id": user["user_id"],
            "username": user["username"],
            "full_name": user["full_name"],
            "role": user["role"],
        },
    }


@router.get("/me")
def me(user=Depends(get_current_user)):
    return user


@router.post("/logout")
def logout(authorization: str = Header(default=""), conn=Depends(get_db)):
    token = authorization.replace("Bearer ", "").strip()
    conn.execute("DELETE FROM sessions WHERE token = %s", (token,))
    conn.commit()
    return {"message": "Logged out"}


@router.post("/change-password")
def change_password(form: PasswordForm, user=Depends(get_current_user), conn=Depends(get_db)):
    row = conn.execute("SELECT password_hash FROM users WHERE user_id = %s", (user["user_id"],)).fetchone()
    if not check_password(form.old_password, row["password_hash"]):
        raise HTTPException(400, "Old password is wrong")
    if len(form.new_password) < 6:
        raise HTTPException(400, "New password must be at least 6 characters")
    conn.execute(
        "UPDATE users SET password_hash = %s WHERE user_id = %s",
        (hash_password(form.new_password), user["user_id"]),
    )
    conn.commit()
    return {"message": "Password changed"}
