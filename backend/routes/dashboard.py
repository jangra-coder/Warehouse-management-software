from fastapi import APIRouter, Depends

from auth import get_current_user
from database import get_db, rows_to_list

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(user=Depends(get_current_user), conn=Depends(get_db)):
    totals = conn.execute(
        """SELECT COUNT(*) AS products,
                  COALESCE(SUM(on_shelf), 0) AS on_shelf,
                  COALESCE(SUM(on_shelf * price), 0) AS stock_value,
                  COALESCE(SUM(with_employees), 0) AS with_employees,
                  COALESCE(SUM(with_vendors), 0) AS with_vendors,
                  COALESCE(SUM(CASE WHEN on_shelf <= low_stock_limit THEN 1 ELSE 0 END), 0) AS low_stock
           FROM product_stock WHERE is_deleted = 0"""
    ).fetchone()
    employees = conn.execute("SELECT COUNT(*) AS n FROM employees WHERE is_active = 1").fetchone()["n"]
    pending = conn.execute("SELECT COUNT(*) AS n FROM product_requests WHERE status = 'pending'").fetchone()["n"]

    low_stock = conn.execute(
        """SELECT product_id, sku, name, on_shelf, low_stock_limit FROM product_stock
           WHERE is_deleted = 0 AND on_shelf <= low_stock_limit ORDER BY on_shelf LIMIT 10"""
    ).fetchall()

    by_category = conn.execute(
        """SELECT category, SUM(on_shelf) AS qty, ROUND(SUM(on_shelf * price), 2) AS value
           FROM product_stock WHERE is_deleted = 0 GROUP BY category ORDER BY value DESC"""
    ).fetchall()

    recent = conn.execute(
        """SELECT * FROM (
               SELECT t.created_at, t.tx_type, e.name AS party, p.name AS product, t.quantity
               FROM transactions t JOIN employees e ON e.employee_id = t.employee_id
               JOIN products p ON p.product_id = t.product_id
               UNION ALL
               SELECT v.created_at, v.tx_type, d.name, p.name, v.quantity
               FROM vendor_transactions v JOIN vendors d ON d.vendor_id = v.vendor_id
               JOIN products p ON p.product_id = v.product_id
           ) ORDER BY created_at DESC LIMIT 10"""
    ).fetchall()

    return {
        "totals": dict(totals),
        "active_employees": employees,
        "pending_requests": pending,
        "low_stock": rows_to_list(low_stock),
        "by_category": rows_to_list(by_category),
        "recent": rows_to_list(recent),
    }
