-- Warehouse Management Software
-- Database schema (SQLite)
-- Run by init_db.py, the app also runs it on startup (IF NOT EXISTS)

PRAGMA foreign_keys = ON;

-- people who log in to the software
CREATE TABLE IF NOT EXISTS users (
    user_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name     TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
    is_active     INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- login sessions (token is saved in the browser)
CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- items kept in the warehouse
-- stock is kept in two parts: new items and used items
CREATE TABLE IF NOT EXISTS products (
    product_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    sku             TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    category        TEXT NOT NULL,
    make            TEXT,
    material        TEXT,
    price           REAL NOT NULL DEFAULT 0 CHECK (price >= 0),
    new_stock       INTEGER NOT NULL DEFAULT 0 CHECK (new_stock >= 0),
    used_stock      INTEGER NOT NULL DEFAULT 0 CHECK (used_stock >= 0),
    low_stock_limit INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_limit >= 0),
    is_returnable   INTEGER NOT NULL DEFAULT 1,
    description     TEXT,
    is_deleted      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS employees (
    employee_id INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_code    TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    department  TEXT NOT NULL,
    phone       TEXT,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- outside vendors who do jobs on our items (grinding, coating etc.)
CREATE TABLE IF NOT EXISTS vendors (
    vendor_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_code TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    phone       TEXT,
    address     TEXT,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- the jobs a vendor does and the price per item
CREATE TABLE IF NOT EXISTS vendor_works (
    work_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id INTEGER NOT NULL REFERENCES vendors(vendor_id) ON DELETE CASCADE,
    work_name TEXT NOT NULL,
    price     REAL NOT NULL DEFAULT 0 CHECK (price >= 0),
    UNIQUE (vendor_id, work_name)
);

-- items given to employees
-- ISSUE    = item given to an employee
-- TRANSFER = item moved from one employee to another (ref_tx_id = the old row)
-- RETURN   = item came back (ref_tx_id = the issue/transfer row)
-- "remaining" = how many of this row are still with the employee
CREATE TABLE IF NOT EXISTS transactions (
    tx_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    tx_type        TEXT NOT NULL CHECK (tx_type IN ('ISSUE', 'RETURN', 'TRANSFER')),
    employee_id    INTEGER NOT NULL REFERENCES employees(employee_id),
    product_id     INTEGER NOT NULL REFERENCES products(product_id),
    quantity       INTEGER NOT NULL CHECK (quantity > 0),
    stock_type     TEXT NOT NULL CHECK (stock_type IN ('new', 'used')),
    item_condition TEXT CHECK (item_condition IN ('good', 'damaged', 'consumed')),
    remaining      INTEGER NOT NULL DEFAULT 0 CHECK (remaining >= 0),
    ref_tx_id      INTEGER REFERENCES transactions(tx_id),
    notes          TEXT,
    done_by        INTEGER REFERENCES users(user_id),
    created_at     TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- items sent to vendors for a job
-- SEND     = item sent to a vendor
-- TRANSFER = item moved from one vendor to another
-- RECEIVE  = item came back from the vendor (amount_paid = money paid for the job)
CREATE TABLE IF NOT EXISTS vendor_transactions (
    vtx_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    tx_type         TEXT NOT NULL CHECK (tx_type IN ('SEND', 'RECEIVE', 'TRANSFER')),
    vendor_id       INTEGER NOT NULL REFERENCES vendors(vendor_id),
    product_id      INTEGER NOT NULL REFERENCES products(product_id),
    quantity        INTEGER NOT NULL CHECK (quantity > 0),
    stock_type      TEXT NOT NULL CHECK (stock_type IN ('new', 'used')),
    work_name       TEXT,
    work_price      REAL NOT NULL DEFAULT 0,
    expected_return TEXT,
    item_condition  TEXT CHECK (item_condition IN ('good', 'damaged', 'consumed')),
    amount_paid     REAL NOT NULL DEFAULT 0,
    remaining       INTEGER NOT NULL DEFAULT 0 CHECK (remaining >= 0),
    ref_vtx_id      INTEGER REFERENCES vendor_transactions(vtx_id),
    notes           TEXT,
    done_by         INTEGER REFERENCES users(user_id),
    created_at      TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- an employee asks for an item, a manager approves or declines it
CREATE TABLE IF NOT EXISTS product_requests (
    request_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id  INTEGER NOT NULL REFERENCES employees(employee_id),
    product_id   INTEGER NOT NULL REFERENCES products(product_id),
    quantity     INTEGER NOT NULL CHECK (quantity > 0),
    stock_type   TEXT NOT NULL DEFAULT 'new' CHECK (stock_type IN ('new', 'used')),
    status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
    note         TEXT,
    requested_by INTEGER REFERENCES users(user_id),
    decided_by   INTEGER REFERENCES users(user_id),
    decided_at   TEXT,
    issued_tx_id INTEGER REFERENCES transactions(tx_id),
    created_at   TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- broken / worn out items taken out of stock
CREATE TABLE IF NOT EXISTS scrap (
    scrap_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(product_id),
    stock_type TEXT NOT NULL CHECK (stock_type IN ('new', 'used')),
    quantity   INTEGER NOT NULL CHECK (quantity > 0),
    weight_kg  REAL,
    reason     TEXT,
    done_by    INTEGER REFERENCES users(user_id),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- every change in the stock of a product is written here
CREATE TABLE IF NOT EXISTS stock_history (
    history_id  INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL REFERENCES products(product_id),
    action      TEXT NOT NULL CHECK (action IN ('ADD', 'REMOVE', 'EDIT', 'ISSUE', 'RETURN', 'SEND', 'RECEIVE', 'SCRAP')),
    stock_type  TEXT,
    quantity    INTEGER NOT NULL DEFAULT 0,
    new_before  INTEGER NOT NULL,
    new_after   INTEGER NOT NULL,
    used_before INTEGER NOT NULL,
    used_after  INTEGER NOT NULL,
    notes       TEXT,
    done_by     INTEGER REFERENCES users(user_id),
    created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- indexes on the columns we search / join on a lot
CREATE INDEX IF NOT EXISTS idx_tx_employee ON transactions(employee_id);
CREATE INDEX IF NOT EXISTS idx_tx_product ON transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_vtx_vendor ON vendor_transactions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vtx_product ON vendor_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_history_product ON stock_history(product_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON product_requests(status);

-- view: full stock picture of every product
-- on_shelf     = new + used kept in the warehouse
-- with_employees / with_vendors = items that are out right now
CREATE VIEW IF NOT EXISTS product_stock AS
SELECT
    p.product_id,
    p.sku,
    p.name,
    p.category,
    p.make,
    p.material,
    p.price,
    p.new_stock,
    p.used_stock,
    p.new_stock + p.used_stock AS on_shelf,
    (SELECT COALESCE(SUM(t.remaining), 0) FROM transactions t
      WHERE t.product_id = p.product_id) AS with_employees,
    (SELECT COALESCE(SUM(v.remaining), 0) FROM vendor_transactions v
      WHERE v.product_id = p.product_id) AS with_vendors,
    p.low_stock_limit,
    p.is_returnable,
    p.description,
    p.is_deleted,
    p.created_at
FROM products p;
