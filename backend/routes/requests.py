from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import get_current_user, staff_only
from database import get_db, rows_to_list
from routes.transactions import get_active_employee, issue_item
from stock import get_product

router = APIRouter(prefix="/api/requests", tags=["requests"])


class RequestForm(BaseModel):
    employee_id: int
    product_id: int
    quantity: int = Field(gt=0)
    stock_type: str = "new"
    note: Optional[str] = ""


class DeclineForm(BaseModel):
    note: Optional[str] = ""


@router.get("")
def list_requests(status: str = "", user=Depends(get_current_user), conn=Depends(get_db)):
    sql = """SELECT r.*, e.name AS employee_name, e.emp_code, e.department,
                    p.name AS product_name, p.sku,
                    CASE WHEN r.stock_type = 'new' THEN p.new_stock ELSE p.used_stock END AS available,
                    u1.full_name AS requested_by_name, u2.full_name AS decided_by_name
             FROM product_requests r
             JOIN employees e ON e.employee_id = r.employee_id
             JOIN products p ON p.product_id = r.product_id
             LEFT JOIN users u1 ON u1.user_id = r.requested_by
             LEFT JOIN users u2 ON u2.user_id = r.decided_by
             WHERE 1 = 1"""
    params = []
    if status:
        sql += " AND r.status = ?"
        params.append(status)
    sql += " ORDER BY r.request_id DESC"
    return rows_to_list(conn.execute(sql, params).fetchall())


@router.post("")
def make_request(form: RequestForm, user=Depends(get_current_user), conn=Depends(get_db)):
    get_active_employee(conn, form.employee_id)
    get_product(conn, form.product_id)
    if form.stock_type not in ("new", "used"):
        raise HTTPException(400, "Stock type must be new or used")
    cur = conn.execute(
        """INSERT INTO product_requests (employee_id, product_id, quantity, stock_type, note, requested_by)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (form.employee_id, form.product_id, form.quantity, form.stock_type, form.note, user["user_id"]),
    )
    conn.commit()
    return {"message": "Request sent", "request_id": cur.lastrowid}


def get_pending(conn, request_id):
    r = conn.execute("SELECT * FROM product_requests WHERE request_id = ?", (request_id,)).fetchone()
    if r is None:
        raise HTTPException(404, "Request not found")
    if r["status"] != "pending":
        raise HTTPException(400, f"This request is already {r['status']}")
    return r


@router.post("/{request_id}/approve")
def approve(request_id: int, user=Depends(staff_only), conn=Depends(get_db)):
    r = get_pending(conn, request_id)
    # approving gives the item to the employee straight away
    tx_id = issue_item(conn, r["employee_id"], r["product_id"], r["quantity"], r["stock_type"],
                       f"Request #{request_id}", user["user_id"])
    cur = conn.execute(
        """UPDATE product_requests SET status = 'approved', decided_by = ?,
               decided_at = datetime('now', 'localtime'), issued_tx_id = ?
           WHERE request_id = ? AND status = 'pending'""",
        (user["user_id"], tx_id, request_id),
    )
    if cur.rowcount == 0:
        raise HTTPException(400, "Someone else already decided this request")
    conn.commit()
    return {"message": "Request approved and item issued", "tx_id": tx_id}


@router.post("/{request_id}/decline")
def decline(request_id: int, form: DeclineForm, user=Depends(staff_only), conn=Depends(get_db)):
    r = get_pending(conn, request_id)
    note = r["note"] or ""
    if form.note:
        note = (note + " | " if note else "") + "Declined: " + form.note
    conn.execute(
        """UPDATE product_requests SET status = 'declined', decided_by = ?,
               decided_at = datetime('now', 'localtime'), note = ?
           WHERE request_id = ? AND status = 'pending'""",
        (user["user_id"], note, request_id),
    )
    conn.commit()
    return {"message": "Request declined"}
