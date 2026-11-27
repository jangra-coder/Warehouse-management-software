from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import get_current_user, staff_only
from database import get_db, rows_to_list
from stock import change_stock, get_product

router = APIRouter(prefix="/api/products", tags=["products"])


class ProductForm(BaseModel):
    sku: str
    name: str
    category: str
    make: Optional[str] = ""
    material: Optional[str] = ""
    price: float = Field(0, ge=0)
    low_stock_limit: int = Field(5, ge=0)
    is_returnable: bool = True
    description: Optional[str] = ""
    opening_stock: int = Field(0, ge=0)  # only used when adding a new product


class StockForm(BaseModel):
    stock_type: str = "new"
    quantity: int = Field(gt=0)
    action: str  # "add" or "remove"
    notes: Optional[str] = ""


@router.get("")
def list_products(search: str = "", category: str = "", low_only: bool = False,
                  user=Depends(get_current_user), conn=Depends(get_db)):
    sql = "SELECT * FROM product_stock WHERE is_deleted = 0"
    params = []
    if search:
        sql += " AND (name LIKE ? OR sku LIKE ? OR make LIKE ?)"
        params += [f"%{search}%"] * 3
    if category:
        sql += " AND category = ?"
        params.append(category)
    if low_only:
        sql += " AND on_shelf <= low_stock_limit"
    sql += " ORDER BY name"
    return rows_to_list(conn.execute(sql, params).fetchall())


@router.get("/categories")
def categories(user=Depends(get_current_user), conn=Depends(get_db)):
    rows = conn.execute(
        "SELECT DISTINCT category FROM products WHERE is_deleted = 0 ORDER BY category"
    ).fetchall()
    return [r["category"] for r in rows]


@router.get("/{product_id}")
def product_details(product_id: int, user=Depends(get_current_user), conn=Depends(get_db)):
    p = conn.execute("SELECT * FROM product_stock WHERE product_id = ?", (product_id,)).fetchone()
    if p is None:
        raise HTTPException(404, "Product not found")

    # who has this product right now
    with_employees = conn.execute(
        """SELECT t.tx_id, t.remaining, t.stock_type, t.created_at, e.name AS employee_name, e.emp_code
           FROM transactions t JOIN employees e ON e.employee_id = t.employee_id
           WHERE t.product_id = ? AND t.remaining > 0 ORDER BY t.created_at""",
        (product_id,),
    ).fetchall()
    with_vendors = conn.execute(
        """SELECT v.vtx_id, v.remaining, v.stock_type, v.work_name, v.created_at, d.name AS vendor_name
           FROM vendor_transactions v JOIN vendors d ON d.vendor_id = v.vendor_id
           WHERE v.product_id = ? AND v.remaining > 0 ORDER BY v.created_at""",
        (product_id,),
    ).fetchall()
    return {
        "product": dict(p),
        "with_employees": rows_to_list(with_employees),
        "with_vendors": rows_to_list(with_vendors),
    }


@router.get("/{product_id}/history")
def stock_history(product_id: int, user=Depends(get_current_user), conn=Depends(get_db)):
    rows = conn.execute(
        """SELECT h.*, u.full_name AS done_by_name
           FROM stock_history h LEFT JOIN users u ON u.user_id = h.done_by
           WHERE h.product_id = ? ORDER BY h.history_id DESC""",
        (product_id,),
    ).fetchall()
    return rows_to_list(rows)


@router.post("")
def add_product(form: ProductForm, user=Depends(staff_only), conn=Depends(get_db)):
    if not form.sku.strip() or not form.name.strip() or not form.category.strip():
        raise HTTPException(400, "SKU, name and category are required")
    if conn.execute("SELECT 1 FROM products WHERE sku = ?", (form.sku.strip(),)).fetchone():
        raise HTTPException(400, "This SKU already exists")

    cur = conn.execute(
        """INSERT INTO products (sku, name, category, make, material, price,
               low_stock_limit, is_returnable, description)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (form.sku.strip(), form.name.strip(), form.category.strip(), form.make, form.material,
         form.price, form.low_stock_limit, int(form.is_returnable), form.description),
    )
    product_id = cur.lastrowid
    if form.opening_stock > 0:
        change_stock(conn, product_id, "new", form.opening_stock, "ADD", "Opening stock", user["user_id"])
    conn.commit()
    return {"message": "Product added", "product_id": product_id}


@router.put("/{product_id}")
def edit_product(product_id: int, form: ProductForm, user=Depends(staff_only), conn=Depends(get_db)):
    old = get_product(conn, product_id)
    same_sku = conn.execute(
        "SELECT 1 FROM products WHERE sku = ? AND product_id != ?", (form.sku.strip(), product_id)
    ).fetchone()
    if same_sku:
        raise HTTPException(400, "Another product already has this SKU")

    conn.execute(
        """UPDATE products SET sku = ?, name = ?, category = ?, make = ?, material = ?, price = ?,
               low_stock_limit = ?, is_returnable = ?, description = ?
           WHERE product_id = ?""",
        (form.sku.strip(), form.name.strip(), form.category.strip(), form.make, form.material,
         form.price, form.low_stock_limit, int(form.is_returnable), form.description, product_id),
    )
    conn.execute(
        """INSERT INTO stock_history (product_id, action, quantity, new_before, new_after,
               used_before, used_after, notes, done_by)
           VALUES (?, 'EDIT', 0, ?, ?, ?, ?, 'Product details edited', ?)""",
        (product_id, old["new_stock"], old["new_stock"], old["used_stock"], old["used_stock"], user["user_id"]),
    )
    conn.commit()
    return {"message": "Product updated"}


@router.post("/{product_id}/stock")
def update_stock(product_id: int, form: StockForm, user=Depends(staff_only), conn=Depends(get_db)):
    if form.action == "add":
        change_stock(conn, product_id, form.stock_type, form.quantity, "ADD", form.notes, user["user_id"])
    elif form.action == "remove":
        change_stock(conn, product_id, form.stock_type, -form.quantity, "REMOVE", form.notes, user["user_id"])
    else:
        raise HTTPException(400, "Action must be add or remove")
    conn.commit()
    return {"message": "Stock updated"}


@router.delete("/{product_id}")
def delete_product(product_id: int, user=Depends(staff_only), conn=Depends(get_db)):
    p = conn.execute("SELECT * FROM product_stock WHERE product_id = ?", (product_id,)).fetchone()
    if p is None:
        raise HTTPException(404, "Product not found")
    if p["with_employees"] > 0 or p["with_vendors"] > 0:
        raise HTTPException(400, "This product is still with an employee or vendor, take it back first")

    # we do not really delete it, old transactions still point to it
    conn.execute("UPDATE products SET is_deleted = 1 WHERE product_id = ?", (product_id,))
    conn.commit()
    return {"message": "Product deleted"}
