from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import get_current_user, staff_only
from database import get_db, rows_to_list

router = APIRouter(prefix="/api/employees", tags=["employees"])


class EmployeeForm(BaseModel):
    emp_code: str
    name: str
    department: str
    phone: Optional[str] = ""
    is_active: bool = True


@router.get("")
def list_employees(search: str = "", active_only: bool = False,
                   user=Depends(get_current_user), conn=Depends(get_db)):
    sql = """SELECT e.*,
                 (SELECT COALESCE(SUM(t.remaining), 0) FROM transactions t
                  WHERE t.employee_id = e.employee_id) AS items_out
             FROM employees e WHERE 1 = 1"""
    params = []
    if search:
        sql += " AND (e.name LIKE %s OR e.emp_code LIKE %s OR e.department LIKE %s)"
        params += [f"%{search}%"] * 3
    if active_only:
        sql += " AND e.is_active = 1"
    sql += " ORDER BY e.name"
    return rows_to_list(conn.execute(sql, params).fetchall())


@router.get("/{employee_id}")
def employee_profile(employee_id: int, user=Depends(get_current_user), conn=Depends(get_db)):
    emp = conn.execute("SELECT * FROM employees WHERE employee_id = %s", (employee_id,)).fetchone()
    if emp is None:
        raise HTTPException(404, "Employee not found")
    history = conn.execute(
        """SELECT t.*, p.name AS product_name, p.sku
           FROM transactions t JOIN products p ON p.product_id = t.product_id
           WHERE t.employee_id = %s ORDER BY t.tx_id DESC LIMIT 200""",
        (employee_id,),
    ).fetchall()
    return {"employee": dict(emp), "transactions": rows_to_list(history)}


@router.post("")
def add_employee(form: EmployeeForm, user=Depends(staff_only), conn=Depends(get_db)):
    if not form.emp_code.strip() or not form.name.strip() or not form.department.strip():
        raise HTTPException(400, "Code, name and department are required")
    if conn.execute("SELECT 1 FROM employees WHERE emp_code = %s", (form.emp_code.strip(),)).fetchone():
        raise HTTPException(400, "This employee code already exists")
    cur = conn.execute(
        "INSERT INTO employees (emp_code, name, department, phone) VALUES (%s, %s, %s, %s)",
        (form.emp_code.strip(), form.name.strip(), form.department.strip(), form.phone),
    )
    conn.commit()
    return {"message": "Employee added", "employee_id": cur.lastrowid}


@router.put("/{employee_id}")
def edit_employee(employee_id: int, form: EmployeeForm, user=Depends(staff_only), conn=Depends(get_db)):
    if conn.execute(
        "SELECT 1 FROM employees WHERE emp_code = %s AND employee_id != %s", (form.emp_code.strip(), employee_id)
    ).fetchone():
        raise HTTPException(400, "Another employee already has this code")
    cur = conn.execute(
        """UPDATE employees SET emp_code = %s, name = %s, department = %s, phone = %s, is_active = %s
           WHERE employee_id = %s""",
        (form.emp_code.strip(), form.name.strip(), form.department.strip(), form.phone,
         int(form.is_active), employee_id),
    )
    if cur.rowcount == 0:
        raise HTTPException(404, "Employee not found")
    conn.commit()
    return {"message": "Employee updated"}


@router.delete("/{employee_id}")
def delete_employee(employee_id: int, user=Depends(staff_only), conn=Depends(get_db)):
    used = conn.execute(
        """SELECT (SELECT COUNT(*) FROM transactions WHERE employee_id = %s)
                + (SELECT COUNT(*) FROM product_requests WHERE employee_id = %s) AS n""",
        (employee_id, employee_id),
    ).fetchone()["n"]
    if used > 0:
        raise HTTPException(400, "This employee has old records, mark the employee inactive instead of deleting")
    conn.execute("DELETE FROM employees WHERE employee_id = %s", (employee_id,))
    conn.commit()
    return {"message": "Employee deleted"}
