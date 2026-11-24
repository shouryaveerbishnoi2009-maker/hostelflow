# 🏠 HostelFlow — Smart Hostel Time & Crowd Management System

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0.3-black.svg)](https://flask.palletsprojects.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-336791.svg)](https://supabase.com/)
[![Render](https://img.shields.io/badge/Deploy-Render-46E3B7.svg)](https://render.com/)
[![Architecture](https://img.shields.io/badge/Philosophy-Database--First-indigo.svg)](#core-architectural--dbms-philosophy)

> **Zero Queues. Zero Guesswork. Smart Hostel Living.**
> A production-ready, commercial-grade web application engineered to predict mess crowds, calculate dish-aware dining exit times, track laundry queues in real-time, and provide multi-college SaaS administration.

---

## 📑 Table of Contents
1. [Core Architectural & DBMS Philosophy](#core-architectural--dbms-philosophy)
2. [Key Capabilities & Feature Set](#key-capabilities--feature-set)
3. [Pre-configured Demo Accounts](#pre-configured-demo-accounts)
4. [Database Architecture & Schema](#database-architecture--schema)
5. [Local Development Setup](#local-development-setup)
6. [Production Deployment to Render + Supabase](#production-deployment-to-render--supabase)
7. [SQL Inspector ("Viva Mode")](#sql-inspector-viva-mode)
8. [Project Directory Layout](#project-directory-layout)

---

## 🏛️ Core Architectural & DBMS Philosophy

HostelFlow is built on the **Database-First** principle:
> *"Capture Once, Compute the Rest in SQL."*

- **Zero Black-Box ORMs:** All queries use pure, inspectable parameterized SQL via `psycopg2`. No hidden queries, no n+1 latency traps.
- **SQL Triggers Drive Business Intelligence:**
  - When a student checks into the mess (`MESS_VISIT`), PostgreSQL automatically detects the meal window, joins today's dish preparation time, adds standard eating and buffer times, and commits `mess_exit_time`.
  - When a laundry bag is dropped off (`LAUNDRY_REQUEST`), PostgreSQL takes a point-in-time snapshot of bags ahead (`bags_ahead_at_submission`) and computes `expected_return_datetime` using historical turnaround averages.
- **Real-Time SQL Views:** Analytical dashboards are computed directly on the database engine using `v_live_mess_crowd`, `v_mess_slot_analytics`, `v_laundry_queue_summary`, and `v_dish_impact`.
- **Multi-College (SaaS) Isolated Tenancy:** Every core entity links to `COLLEGE(college_id)`, allowing hundreds of universities to operate on a shared cluster with absolute operational isolation.

---

## 🚀 Key Capabilities & Feature Set

### A. Student Portal (`/student/...`)
- **QR Code Mess Check-In (`/student/mess/scan`):**
  - Scans printed mess entrance QR codes (or opens scan interface directly).
  - Detects active meal (Breakfast / Lunch / Dinner), dish being served, dish prep speed, and predicts student's exit time.
  - Built-in duplicate scan cooldown protection for the same meal window.
  - Live Crowd Meter (Low / Moderate / Peak).
- **Smart Crowd Predictor (`/student/crowd`):**
  - Plain-language SQL recommendation (e.g. *"Peak crowd at 08:22 PM (38 visits). Visit at 09:15 PM for a 4-minute wait"*).
  - Interactive 15-minute time-slot bar chart powered by Chart.js.
  - 7-Day Weekly Mess Menu with speed indicators (*Fast Serving*, *Moderate*, *Made-to-Order*).
- **Laundry Queue Tracker (`/student/laundry`):**
  - Strict 1:1 permanent bag assignment (`bag_number`).
  - Real-time progression stepper: `SUBMITTED` ➔ `WASHING` ➔ `READY` ➔ `COLLECTED`.
  - Dynamic queue position counter showing exact bags remaining ahead.
  - Historical turnaround log with predicted vs. actual delivery timestamps.

### B. Staff Operations Console (`/staff/...`)
- **Laundry Desk Console (`/staff/laundry`):**
  - Fast drop-off scanner by `bag_number` or student `roll_no`.
  - Single-click status progression recording `actual_received_datetime` upon student collection.
- **Mess QR Display Generator (`/staff/mess/qr`):**
  - Full-screen / printable QR code generator for each hostel mess entrance.

### C. Admin & Super Admin Deck (`/admin/...` & `/superadmin/...`)
- **Executive KPI Cards:** Live diners right now, today's total mess footfall, average wait duration, active laundry bags in wash, and average laundry turnaround hours.
- **Dish Bottleneck Analytics:** Table comparing high-prep dishes (e.g., Aloo Paratha, Dum Biryani) vs quick staples.
- **Weekly Menu CRUD:** Modify dishes, days, and expected preparation minutes.
- **Student Management:** Single student onboarding with permanent bag allocation + Bulk CSV upload.
- **Multi-College SaaS Desk:** Super Admin can onboard new universities, toggle active subscriptions, and switch operational contexts.
- **SQL Inspector / "Viva Mode":** Toggleable administrative view showing raw SQL definitions and live query outputs.

---

## 👥 Pre-configured Demo Accounts

All demo accounts come pre-seeded with realistic data across 2 colleges (**JK Lakshmipath University** & **Manipal Institute of Technology**).

> 💡 **Tip:** After initial database seeding, visit `/admin/init-demo` to ensure all passwords are synchronized with PBKDF2-SHA256 hashes.

| Role | Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@hostelflow.com` | `Admin@123` | Multi-College Management & Platform Overviews |
| **Hostel Admin (JLU)** | `admin@jlu.edu` | `Admin@123` | JLU Executive KPIs, Menu CRUD, Student Upload |
| **Mess Staff** | `mess@jlu.edu` | `Staff@123` | Mess QR Generator & Entrance Console |
| **Laundry Staff** | `laundry@jlu.edu` | `Staff@123` | Laundry Bag Intake & Queue Status Advancer |
| **Student (Demo)** | `student@jlu.edu` | `Student@123` | QR Check-In, Crowd Predictor, Laundry Tracker |

*Students `priya.singh@jlu.edu`, `rohit.verma@jlu.edu`, etc. also use `Student@123`.*

---

## 🗄️ Database Architecture & Schema

### Entity-Relationship Diagram

```
+--------------------+       +--------------------+
|      COLLEGE       |1     *|       HOSTEL       |
|--------------------|<------|--------------------|
| college_id (PK)    |       | hostel_id (PK)     |
| college_name       |       | college_id (FK)    |
| college_code (UQ)  |       | hostel_name        |
| subscription_plan  |       | capacity           |
+--------------------+       +--------------------+
          |1                           |1
          |                            |
          |*                           |*
+--------------------+       +--------------------+
|    STAFF_ADMIN     |       |      STUDENT       |
|--------------------|       |--------------------|
| staff_id (PK)      |       | student_id (PK)    |
| college_id (FK)    |       | college_id (FK)    |
| name, email, role  |       | hostel_id (FK)     |
+--------------------+       | roll_no, name      |
          |1                 +--------------------+
          |                            |1
          |*                           |1
+--------------------+       +--------------------+
|     MEAL_TYPE      |       |    LAUNDRY_BAG     |
|--------------------|       |--------------------|
| meal_id (PK)       |       | bag_number (PK)    |
| college_id (FK)    |       | student_id (FK,UQ) |
| meal_name          |       +--------------------+
| standard_start_time|                 |1
| standard_end_time  |                 |*
+--------------------+       +--------------------+
   |1            |1          |  LAUNDRY_REQUEST   |
   |*            |*          |--------------------|
+-----------+ +-----------+  | request_id (PK)    |
| MESS_MENU | |MESS_VISIT |  | bag_number (FK)    |
+-----------+ +-----------+  | bags_ahead (snap)  |
                             | expected_return    |
                             | status             |
                             +--------------------+
```

### Core SQL Objects
- `trg_fn_calculate_mess_exit()`: Runs `BEFORE INSERT ON MESS_VISIT`. Computes exit time: `entry + (prep + eating + buffer) * INTERVAL '1 minute'`.
- `trg_fn_calculate_laundry_eta()`: Runs `BEFORE INSERT ON LAUNDRY_REQUEST`. Counts active bags ahead and computes turnaround ETA.
- `v_live_mess_crowd`: Real-time diners active right now.
- `v_mess_slot_analytics`: 15-minute slot aggregations for crowd curves.
- `v_laundry_queue_summary`: Status counts and turnaround metrics.
- `v_dish_impact`: Dish vs average stay duration analytics.

---

## 💻 Local Development Setup

### 1. Prerequisites
- Python 3.11+
- PostgreSQL 14+ (or a Supabase project)

### 2. Clone & Virtual Environment
```bash
git clone https://github.com/your-username/hostelflow.git
cd hostelflow

python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Configure `.env`
```bash
cp .env.example .env
# Open .env and set your DATABASE_URL and SECRET_KEY
```

### 4. Initialize Database
In your local PostgreSQL or Supabase SQL Editor:
```bash
# In psql:
\i sql/schema.sql
\i sql/seed.sql
```

### 5. Run Web Server
```bash
python app.py
```
Open **`http://localhost:5001`** in your browser.

---

## ☁️ Production Deployment to Render + Supabase

HostelFlow is 100% cloud-ready for **Render** (Application) and **Supabase** (Database).

### Step 1: Set Up Supabase Database
1. Create a free project at [supabase.com](https://supabase.com).
2. Go to the **SQL Editor** on the left menu.
3. Open `sql/schema.sql`, paste the full SQL, and click **Run**.
4. Open `sql/seed.sql`, paste the full SQL, and click **Run**.
5. Go to **Project Settings** ➔ **Database** ➔ scroll to **Connection parameters**.

> ⚠️ **CRITICAL: Render Free Tier IPv4 Compatibility**
> - Render's free tier uses **IPv4 outbound networking**.
> - Supabase's direct connection (`db.[project].supabase.co:5432`) resolves to **IPv6 only**.
> - **YOU MUST USE SUPABASE'S CONNECTION POOLER URI (Port 6543):**
>   Select the **"Session"** or **"Transaction"** pooler tab and copy the connection string:
>   `postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require`

### Step 2: Push to GitHub
```bash
git init
git add .
git commit -m "HostelFlow production release"
git branch -M main
git remote add origin https://github.com/[your-username]/hostelflow.git
git push -u origin main
```

### Step 3: Deploy on Render
1. Sign in to [render.com](https://render.com).
2. Click **New +** ➔ **Web Service** ➔ connect your GitHub repository.
3. Configure settings:
   - **Name:** `hostelflow`
   - **Environment:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app --workers 2 --bind 0.0.0.0:$PORT --timeout 120`
4. Add **Environment Variables**:
   - `DATABASE_URL`: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require`
   - `SECRET_KEY`: *(Click "Generate" or provide a random 32+ character string)*
   - `APP_TIMEZONE`: `Asia/Kolkata`
   - `FLASK_ENV`: `production`
   - `FLASK_DEBUG`: `0`
5. Click **Deploy Web Service**.

### Step 4: Verify Deployment
1. Visit `https://your-service.onrender.com/admin/init-demo` to ensure demo password hashes are synchronized.
2. Sign in as Student (`student@jlu.edu` / `Student@123`) and verify `/student/mess/scan`.
3. Sign in as Admin (`admin@jlu.edu` / `Admin@123`) and verify `/admin/sql-inspector`.

---

## 🔍 SQL Inspector ("Viva Mode")

To provide 100% academic transparency and inspectability, HostelFlow includes a dedicated **SQL Inspector ("Viva Mode")** located at `/admin/sql-inspector`.

This view displays:
1. The exact, raw PostgreSQL queries and View definitions executing in real time.
2. Live execution output formatted cleanly in tables.
3. Proof that business logic (exit time predictions, queue estimates, bottlenecks) is handled directly by PostgreSQL triggers and views rather than hidden inside ORM layers.

---

## 📂 Project Directory Layout

```
hostelflow/
├── app.py                     # Flask application routes, RBAC & business logic
├── db.py                      # psycopg2 Threaded Connection Pool & query runners
├── requirements.txt           # Production Python dependencies
├── Procfile                   # Gunicorn process definition for Render
├── render.yaml                # Render Infrastructure-as-Code blueprint
├── .env.example               # Environment variables template
├── .gitignore                 # Git ignore rules
├── README.md                  # Comprehensive documentation
├── sql/
│   ├── schema.sql             # Normalized DDL, Constraints, Triggers, Views
│   └── seed.sql               # Realistic multi-college seed data (200+ visits)
├── static/
│   ├── css/
│   │   └── main.css           # Mobile-first SaaS stylesheet (500+ lines)
│   └── js/
│       └── main.js            # Chart.js integration, check-in flow & dynamic UI
└── templates/
    ├── base.html              # Layout shell with navbar, flash messages, footer
    ├── landing.html           # Public commercial SaaS product landing page
    ├── auth/
    │   └── login.html         # Unified multi-role authentication page
    ├── student/
    │   ├── dashboard.html     # Student home: active meal, visits, queue pill
    │   ├── mess_scan.html     # QR check-in confirmation & dish cards
    │   ├── crowd.html         # 15-min slot analytics chart & weekly menu
    │   └── laundry.html       # Laundry status stepper & history table
    ├── staff/
    │   ├── dashboard.html     # Operations hub for mess and laundry staff
    │   ├── laundry_desk.html  # Bag intake form & live queue status advancer
    │   └── mess_qr.html       # Printable / full-screen mess entrance QR code
    ├── admin/
    │   ├── dashboard.html     # Executive KPI cards & dish bottleneck table
    │   ├── menu.html          # 7-day mess menu CRUD & prep time editor
    │   ├── students.html      # Student directory & bulk CSV onboarding
    │   └── sql_inspector.html # Viva Mode: live SQL definitions & view runner
    ├── superadmin/
    │   ├── dashboard.html     # Multi-University SaaS overview deck
    │   └── colleges.html      # College onboarding & status toggle
    └── errors/
        ├── 403.html           # Forbidden access error page
        ├── 404.html           # Not found error page
        └── 500.html           # Internal server error page
```

---

## 📄 License
HostelFlow is released under the MIT License. Developed for smart campus administration.
