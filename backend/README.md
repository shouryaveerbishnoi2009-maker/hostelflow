# HostelFlow Backend Documentation

**Smart Hostel Time & Crowd Management System**  
**Course:** Database Management Systems — II Year Project  
**Author:** Shouryaveer Bishnoi (Roll No: 2025BTECH111)  
**Institution:** JK Lakshmipat University (Academic Year 2026–27)

---

## 1. Quick Start

The backend is built with zero external npm dependencies, running natively on modern Node.js using the built-in `node:sqlite` engine.

### Run Database Seeder
Seeds 30 days of realistic historical visits, the complete weekly menu, 15 students, and laundry queues:
```bash
node backend/db/seed.js
```

### Start the REST API Server
Starts the REST server on `http://localhost:3001`:
```bash
node backend/server.js
```

### Run Automated Backend Test Suite
Executes the comprehensive 20-test automated verification suite:
```bash
node backend/test-backend.js
```

---

## 2. System Architecture

```
backend/
├── data/
│   └── hostelflow.db          # Persistent SQLite database (WAL mode enabled)
├── db/
│   ├── schema.sql             # Standard SQL DDL (Tables, Primary/Foreign Keys, Constraints)
│   ├── seed.js                # University seed generator with 30-day historical visits
│   ├── connection.js          # Synchronous database connection using node:sqlite
│   └── queries.sql            # Key analytical and operational SQL queries for viva/presentation
├── services/
│   ├── messService.js         # QR auto meal detection, exit calculation, live queue breakdown, 30-day forecast
│   ├── laundryService.js      # 1:1 permanent bag, queue snapshot, dynamic turnaround estimation
│   ├── analyticsService.js    # Admin dashboard aggregations, crowd heatmap, dish impact analysis
│   └── authService.js         # Student OTP issuance/verification & permanent bag provisioning
├── routes/
│   ├── messRoutes.js          # /api/mess/*
│   ├── laundryRoutes.js       # /api/laundry/*
│   ├── authRoutes.js          # /api/auth/*, /api/students/*
│   └── adminRoutes.js         # /api/admin/*
├── server.js                  # High-performance HTTP server with CORS and JSON routing
└── test-backend.js            # Automated test suite (20 tests verifying all formulas)
```

---

## 3. Relational Database Schema

### 3.1 Entities & Keys

| Entity | Primary Key | Foreign Key(s) | Key Attributes |
| :--- | :--- | :--- | :--- |
| **HOSTEL** | `hostel_id` | — | `hostel_name`, `block_code` |
| **STUDENT** | `student_id` | `hostel_id` &rarr; `HOSTEL` | `roll_no` (UNIQUE), `name`, `room_no`, `phone`, `notification_laundry` |
| **MEAL_TYPE** | `meal_id` | — | `meal_name`, `standard_start_time`, `standard_end_time`, `avg_eating_time_minutes`, `buffer_time_minutes` |
| **MESS_MENU** | `menu_id` | `meal_id` &rarr; `MEAL_TYPE` | `day_of_week`, `dish_name`, `expected_prep_time_minutes`, `serving_note` (UNIQUE on `meal_id, day_of_week`) |
| **MESS_VISIT** | `visit_id` | `student_id` &rarr; `STUDENT`<br>`meal_id` &rarr; `MEAL_TYPE` | `visit_date`, `mess_entry_time`, `mess_exit_time`, `entry_timestamp`, `expected_exit_timestamp` |
| **LAUNDRY_BAG** | `bag_number` | `student_id` &rarr; `STUDENT` (UNIQUE) | Permanent 1:1 assignment (e.g. `B-214`) |
| **LAUNDRY_REQUEST** | `request_id` | `bag_number` &rarr; `LAUNDRY_BAG` | `submitted_datetime`, `bags_ahead_at_submission`, `expected_return_datetime`, `actual_received_datetime`, `status` |

### 3.2 Cardinalities
- **HOUSES (`HOSTEL` &mdash; `STUDENT`):** 1 : M
- **MAKES (`STUDENT` &mdash; `MESS_VISIT`):** 1 : M
- **CATEGORIZES (`MEAL_TYPE` &mdash; `MESS_VISIT`):** 1 : M
- **FEATURES (`MEAL_TYPE` &mdash; `MESS_MENU`):** 1 : M
- **IS_ASSIGNED (`STUDENT` &mdash; `LAUNDRY_BAG`):** 1 : 1 (Permanent bag assignment)
- **IS_USED_IN (`LAUNDRY_BAG` &mdash; `LAUNDRY_REQUEST`):** 1 : M

---

## 4. Core Formulas & Business Logic

### 4.1 Mess Expected Exit-Time Calculation (Synopsis 4.3)
At QR scan time, student scans once outside the entrance. The meal window is auto-detected:
- **Breakfast:** 08:00 – 09:00 (prep ~2 min, eating 15 min)
- **Lunch:** 11:30 – 14:00 (prep ~3 min, eating 20 min)
- **High Tea:** 17:00 – 18:00 (prep ~2 min, eating 15 min)
- **Dinner:** 20:00 – 22:00 (prep ~5 min, eating 20 min)

$$\text{expected\_exit} = \text{calculation\_start} + \text{dish\_prep\_minutes} + \text{avg\_eating\_minutes} + 5\text{ min buffer}$$

- **Early Arrival:** If a student scans within 15 minutes before opening, $\text{calculation\_start}$ begins at meal opening time.
- **Duplicate Guard:** A second scan within the same meal returns `"Already checked in"` with the previously calculated exit time.

### 4.2 Laundry Return-Time Estimation (Synopsis 4.4)
At bag submission, the system snapshots the number of bags in `SUBMITTED` or `WASHING` status:

$$\text{expected\_return} = \text{submitted\_datetime} + \text{historical\_avg\_turnaround} + (\text{bags\_ahead} \times 20\text{ min})$$

Where:
- $\text{historical\_avg\_turnaround}$: Calculated dynamically via SQL: `AVG((actual_received_datetime - submitted_datetime))` over received bags (default: 36 hours).
- $\text{bags\_ahead} \times 20\text{ min}$: Additional queue delay (20 min per bag).

### 4.3 30-Day Crowd Forecast Engine (Synopsis 4.5)
Visits over the past 30 days are grouped into 15-minute intervals. The slot with lowest historical volume is marked as `Best`, and time saved vs. peak rush is generated:
> *"Dinner is usually busiest 8:00–8:15 PM — try 8:30–8:45 PM instead. Save about 12 min."*

---

## 5. REST API Reference

### Mess Endpoints
- `POST /api/mess/scan`: Process QR scan (`{ rollNo, timestamp? }`)
- `GET /api/mess/status`: Real-time queue breakdown (waiting line, likely eating, total inside, active entry groups)
- `GET /api/mess/forecast/:meal`: 30-day historical pattern for meal with best recommended window
- `GET /api/mess/menu`: Full weekly menu grouped by day and meal
- `GET /api/mess/visits/:studentId`: Student visit history

### Laundry Endpoints
- `GET /api/laundry/status/:studentId`: Active bag status, step index (1 of 4), bags ahead now, expected return
- `POST /api/laundry/submit`: Submit student bag (`{ studentId, notes? }`)
- `POST /api/laundry/status`: Staff update (`{ requestId, status }`)
- `GET /api/laundry/queue`: Staff console queue in submission order
- `GET /api/laundry/history/:studentId`: Past requests with turnaround and on-time verdict

### Auth & Student Endpoints
- `POST /api/auth/send-otp`: Sends 6-digit OTP for roll number
- `POST /api/auth/verify-otp`: Validates OTP and returns profile with permanent bag
- `POST /api/students`: First-time student registration and automatic bag assignment
- `GET /api/students/:id`: Retrieve student profile

### Admin Endpoints
- `GET /api/admin/overview`: Headline stats, weekly visits, laundry throughput, dish queue impact, bottleneck alerts
- `GET /api/admin/heatmap`: 7-day x 4-meal crowd density matrix
- `POST /api/admin/menu/update`: Admin updates prep time or dish

