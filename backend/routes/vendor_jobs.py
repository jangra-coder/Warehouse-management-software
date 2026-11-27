from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import get_current_user, staff_only
from database import get_db, rows_to_list
from stock import change_stock, get_product, where_it_goes_back

router = APIRouter(prefix="/api/vendor-jobs", tags=["vendor jobs"])


class SendLine(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)
    stock_type: str = "new"
    work_name: Optional[str] = ""
    expected_return: Optional[str] = None  # date like 2026-12-05


class SendForm(BaseModel):
    vendor_id: int
    items: List[SendLine]
    notes: Optional[str] = ""


class ReceiveForm(BaseModel):
    quantity: int = Field(gt=0)
    condition: str = "good"
    amount_paid: float = Field(0, ge=0)
    notes: Optional[str] = ""


class VendorTransferForm(BaseModel):
    to_vendor_id: int
    quantity: int = Field(gt=0)
    work_name: Optional[str] = ""
    notes: Optional[str] = ""


def get_active_vendor(conn, vendor_id):
    v = conn.execute("SELECT * FROM vendors WHERE vendor_id = ?", (vendor_id,)).fetchone()
    if v is None:
        raise HTTPException(404, "Vendor not found")
    if not v["is_active"]:
        raise HTTPException(400, f"{v['name']} is inactive")
    return v


def work_price(conn, vendor_id, work_name):
    if not work_name:
        return 0
    w = conn.execute(
        "SELECT price FROM vendor_works WHERE vendor_id = ? AND work_name = ?", (vendor_id, work_name)
    ).fetchone()
    if w is None:
        raise HTTPException(400, f"This vendor does not do '{work_name}'")
    return w["price"]


def take_out(conn, vtx_id, quantity):
    cur = conn.execute(
        "UPDATE vendor_transactions SET remaining = remaining - ? WHERE vtx_id = ? AND remaining >= ?",
        (quantity, vtx_id, quantity),
    )
    if cur.rowcount == 0:
        raise HTTPException(400, "This item was already received back or moved")


def get_open_row(conn, vtx_id):
    row = conn.execute(
        "SELECT * FROM vendor_transactions WHERE vtx_id = ? AND tx_type IN ('SEND', 'TRANSFER')", (vtx_id,)
    ).fetchone()
    if row is None:
        raise HTTPException(404, "Vendor job not found")
    return row


@router.get("")
def history(vendor_id: Optional[int] = None, tx_type: str = "", search: str = "", limit: int = 300,
            user=Depends(get_current_user), conn=Depends(get_db)):
    sql = """SELECT t.*, v.name AS vendor_name, v.vendor_code, p.name AS product_name, p.sku,
                    u.full_name AS done_by_name
             FROM vendor_transactions t
             JOIN vendors v ON v.vendor_id = t.vendor_id
             JOIN products p ON p.product_id = t.product_id
             LEFT JOIN users u ON u.user_id = t.done_by
             WHERE 1 = 1"""
    params = []
    if vendor_id:
        sql += " AND t.vendor_id = ?"
        params.append(vendor_id)
    if tx_type:
        sql += " AND t.tx_type = ?"
        params.append(tx_type)
    if search:
        sql += " AND (v.name LIKE ? OR p.name LIKE ? OR p.sku LIKE ?)"
        params += [f"%{search}%"] * 3
    sql += " ORDER BY t.vtx_id DESC LIMIT ?"
    params.append(limit)
    return rows_to_list(conn.execute(sql, params).fetchall())


@router.get("/open")
def open_jobs(search: str = "", user=Depends(get_current_user), conn=Depends(get_db)):
    """Items that are at vendors right now."""
    sql = """SELECT t.*, v.name AS vendor_name, v.vendor_code, p.name AS product_name, p.sku,
                    CASE WHEN t.expected_return < date('now', 'localtime') THEN 1 ELSE 0 END AS is_late
             FROM vendor_transactions t
             JOIN vendors v ON v.vendor_id = t.vendor_id
             JOIN products p ON p.product_id = t.product_id
             WHERE t.remaining > 0"""
    params = []
    if search:
        sql += " AND (v.name LIKE ? OR p.name LIKE ? OR p.sku LIKE ?)"
        params += [f"%{search}%"] * 3
    sql += " ORDER BY t.created_at"
    return rows_to_list(conn.execute(sql, params).fetchall())


@router.post("/send")
def send_to_vendor(form: SendForm, user=Depends(staff_only), conn=Depends(get_db)):
    if not form.items:
        raise HTTPException(400, "Add at least one item")
    vendor = get_active_vendor(conn, form.vendor_id)
    ids = []
    for line in form.items:
        get_product(conn, line.product_id)
        price = work_price(conn, form.vendor_id, line.work_name)
        change_stock(conn, line.product_id, line.stock_type, -line.quantity, "SEND",
                     f"Sent to {vendor['name']}", user["user_id"])
        cur = conn.execute(
            """INSERT INTO vendor_transactions (tx_type, vendor_id, product_id, quantity, stock_type,
                   work_name, work_price, expected_return, remaining, notes, done_by)
               VALUES ('SEND', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (form.vendor_id, line.product_id, line.quantity, line.stock_type, line.work_name, price,
             line.expected_return or None, line.quantity, form.notes, user["user_id"]),
        )
        ids.append(cur.lastrowid)
    conn.commit()
    return {"message": f"{len(ids)} item(s) sent to {vendor['name']}", "vtx_ids": ids}


@router.post("/{vtx_id}/receive")
def receive_from_vendor(vtx_id: int, form: ReceiveForm, user=Depends(staff_only), conn=Depends(get_db)):
    row = get_open_row(conn, vtx_id)
    if form.condition not in ("good", "damaged", "consumed"):
        raise HTTPException(400, "Condition must be good, damaged or consumed")
    if form.quantity > row["remaining"]:
        raise HTTPException(400, f"Only {row['remaining']} of this item is at the vendor")

    take_out(conn, vtx_id, form.quantity)
    conn.execute(
        """INSERT INTO vendor_transactions (tx_type, vendor_id, product_id, quantity, stock_type,
               work_name, work_price, item_condition, amount_paid, ref_vtx_id, notes, done_by)
           VALUES ('RECEIVE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (row["vendor_id"], row["product_id"], form.quantity, row["stock_type"], row["work_name"],
         row["work_price"], form.condition, form.amount_paid, vtx_id, form.notes, user["user_id"]),
    )
    back_to = where_it_goes_back(form.condition, row["stock_type"])
    if back_to:
        change_stock(conn, row["product_id"], back_to, form.quantity, "RECEIVE",
                     f"Received ({form.condition}) from vendor job #{vtx_id}", user["user_id"])
    conn.commit()
    return {"message": "Item received back"}


@router.post("/{vtx_id}/transfer")
def transfer_to_vendor(vtx_id: int, form: VendorTransferForm, user=Depends(staff_only), conn=Depends(get_db)):
    row = get_open_row(conn, vtx_id)
    if form.to_vendor_id == row["vendor_id"]:
        raise HTTPException(400, "Choose a different vendor")
    get_active_vendor(conn, form.to_vendor_id)
    if form.quantity > row["remaining"]:
        raise HTTPException(400, f"Only {row['remaining']} of this item is at the vendor")

    price = work_price(conn, form.to_vendor_id, form.work_name)
    take_out(conn, vtx_id, form.quantity)
    cur = conn.execute(
        """INSERT INTO vendor_transactions (tx_type, vendor_id, product_id, quantity, stock_type,
               work_name, work_price, expected_return, remaining, ref_vtx_id, notes, done_by)
           VALUES ('TRANSFER', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (form.to_vendor_id, row["product_id"], form.quantity, row["stock_type"], form.work_name, price,
         row["expected_return"], form.quantity, vtx_id, form.notes, user["user_id"]),
    )
    conn.commit()
    return {"message": "Item moved to the new vendor", "vtx_id": cur.lastrowid}
