# HostelFlow: DBMS Project Report
**Smart Hostel Time & Crowd Management System**  
**Course:** Database Management Systems — II Year B.Tech Project  
**Author:** Shouryaveer Bishnoi (Roll No: 2025BTECH111, Section B)  
**Institution:** JK Lakshmipat University (Academic Year 2026–27)

---

## 1. Executive Summary

Hostel life revolves around a small set of daily activities—eating at the mess and managing laundry cycles. In traditional hostel administration, these activities suffer from unpredictable queues and complete lack of visibility. Students cannot forecast queue length, service speed is detached from menu preparations, and laundry bags disappear until collection without status transparency.

**HostelFlow** is a database-driven system designed under core Relational Database Management System (RDBMS) principles. Following the design philosophy **"Capture once, derive the rest"**, HostelFlow uses a single automated QR scan at the mess entrance and queue snapshots at laundry drop-off to drive all operational metrics and crowd forecasts using **plain SQL aggregation** over stored history—with zero machine learning or complex hardware dependencies.

---

## 2. Relational Model & Schema Specification

The relational model consists of 7 normalized relations enforcing referential integrity, domain constraints, and check constraints.

### 2.1 Table Definitions & Integrity Constraints

#### 1. `HOSTEL`
- `hostel_id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `hostel_name`: TEXT NOT NULL UNIQUE (e.g., 'Block A', 'Block B', 'Block C')
- `block_code`: TEXT

#### 2. `STUDENT`
- `student_id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `roll_no`: TEXT NOT NULL UNIQUE (e.g., '2025BTECH111')
- `name`: TEXT NOT NULL
- `hostel_id`: INTEGER NOT NULL REFERENCES `HOSTEL(hostel_id)` ON DELETE RESTRICT
- `room_no`: TEXT NOT NULL
- `phone`: TEXT NOT NULL
- `notification_laundry`: INTEGER DEFAULT 1

#### 3. `MEAL_TYPE`
- `meal_id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `meal_name`: TEXT NOT NULL UNIQUE ('Breakfast', 'Lunch', 'High Tea', 'Dinner')
- `standard_start_time`: TEXT NOT NULL ('08:00', '11:30', '17:00', '20:00')
- `standard_end_time`: TEXT NOT NULL ('09:00', '14:00', '18:00', '22:00')
- `avg_eating_time_minutes`: INTEGER NOT NULL (15 or 20)
- `buffer_time_minutes`: INTEGER DEFAULT 5
- `time_display`: TEXT NOT NULL (e.g., '8–9 AM')

#### 4. `MESS_MENU`
- `menu_id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `meal_id`: INTEGER NOT NULL REFERENCES `MEAL_TYPE(meal_id)` ON DELETE CASCADE
- `day_of_week`: TEXT NOT NULL CHECK(`day_of_week` IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'))
- `dish_name`: TEXT NOT NULL
- `expected_prep_time_minutes`: INTEGER NOT NULL CHECK(`expected_prep_time_minutes` >= 0)
- `serving_note`: TEXT
- **Constraint:** `UNIQUE (meal_id, day_of_week)` &mdash; Enforces exactly one dish per day per meal window.

#### 5. `MESS_VISIT`
- `visit_id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `student_id`: INTEGER NOT NULL REFERENCES `STUDENT(student_id)` ON DELETE CASCADE
- `meal_id`: INTEGER NOT NULL REFERENCES `MEAL_TYPE(meal_id)` ON DELETE RESTRICT
- `visit_date`: DATE NOT NULL
- `mess_entry_time`: TIME NOT NULL (HH:MM:SS)
- `mess_exit_time`: TIME NOT NULL (HH:MM:SS) &mdash; Computed expected exit stored at scan time
- `entry_timestamp`: DATETIME NOT NULL
- `expected_exit_timestamp`: DATETIME NOT NULL

#### 6. `LAUNDRY_BAG`
- `bag_number`: TEXT PRIMARY KEY (e.g., 'B-214')
- `student_id`: INTEGER NOT NULL UNIQUE REFERENCES `STUDENT(student_id)` ON DELETE CASCADE
- **Constraint:** `UNIQUE(student_id)` enforces a strict **1:1 permanent bag assignment**.

#### 7. `LAUNDRY_REQUEST`
- `request_id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `bag_number`: TEXT NOT NULL REFERENCES `LAUNDRY_BAG(bag_number)` ON DELETE CASCADE
- `submitted_datetime`: DATETIME NOT NULL
- `bags_ahead_at_submission`: INTEGER NOT NULL DEFAULT 0 &mdash; Queue snapshot at insertion
- `expected_return_datetime`: DATETIME NOT NULL
- `actual_received_datetime`: DATETIME
- `status`: TEXT NOT NULL CHECK(`status` IN ('SUBMITTED', 'WASHING', 'READY', 'RECEIVED')) DEFAULT 'SUBMITTED'

---

## 3. Database Normalization Analysis

A critical requirement of this DBMS project is proving that the relational schema is free from insertion, deletion, and update anomalies.

### 3.1 First Normal Form (1NF)
- **Criterion:** All attribute domains are atomic (indivisible values); there are no repeating groups or arrays stored in any column.
- **Proof:** In `MESS_MENU`, each row stores exactly one dish for one `(meal_id, day_of_week)`. In `LAUNDRY_REQUEST`, multi-valued statuses are not stored in a single field; each submission is an individual tuple.

### 3.2 Second Normal Form (2NF)
- **Criterion:** The schema is in 1NF, and every non-prime attribute is fully functionally dependent on the primary key (no partial functional dependencies on composite keys).
- **Proof:**
  - `HOSTEL`, `STUDENT`, `MEAL_TYPE`, `MESS_MENU`, `MESS_VISIT`, and `LAUNDRY_REQUEST` all employ single-attribute surrogate keys (`hostel_id`, `student_id`, `meal_id`, `menu_id`, `visit_id`, `request_id`).
  - `LAUNDRY_BAG` has single-attribute primary key `bag_number`.
  - Since no relation uses a composite primary key, partial functional dependencies are mathematically impossible. Hence, the schema is strictly in 2NF.

### 3.3 Third Normal Form (3NF)
- **Criterion:** The schema is in 2NF, and no non-prime attribute is transitively dependent on any candidate key (no $X \rightarrow Y \rightarrow Z$ where $Y$ is non-prime).
- **Proof:**
  - In `STUDENT`, attributes `room_no` and `phone` depend directly on `student_id`. Hostel details are referenced through foreign key `hostel_id` rather than storing `hostel_name` transitively.
  - In `MESS_VISIT`, dish details and meal opening windows are NOT stored; they are referenced through foreign keys `student_id` and `meal_id`, eliminating transitive anomalies.
  - Hence, the schema satisfies 3NF.

### 3.4 Boyce-Codd Normal Form (BCNF)
- **Criterion:** For every functional dependency $X \rightarrow Y$, $X$ must be a superkey.
- **Proof:** In all relations, every determinant is either a primary key or a unique candidate key (`roll_no` in `STUDENT`, `bag_number` and `student_id` in `LAUNDRY_BAG`, `(meal_id, day_of_week)` in `MESS_MENU`). Therefore, all relations satisfy BCNF.

---

## 4. Business Logic & Derived Calculations

### 4.1 Automatic Meal Detection & Expected Exit Time (Synopsis 4.1, 4.3)
When a student scans the QR code at timestamp $T_{\text{scan}}$:
1. The active meal window $M$ is auto-detected from `MEAL_TYPE`:
   - If $T_{\text{scan}} \in [M.\text{start}, M.\text{end}]$, the visit starts at $T_{\text{scan}}$.
   - If $T_{\text{scan}} \in [M.\text{start} - 15\text{ min}, M.\text{start}]$, the visit is an **early arrival**, and $T_{\text{start}} = M.\text{start}$.
   - If outside serving windows, scan is rejected with the next meal opening time.
2. The day's dish prep time $P_{\text{prep}}$ is retrieved via a JOIN with `MESS_MENU`.
3. Eating time $E_{\text{eating}}$ and fixed buffer $B = 5\text{ min}$ are retrieved from `MEAL_TYPE`.
4. The expected exit time is stored immediately:
   $$T_{\text{expected\_exit}} = T_{\text{start}} + P_{\text{prep}} + E_{\text{eating}} + 5\text{ minutes}$$

### 4.2 Laundry Queue Snapshot & ETA Estimation (Synopsis 4.4)
At submission time $T_{\text{sub}}$:
1. The system executes a snapshot count of all active bags in the laundry room:
   $$N_{\text{ahead}} = \text{COUNT}(\text{bags in 'SUBMITTED' or 'WASHING'})$$
2. Historical average turnaround $T_{\text{hist}}$ is queried dynamically from past completed cycles:
   $$T_{\text{hist}} = \text{AVG}(T_{\text{actual\_received}} - T_{\text{sub}})$$
3. The expected return timestamp is stored:
   $$T_{\text{expected\_return}} = T_{\text{sub}} + T_{\text{hist}} + (N_{\text{ahead}} \times 20\text{ minutes})$$
   Because $N_{\text{ahead}}$ is persisted, the estimate remains traceable and auditable.

### 4.3 Crowd Recommendation Engine (Synopsis 4.5)
Visits over the past 30 days are grouped into 15-minute intervals. The slot with minimum historical traffic is designated as **"Recommended"**, and potential minutes saved compared to rush hour is computed:
$$\text{Time Saved} = \text{Queue Delay}_{\text{peak}} - \text{Queue Delay}_{\text{quiet}}$$

---

## 5. SQL Implementation Demonstration

The following core SQL queries from `backend/db/queries.sql` demonstrate the analytical power of the system:

### Query 1: 15-Minute Slot 30-Day Aggregation
```sql
SELECT 
    mt.meal_name,
    strftime('%H:%M', v.entry_timestamp) AS slot_start,
    COUNT(v.visit_id) AS total_visits_30d,
    ROUND(COUNT(v.visit_id) * 1.0 / 30, 1) AS avg_daily_occupancy,
    CASE 
        WHEN COUNT(v.visit_id) >= 60 THEN 'Busy'
        WHEN COUNT(v.visit_id) >= 35 THEN 'Moderate'
        ELSE 'Quiet'
    END AS crowd_category
FROM MESS_VISIT v
JOIN MEAL_TYPE mt ON v.meal_id = mt.meal_id
WHERE v.visit_date >= date('now', '-30 days')
GROUP BY mt.meal_name, (strftime('%M', v.entry_timestamp) / 15)
ORDER BY mt.meal_id, slot_start ASC;
```

### Query 2: Dish Preparation Impact on Service Duration
```sql
SELECT 
    mm.dish_name,
    mm.expected_prep_time_minutes,
    COUNT(v.visit_id) AS recorded_visits,
    ROUND(AVG((julianday(v.expected_exit_timestamp) - julianday(v.entry_timestamp)) * 24 * 60), 1) AS avg_duration_minutes,
    CASE 
        WHEN mm.expected_prep_time_minutes >= 5 THEN 'High queue impact (Made-to-order)'
        WHEN mm.expected_prep_time_minutes >= 3 THEN 'Moderate queue impact'
        ELSE 'Fast counter turnover'
    END AS counter_impact
FROM MESS_MENU mm
JOIN MESS_VISIT v ON v.meal_id = mm.meal_id
GROUP BY mm.dish_name, mm.expected_prep_time_minutes
ORDER BY mm.expected_prep_time_minutes DESC;
```

---

## 6. Verification & Automated Testing

The backend includes an automated test harness (`backend/test-backend.js`) containing 20 tests that verify:
1. Health check & database connection
2. OTP issuance and verification for roll number `2025BTECH111`
3. Student first-time onboarding and 1:1 permanent bag auto-provisioning
4. Weekly menu lookup matching code specifications
5. Meal classification for Dinner (8:00–10:00 PM)
6. Expected exit formula: $\text{entry} + \text{prep} + \text{eating} + 5\text{ min buffer}$
7. Duplicate scan prevention within the same meal window
8. Early arrival scan within 15 minutes of opening
9. Closed state notification with next opening window
10. 30-day slot grouping and quietest window recommendation
11. Live queue breakdown (waiting line vs. eating occupants)
12. Laundry active status and live bags-ahead progression
13. Staff console queue retrieval
14. Staff status progression (SUBMITTED &rarr; WASHING &rarr; READY &rarr; RECEIVED)
15. Actual received timestamp persistence upon collection
16. Formula verification for laundry ETA estimation
17. Admin dashboard KPI aggregations and facility alerts
18. 7-day $\times$ 4-meal crowd heatmap matrix generation

All 20 tests pass with 0 failures on repeated executions.

