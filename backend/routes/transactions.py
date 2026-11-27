from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import get_current_user, staff_only
from database import get_db, rows_to_list
from stock import change_stock, get_product, where_it_goes_back

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


class IssueLine(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)
    stock_type: str = "new"


class IssueForm(BaseModel):
    employee_id: int
    items: List[IssueLine]
    notes: Optional[str] = ""


class ReturnForm(BaseModel):
    quantity: int = Field(gt=0)
    condition: str = "good"  # good / damaged / consumed
    notes: Optional[str] = ""


class TransferForm(BaseModel):
    to_employee_id: int
    quantity: int = Field(gt=0)
    notes: Optional[str] = ""


def get_active_employee(conn, employee_id):
    emp = conn.execute("SELECT * FROM employees WHERE employee_id = ?", (employee_id,)).fetchone()
    if emp is None:
        raise HTTPException(404, "Employee not found")
    if not emp["is_active"]:
        raise HTTPException(400, f"{emp['name']} is inactive")
    return emp


def issue_item(conn, employee_id, product_id, quantity, stock_type, notes, user_id):
    """Give an item to an employee. Used by the issue page and by request approval."""
    product = get_product(conn, product_id)
    emp = get_active_employee(conn, employee_id)
    change_stock(conn, product_id, stock_type, -quantity, "ISSUE", f"Issued to {emp['name']}", user_id)

    # consumables (not returnable) are used up, so nothing stays "remaining"
    if product["is_returnable"]:
        remaining, condition = quantity, None
    else:
        remaining, condition = 0, "consumed"

    cur = conn.execute(
        """INSERT INTO transactions (tx_type, employee_id, product_id, quantity, stock_type,
               item_condition, remaining, notes, done_by)
           VALUES ('ISSUE', ?, ?, ?, ?, ?, ?, ?, ?)""",
        (employee_id, product_id, quantity, stock_type, condition, remaining, notes, user_id),
    )
    return cur.lastrowid


def get_open_row(conn, tx_id):
    row = conn.execute(
        "SELECT * FROM transactions WHERE tx_id = ? AND tx_type IN ('ISSUE', 'TRANSFER')", (tx_id,)
    ).fetchone()
    if row is None:
        raise HTTPException(404, "Transaction not found")
    return row


def take_out(conn, tx_id, quantity):
    # "remaining >= ?" stops two people from returning the same item twice
    cur = conn.execute(
        "UPDATE transactions SET remaining = remaining - ? WHERE tx_id = ? AND remaining >= ?",
        (quantity, tx_id, quantity),
    )
    if cur.rowcount == 0:
        raise HTTPException(400, "This item was already returned or moved")


@router.get("")
def history(employee_id: Optional[int] = None, tx_type: str = "", search: str = "", limit: int = 300,
            user=Depends(get_current_user), conn=Depends(get_db)):
    sql = """SELECT t.*, e.name AS employee_name, e.emp_code, p.name AS product_name, p.sku,
                    u.full_name AS done_by_name
             FROM transactions t
             JOIN employees e ON e.employee_id = t.employee_id
             JOIN products p ON p.product_id = t.product_id
             LEFT JOIN users u ON u.user_id = t.done_by
             WHERE 1 = 1"""
    params = []
    if employee_id:
        sql += " AND t.employee_id = ?"
        params.append(employee_id)
    if tx_type:
        sql += " AND t.tx_type = ?"
        params.append(tx_type)
    if search:
        sql += " AND (e.name LIKE ? OR p.name LIKE ? OR p.sku LIKE ?)"
        params += [f"%{search}%"] * 3
    sql += " ORDER BY t.tx_id DESC LIMIT ?"
    params.append(limit)
    return rows_to_list(conn.execute(sql, params).fetchall())


@router.get("/open")
def open_items(search: str = "", user=Depends(get_current_user), conn=Depends(get_db)):
    """Items that are with employees right now (can be returned or transferred)."""
    sql = """SELECT t.*, e.name AS employee_name, e.emp_code, p.name AS product_name, p.sku
             FROM transactions t
             JOIN employees e ON e.employee_id = t.employee_id
             JOIN products p ON p.product_id = t.product_id
             WHERE t.remaining > 0"""
    params = []
    if search:
        sql += " AND (e.name LIKE ? OR e.emp_code LIKE ? OR p.name LIKE ? OR p.sku LIKE ?)"
        params += [f"%{search}%"] * 4
    sql += " ORDER BY t.created_at"
    return rows_to_list(conn.execute(sql, params).fetchall())


@router.post("/issue")
def issue(form: IssueForm, user=Depends(staff_only), conn=Depends(get_db)):
    if not form.items:
        raise HTTPException(400, "Add at least one item")
    # all items are issued together: if one fails we do not commit,
    # so none of them is saved (this is a database transaction)
    tx_ids = []
    for line in form.items:
        tx_ids.append(issue_item(conn, form.employee_id, line.product_id, line.quantity,
                                 line.stock_type, form.notes, user["user_id"]))
    conn.commit()
    return {"message": f"{len(tx_ids)} item(s) issued", "tx_ids": tx_ids}


@router.post("/{tx_id}/return")
def return_item(tx_id: int, form: ReturnForm, user=Depends(staff_only), conn=Depends(get_db)):
    row = get_open_row(conn, tx_id)
    if form.condition not in ("good", "damaged", "consumed"):
        raise HTTPException(400, "Condition must be good, damaged or consumed")
    if form.quantity > row["remaining"]:
        raise HTTPException(400, f"Only {row['remaining']} of this item is with the employee")

    take_out(conn, tx_id, form.quantity)
    conn.execute(
        """INSERT INTO transactions (tx_type, employee_id, product_id, quantity, stock_type,
               item_condition, ref_tx_id, notes, done_by)
           VALUES ('RETURN', ?, ?, ?, ?, ?, ?, ?, ?)""",
        (row["employee_id"], row["product_id"], form.quantity, row["stock_type"],
         form.condition, tx_id, form.notes, user["user_id"]),
    )

    back_to = where_it_goes_back(form.condition, row["stock_type"])
    if back_to:
        change_stock(conn, row["product_id"], back_to, form.quantity, "RETURN",
                     f"Returned ({form.condition}) from tx #{tx_id}", user["user_id"])
    conn.commit()
    return {"message": "Item returned"}


@router.post("/{tx_id}/transfer")
def transfer_item(tx_id: int, form: TransferForm, user=Depends(staff_only), conn=Depends(get_db)):
    row = get_open_row(conn, tx_id)
    if form.to_employee_id == row["employee_id"]:
        raise HTTPException(400, "Choose a different employee")
    get_active_employee(conn, form.to_employee_id)
    if form.quantity > row["remaining"]:
        raise HTTPException(400, f"Only {row['remaining']} of this item is with the employee")

    # stock in the warehouse does not change, the item only moves between people
    take_out(conn, tx_id, form.quantity)
    cur = conn.execute(
        """INSERT INTO transactions (tx_type, employee_id, product_id, quantity, stock_type,
               remaining, ref_tx_id, notes, done_by)
           VALUES ('TRANSFER', ?, ?, ?, ?, ?, ?, ?, ?)""",
        (form.to_employee_id, row["product_id"], form.quantity, row["stock_type"],
         form.quantity, tx_id, form.notes, user["user_id"]),
    )
    conn.commit()
    return {"message": "Item transferred", "tx_id": cur.lastrowid}
