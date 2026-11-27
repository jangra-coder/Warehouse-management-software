import csv
import io
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from auth import get_current_user
from database import get_db, rows_to_list

router = APIRouter(prefix="/api/reports", tags=["reports"])

# employee and vendor movements joined into one list
MOVES = """
WITH moves AS (
    SELECT 'Employee' AS source, t.tx_id AS id, t.tx_type, DATE(t.created_at) AS day, t.created_at,
           e.name AS party, e.department, p.name AS product, p.sku, p.category,
           t.quantity, t.stock_type, t.quantity * p.price AS value,
           t.employee_id, NULL AS vendor_id
    FROM transactions t
    JOIN employees e ON e.employee_id = t.employee_id
    JOIN products p ON p.product_id = t.product_id
    UNION ALL
    SELECT 'Vendor', v.vtx_id, v.tx_type, DATE(v.created_at), v.created_at,
           d.name, 'Vendor', p.name, p.sku, p.category,
           v.quantity, v.stock_type, v.quantity * p.price,
           NULL, v.vendor_id
    FROM vendor_transactions v
    JOIN vendors d ON d.vendor_id = v.vendor_id
    JOIN products p ON p.product_id = v.product_id
)
"""

# what the user can group by -> column name (so no SQL injection)
GROUP_COLUMNS = {
    "category": "category",
    "product": "product",
    "party": "party",
    "type": "tx_type",
    "day": "day",
}


def build_where(from_date, to_date, source, tx_type, category, employee_id, vendor_id):
    where = ["1 = 1"]
    params = []
    if from_date:
        where.append("day >= %s")
        params.append(from_date)
    if to_date:
        where.append("day <= %s")
        params.append(to_date)
    if source:
        where.append("source = %s")
        params.append(source)
    if tx_type:
        where.append("tx_type = %s")
        params.append(tx_type)
    if category:
        where.append("category = %s")
        params.append(category)
    if employee_id:
        where.append("employee_id = %s")
        params.append(employee_id)
    if vendor_id:
        where.append("vendor_id = %s")
        params.append(vendor_id)
    return " AND ".join(where), params


def run_report(conn, group_by, **filters):
    where, params = build_where(**filters)
    if group_by:
        if group_by not in GROUP_COLUMNS:
            raise HTTPException(400, "Wrong group by value")
        col = GROUP_COLUMNS[group_by]
        sql = MOVES + f"""
            SELECT {col} AS group_name, COUNT(*) AS records,
                   SUM(quantity) AS total_qty, ROUND(SUM(value), 2) AS total_value
            FROM moves WHERE {where}
            GROUP BY {col} ORDER BY total_qty DESC"""
    else:
        sql = MOVES + f"SELECT * FROM moves WHERE {where} ORDER BY created_at DESC"
    return rows_to_list(conn.execute(sql, params).fetchall())


@router.get("")
def report(from_date: str = "", to_date: str = "", source: str = "", tx_type: str = "", category: str = "",
           employee_id: Optional[int] = None, vendor_id: Optional[int] = None, group_by: str = "",
           user=Depends(get_current_user), conn=Depends(get_db)):
    rows = run_report(conn, group_by, from_date=from_date, to_date=to_date, source=source, tx_type=tx_type,
                      category=category, employee_id=employee_id, vendor_id=vendor_id)
    if group_by:
        total_qty = sum(r["total_qty"] or 0 for r in rows)
        total_value = sum(r["total_value"] or 0 for r in rows)
    else:
        total_qty = sum(r["quantity"] for r in rows)
        total_value = sum(r["value"] or 0 for r in rows)
    return {"rows": rows, "total_qty": total_qty, "total_value": round(total_value, 2)}


@router.get("/csv")
def report_csv(from_date: str = "", to_date: str = "", source: str = "", tx_type: str = "", category: str = "",
               employee_id: Optional[int] = None, vendor_id: Optional[int] = None, group_by: str = "",
               user=Depends(get_current_user), conn=Depends(get_db)):
    rows = run_report(conn, group_by, from_date=from_date, to_date=to_date, source=source, tx_type=tx_type,
                      category=category, employee_id=employee_id, vendor_id=vendor_id)
    out = io.StringIO()
    if rows:
        writer = csv.DictWriter(out, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    return StreamingResponse(
        iter([out.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=report.csv"},
    )
