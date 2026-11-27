from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import get_current_user, staff_only
from database import get_db, rows_to_list

router = APIRouter(prefix="/api/vendors", tags=["vendors"])


class VendorForm(BaseModel):
    vendor_code: str
    name: str
    phone: Optional[str] = ""
    address: Optional[str] = ""
    is_active: bool = True


class WorkForm(BaseModel):
    work_name: str
    price: float = Field(0, ge=0)


@router.get("")
def list_vendors(search: str = "", active_only: bool = False,
                 user=Depends(get_current_user), conn=Depends(get_db)):
    sql = """SELECT v.*,
                 (SELECT COALESCE(SUM(t.remaining), 0) FROM vendor_transactions t
                  WHERE t.vendor_id = v.vendor_id) AS items_out
             FROM vendors v WHERE 1 = 1"""
    params = []
    if search:
        sql += " AND (v.name LIKE %s OR v.vendor_code LIKE %s OR v.phone LIKE %s)"
        params += [f"%{search}%"] * 3
    if active_only:
        sql += " AND v.is_active = 1"
    sql += " ORDER BY v.name"
    return rows_to_list(conn.execute(sql, params).fetchall())


@router.get("/{vendor_id}")
def vendor_profile(vendor_id: int, user=Depends(get_current_user), conn=Depends(get_db)):
    vendor = conn.execute("SELECT * FROM vendors WHERE vendor_id = %s", (vendor_id,)).fetchone()
    if vendor is None:
        raise HTTPException(404, "Vendor not found")
    works = conn.execute(
        "SELECT * FROM vendor_works WHERE vendor_id = %s ORDER BY work_name", (vendor_id,)
    ).fetchall()
    history = conn.execute(
        """SELECT t.*, p.name AS product_name, p.sku
           FROM vendor_transactions t JOIN products p ON p.product_id = t.product_id
           WHERE t.vendor_id = %s ORDER BY t.vtx_id DESC LIMIT 200""",
        (vendor_id,),
    ).fetchall()
    return {"vendor": dict(vendor), "works": rows_to_list(works), "transactions": rows_to_list(history)}


@router.post("")
def add_vendor(form: VendorForm, user=Depends(staff_only), conn=Depends(get_db)):
    if not form.vendor_code.strip() or not form.name.strip():
        raise HTTPException(400, "Vendor code and name are required")
    if conn.execute("SELECT 1 FROM vendors WHERE vendor_code = %s", (form.vendor_code.strip(),)).fetchone():
        raise HTTPException(400, "This vendor code already exists")
    cur = conn.execute(
        "INSERT INTO vendors (vendor_code, name, phone, address) VALUES (%s, %s, %s, %s)",
        (form.vendor_code.strip(), form.name.strip(), form.phone, form.address),
    )
    conn.commit()
    return {"message": "Vendor added", "vendor_id": cur.lastrowid}


@router.put("/{vendor_id}")
def edit_vendor(vendor_id: int, form: VendorForm, user=Depends(staff_only), conn=Depends(get_db)):
    if conn.execute(
        "SELECT 1 FROM vendors WHERE vendor_code = %s AND vendor_id != %s", (form.vendor_code.strip(), vendor_id)
    ).fetchone():
        raise HTTPException(400, "Another vendor already has this code")
    cur = conn.execute(
        "UPDATE vendors SET vendor_code = %s, name = %s, phone = %s, address = %s, is_active = %s WHERE vendor_id = %s",
        (form.vendor_code.strip(), form.name.strip(), form.phone, form.address, int(form.is_active), vendor_id),
    )
    if cur.rowcount == 0:
        raise HTTPException(404, "Vendor not found")
    conn.commit()
    return {"message": "Vendor updated"}


@router.delete("/{vendor_id}")
def delete_vendor(vendor_id: int, user=Depends(staff_only), conn=Depends(get_db)):
    n = conn.execute("SELECT COUNT(*) AS n FROM vendor_transactions WHERE vendor_id = %s", (vendor_id,)).fetchone()["n"]
    if n > 0:
        raise HTTPException(400, "This vendor has old records, mark the vendor inactive instead of deleting")
    conn.execute("DELETE FROM vendors WHERE vendor_id = %s", (vendor_id,))  # works are deleted by CASCADE
    conn.commit()
    return {"message": "Vendor deleted"}


# ---------- works (jobs) of a vendor ----------

@router.get("/{vendor_id}/works")
def list_works(vendor_id: int, user=Depends(get_current_user), conn=Depends(get_db)):
    rows = conn.execute("SELECT * FROM vendor_works WHERE vendor_id = %s ORDER BY work_name", (vendor_id,)).fetchall()
    return rows_to_list(rows)


@router.post("/{vendor_id}/works")
def add_work(vendor_id: int, form: WorkForm, user=Depends(staff_only), conn=Depends(get_db)):
    if not form.work_name.strip():
        raise HTTPException(400, "Work name is required")
    if conn.execute(
        "SELECT 1 FROM vendor_works WHERE vendor_id = %s AND work_name = %s", (vendor_id, form.work_name.strip())
    ).fetchone():
        raise HTTPException(400, "This vendor already has this work")
    conn.execute(
        "INSERT INTO vendor_works (vendor_id, work_name, price) VALUES (%s, %s, %s)",
        (vendor_id, form.work_name.strip(), form.price),
    )
    conn.commit()
    return {"message": "Work added"}


@router.put("/{vendor_id}/works/{work_id}")
def edit_work(vendor_id: int, work_id: int, form: WorkForm, user=Depends(staff_only), conn=Depends(get_db)):
    conn.execute(
        "UPDATE vendor_works SET work_name = %s, price = %s WHERE work_id = %s AND vendor_id = %s",
        (form.work_name.strip(), form.price, work_id, vendor_id),
    )
    conn.commit()
    return {"message": "Work updated"}


@router.delete("/{vendor_id}/works/{work_id}")
def delete_work(vendor_id: int, work_id: int, user=Depends(staff_only), conn=Depends(get_db)):
    conn.execute("DELETE FROM vendor_works WHERE work_id = %s AND vendor_id = %s", (work_id, vendor_id))
    conn.commit()
    return {"message": "Work deleted"}
