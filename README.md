# Warehouse Management Software

DBMS Capstone Project - 3rd Semester

A web based software to manage the items of a warehouse / tool store. It keeps the stock of every
product, which items are given to employees, which items are sent to outside vendors for a job
(grinding, coating etc.), requests from employees, scrap, and reports.

**Live demo:** https://warehouse-management-software-ztg4.onrender.com (free hosting, the first load can take about a minute)

Demo login: `admin` / `admin123`

## Features

- Login with roles
  - **admin** - can do everything and add users
  - **manager** - can do everything except managing users
  - **user** - can only view and make requests
- Products: add, edit, delete, add / remove stock, stock history of every product
- Stock is kept in two parts: **new** and **used**
- Issue items to employees (many items at once), return them (good / damaged / consumed) and transfer between employees
- Send items to vendors for a job, receive them back with the amount paid, move them to another vendor
- Employee requests which a manager approves (item is issued) or declines
- Scrap entry for broken items
- Dashboard with totals, low stock list and a chart
- Reports with filters, group by and CSV download

## Tech used

| Part | Tech |
|------|------|
| Database | MySQL (hosted on TiDB Cloud, MySQL compatible) |
| Backend | Python, FastAPI |
| Frontend | React (Vite), Chart.js |

## Database design

Tables (see `backend/schema.sql`):

| Table | What it stores |
|-------|----------------|
| users | login accounts with role |
| sessions | login tokens |
| products | items with new and used stock |
| employees | employees of the company |
| vendors | outside vendors |
| vendor_works | jobs a vendor does and the price |
| transactions | issue / return / transfer of items with employees |
| vendor_transactions | send / receive / transfer of items with vendors |
| product_requests | item requests from employees |
| scrap | scrapped items |
| stock_history | every change in the stock of a product |

Relations:

- employees 1 - N transactions, products 1 - N transactions
- vendors 1 - N vendor_works, vendors 1 - N vendor_transactions
- a RETURN or TRANSFER row points to the row it came from (`ref_tx_id`, self reference)
- product_requests links employee, product, the user who asked and the user who decided

Other DBMS concepts used:

- PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK and DEFAULT constraints
- `ON DELETE CASCADE` (deleting a vendor deletes its works)
- a **view** `product_stock` that calculates items on shelf, with employees and with vendors
- indexes on the columns used in joins
- **transactions** (commit / rollback): when many items are issued together, if one fails none is saved
- joins, sub queries, `UNION ALL`, `GROUP BY` and a `WITH` (CTE) query in reports

## Project structure

```
backend/
  main.py            FastAPI app, creates the tables on first run
  database.py        MySQL connection (details come from .env)
  auth.py            password hashing, login check, roles
  stock.py           add / remove stock + stock history
  schema.sql         all tables, view and indexes
  sample_data.sql    sample products, employees, vendors
  routes/            API for every page
frontend/
  src/pages/         one file for every page
  src/components/    sidebar layout and popup
  src/api.js         calls to the backend
```

## How to run

You need a MySQL database. It can be MySQL on your own laptop or a free cloud database
like TiDB Cloud.

Backend (Python 3.10 or newer):

```
cd backend
pip install -r requirements.txt
cp .env.example .env      (then put your MySQL details in .env)
uvicorn main:app --reload
```

The first run creates the `warehouse` database, all the tables, the admin login and the sample data.
After that the data stays in MySQL.

Frontend (Node 18 or newer), in another terminal:

```
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

To run everything from one server, build the frontend (`npm run build`) and open
http://localhost:8000 - FastAPI serves the built files from `frontend/dist`.

## Deploying on Render

Web Service settings:

- Runtime: Python
- Build command: `pip install -r backend/requirements.txt && cd frontend && npm install --include=dev && npm run build`
- Start command: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
- Environment variables: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL=true`
  (from the TiDB Cloud "Connect" page)
