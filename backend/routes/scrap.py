from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from auth import get_current_user, staff_only
from database import get_db, rows_to_list
from stock import change_stock

router = APIRouter(prefix="/api/scrap", tags=["scrap"])


class ScrapForm(BaseModel):
    product_id: int
    stock_type: str = "used"
    quantity: int = Field(gt=0)
    weight_kg: Optional[float] = Field(None, ge=0)
    reason: Optional[str] = ""


@router.get("")
def list_scrap(search: str = "", user=Depends(get_current_user), conn=Depends(get_db)):
    sql = """SELECT s.*, p.name AS product_name, p.sku, p.category, u.full_name AS done_by_name
             FROM scrap s
             JOIN products p ON p.product_id = s.product_id
             LEFT JOIN users u ON u.user_id = s.done_by
             WHERE 1 = 1"""
    params = []
    if search:
        sql += " AND (p.name LIKE ? OR p.sku LIKE ? OR s.reason LIKE ?)"
        params += [f"%{search}%"] * 3
    sql += " ORDER BY s.scrap_id DESC"
    rows = rows_to_list(conn.execute(sql, params).fetchall())
    total_qty = sum(r["quantity"] for r in rows)
    total_weight = sum(r["weight_kg"] or 0 for r in rows)
    return {"rows": rows, "total_qty": total_qty, "total_weight": round(total_weight, 2)}


@router.post("")
def add_scrap(form: ScrapForm, user=Depends(staff_only), conn=Depends(get_db)):
    change_stock(conn, form.product_id, form.stock_type, -form.quantity, "SCRAP",
                 form.reason or "Scrapped", user["user_id"])
    conn.execute(
        "INSERT INTO scrap (product_id, stock_type, quantity, weight_kg, reason, done_by) VALUES (?, ?, ?, ?, ?, ?)",
        (form.product_id, form.stock_type, form.quantity, form.weight_kg, form.reason, user["user_id"]),
    )
    conn.commit()
    return {"message": "Scrap recorded"}
