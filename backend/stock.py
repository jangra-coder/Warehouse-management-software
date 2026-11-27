from fastapi import HTTPException


def get_product(conn, product_id):
    p = conn.execute(
        "SELECT * FROM products WHERE product_id = %s AND is_deleted = 0", (product_id,)
    ).fetchone()
    if p is None:
        raise HTTPException(404, "Product not found")
    return p


def change_stock(conn, product_id, stock_type, change, action, notes, user_id):
    """Add (+) or take out (-) items from new_stock or used_stock,
    and write the change in stock_history.
    Does not commit, the route commits when everything is done."""
    if stock_type not in ("new", "used"):
        raise HTTPException(400, "Stock type must be new or used")
    column = "new_stock" if stock_type == "new" else "used_stock"

    before = get_product(conn, product_id)

    # the WHERE part makes sure stock never goes below zero,
    # even if two people press the button at the same time
    cur = conn.execute(
        f"UPDATE products SET {column} = {column} + %s WHERE product_id = %s AND {column} + %s >= 0",
        (change, product_id, change),
    )
    if cur.rowcount == 0:
        raise HTTPException(
            400, f"Not enough {stock_type} stock of {before['name']} (available: {before[column]})"
        )

    after = get_product(conn, product_id)
    conn.execute(
        """INSERT INTO stock_history (product_id, action, stock_type, quantity,
               new_before, new_after, used_before, used_after, notes, done_by)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (product_id, action, stock_type, abs(change),
         before["new_stock"], after["new_stock"], before["used_stock"], after["used_stock"],
         notes, user_id),
    )


def where_it_goes_back(condition, stock_type):
    """When an item comes back:
    good     -> back to the same stock it came from
    damaged  -> goes to used stock
    consumed -> used up, does not come back to stock"""
    if condition == "good":
        return stock_type
    if condition == "damaged":
        return "used"
    return None
