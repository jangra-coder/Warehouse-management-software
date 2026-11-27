from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import admin_only, hash_password
from database import get_db, rows_to_list

router = APIRouter(prefix="/api/users", tags=["users"])


class NewUserForm(BaseModel):
    username: str
    full_name: str
    password: str
    role: str = "user"


class EditUserForm(BaseModel):
    full_name: str
    role: str
    is_active: bool = True


class ResetForm(BaseModel):
    password: str


def check_role(role):
    if role not in ("admin", "manager", "user"):
        raise HTTPException(400, "Role must be admin, manager or user")


@router.get("")
def list_users(user=Depends(admin_only), conn=Depends(get_db)):
    rows = conn.execute(
        "SELECT user_id, username, full_name, role, is_active, created_at FROM users ORDER BY user_id"
    ).fetchall()
    return rows_to_list(rows)


@router.post("")
def add_user(form: NewUserForm, user=Depends(admin_only), conn=Depends(get_db)):
    check_role(form.role)
    if len(form.username.strip()) < 3:
        raise HTTPException(400, "Username must be at least 3 characters")
    if len(form.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    if conn.execute("SELECT 1 FROM users WHERE username = ?", (form.username.strip(),)).fetchone():
        raise HTTPException(400, "This username is taken")
    conn.execute(
        "INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)",
        (form.username.strip(), hash_password(form.password), form.full_name.strip(), form.role),
    )
    conn.commit()
    return {"message": "User added"}


@router.put("/{user_id}")
def edit_user(user_id: int, form: EditUserForm, user=Depends(admin_only), conn=Depends(get_db)):
    check_role(form.role)
    if user_id == user["user_id"] and (form.role != "admin" or not form.is_active):
        raise HTTPException(400, "You cannot remove your own admin access")
    conn.execute(
        "UPDATE users SET full_name = ?, role = ?, is_active = ? WHERE user_id = ?",
        (form.full_name.strip(), form.role, int(form.is_active), user_id),
    )
    if not form.is_active:
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))  # log them out
    conn.commit()
    return {"message": "User updated"}


@router.post("/{user_id}/reset-password")
def reset_password(user_id: int, form: ResetForm, user=Depends(admin_only), conn=Depends(get_db)):
    if len(form.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    conn.execute("UPDATE users SET password_hash = ? WHERE user_id = ?", (hash_password(form.password), user_id))
    conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
    conn.commit()
    return {"message": "Password reset"}
