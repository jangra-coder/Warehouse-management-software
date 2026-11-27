-- Warehouse Management Software
-- Database schema (MySQL)
-- The app runs this file on startup. "IF NOT EXISTS" means old tables and data are kept.

-- people who log in to the software
CREATE TABLE IF NOT EXISTS users (
    user_id       INT AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    full_name     VARCHAR(100) NOT NULL,
    role          VARCHAR(10) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- login sessions (token is saved in the browser)
CREATE TABLE IF NOT EXISTS sessions (
    token      VARCHAR(64) PRIMARY KEY,
    user_id    INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- items kept in the warehouse
-- stock is kept in two parts: new items and used items
CREATE TABLE IF NOT EXISTS products (
    product_id      INT AUTO_INCREMENT PRIMARY KEY,
    sku             VARCHAR(50) NOT NULL UNIQUE,
    name            VARCHAR(150) NOT NULL,
    category        VARCHAR(100) NOT NULL,
    make            VARCHAR(100),
    material        VARCHAR(100),
    price           DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
    new_stock       INT NOT NULL DEFAULT 0 CHECK (new_stock >= 0),
    used_stock      INT NOT NULL DEFAULT 0 CHECK (used_stock >= 0),
    low_stock_limit INT NOT NULL DEFAULT 5 CHECK (low_stock_limit >= 0),
    is_returnable   BOOLEAN NOT NULL DEFAULT TRUE,
    description     TEXT,
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_products_category (category)
);

CREATE TABLE IF NOT EXISTS employees (
    employee_id INT AUTO_INCREMENT PRIMARY KEY,
    emp_code    VARCHAR(20) NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    department  VARCHAR(100) NOT NULL,
    phone       VARCHAR(20),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- outside vendors who do jobs on our items (grinding, coating etc.)
CREATE TABLE IF NOT EXISTS vendors (
    vendor_id   INT AUTO_INCREMENT PRIMARY KEY,
    vendor_code VARCHAR(20) NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    phone       VARCHAR(20),
    address     VARCHAR(255),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- the jobs a vendor does and the price per item
CREATE TABLE IF NOT EXISTS vendor_works (
    work_id   INT AUTO_INCREMENT PRIMARY KEY,
    vendor_id INT NOT NULL,
    work_name VARCHAR(100) NOT NULL,
    price     DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
    UNIQUE (vendor_id, work_name),
    FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id) ON DELETE CASCADE
);

-- items given to employees
-- ISSUE    = item given to an employee
-- TRANSFER = item moved from one employee to another (ref_tx_id = the old row)
-- RETURN   = item came back (ref_tx_id = the issue/transfer row)
-- "remaining" = how many of this row are still with the employee
CREATE TABLE IF NOT EXISTS transactions (
    tx_id          INT AUTO_INCREMENT PRIMARY KEY,
    tx_type        VARCHAR(10) NOT NULL CHECK (tx_type IN ('ISSUE', 'RETURN', 'TRANSFER')),
    employee_id    INT NOT NULL,
    product_id     INT NOT NULL,
    quantity       INT NOT NULL CHECK (quantity > 0),
    stock_type     VARCHAR(4) NOT NULL CHECK (stock_type IN ('new', 'used')),
    item_condition VARCHAR(10) CHECK (item_condition IN ('good', 'damaged', 'consumed')),
    remaining      INT NOT NULL DEFAULT 0 CHECK (remaining >= 0),
    ref_tx_id      INT,
    notes          VARCHAR(255),
    done_by        INT,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    FOREIGN KEY (ref_tx_id) REFERENCES transactions(tx_id),
    FOREIGN KEY (done_by) REFERENCES users(user_id)
);

-- items sent to vendors for a job
-- SEND     = item sent to a vendor
-- TRANSFER = item moved from one vendor to another
-- RECEIVE  = item came back from the vendor (amount_paid = money paid for the job)
CREATE TABLE IF NOT EXISTS vendor_transactions (
    vtx_id          INT AUTO_INCREMENT PRIMARY KEY,
    tx_type         VARCHAR(10) NOT NULL CHECK (tx_type IN ('SEND', 'RECEIVE', 'TRANSFER')),
    vendor_id       INT NOT NULL,
    product_id      INT NOT NULL,
    quantity        INT NOT NULL CHECK (quantity > 0),
    stock_type      VARCHAR(4) NOT NULL CHECK (stock_type IN ('new', 'used')),
    work_name       VARCHAR(100),
    work_price      DECIMAL(10, 2) NOT NULL DEFAULT 0,
    expected_return DATE,
    item_condition  VARCHAR(10) CHECK (item_condition IN ('good', 'damaged', 'consumed')),
    amount_paid     DECIMAL(10, 2) NOT NULL DEFAULT 0,
    remaining       INT NOT NULL DEFAULT 0 CHECK (remaining >= 0),
    ref_vtx_id      INT,
    notes           VARCHAR(255),
    done_by         INT,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    FOREIGN KEY (ref_vtx_id) REFERENCES vendor_transactions(vtx_id),
    FOREIGN KEY (done_by) REFERENCES users(user_id)
);

-- an employee asks for an item, a manager approves or declines it
CREATE TABLE IF NOT EXISTS product_requests (
    request_id   INT AUTO_INCREMENT PRIMARY KEY,
    employee_id  INT NOT NULL,
    product_id   INT NOT NULL,
    quantity     INT NOT NULL CHECK (quantity > 0),
    stock_type   VARCHAR(4) NOT NULL DEFAULT 'new' CHECK (stock_type IN ('new', 'used')),
    status       VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
    note         VARCHAR(255),
    requested_by INT,
    decided_by   INT,
    decided_at   DATETIME,
    issued_tx_id INT,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_requests_status (status),
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    FOREIGN KEY (requested_by) REFERENCES users(user_id),
    FOREIGN KEY (decided_by) REFERENCES users(user_id),
    FOREIGN KEY (issued_tx_id) REFERENCES transactions(tx_id)
);

-- broken / worn out items taken out of stock
CREATE TABLE IF NOT EXISTS scrap (
    scrap_id   INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    stock_type VARCHAR(4) NOT NULL CHECK (stock_type IN ('new', 'used')),
    quantity   INT NOT NULL CHECK (quantity > 0),
    weight_kg  DECIMAL(8, 2),
    reason     VARCHAR(255),
    done_by    INT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    FOREIGN KEY (done_by) REFERENCES users(user_id)
);

-- every change in the stock of a product is written here
CREATE TABLE IF NOT EXISTS stock_history (
    history_id  INT AUTO_INCREMENT PRIMARY KEY,
    product_id  INT NOT NULL,
    action      VARCHAR(10) NOT NULL CHECK (action IN ('ADD', 'REMOVE', 'EDIT', 'ISSUE', 'RETURN', 'SEND', 'RECEIVE', 'SCRAP')),
    stock_type  VARCHAR(4),
    quantity    INT NOT NULL DEFAULT 0,
    new_before  INT NOT NULL,
    new_after   INT NOT NULL,
    used_before INT NOT NULL,
    used_after  INT NOT NULL,
    notes       VARCHAR(255),
    done_by     INT,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    FOREIGN KEY (done_by) REFERENCES users(user_id)
);

-- view: full stock picture of every product
-- on_shelf     = new + used kept in the warehouse
-- with_employees / with_vendors = items that are out right now
CREATE OR REPLACE VIEW product_stock AS
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
