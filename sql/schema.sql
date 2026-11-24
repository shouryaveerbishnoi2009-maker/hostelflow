-- ============================================================================
-- HostelFlow — Smart Hostel Time & Crowd Management System
-- PostgreSQL Relational Schema (PostgreSQL 15+ / Supabase compatible)
-- Philosophy: Capture Once, Compute the Rest in SQL
-- ============================================================================

-- Extensions (UUID / cryptographic functions if needed)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing views and triggers first to ensure clean idempotency
DROP VIEW IF EXISTS v_dish_impact CASCADE;
DROP VIEW IF EXISTS v_laundry_queue_summary CASCADE;
DROP VIEW IF EXISTS v_mess_slot_analytics CASCADE;
DROP VIEW IF EXISTS v_live_mess_crowd CASCADE;

-- ============================================================================
-- 1. CORE RELATIONAL TABLES
-- ============================================================================

-- Multi-College SaaS Extension
CREATE TABLE IF NOT EXISTS COLLEGE (
    college_id SERIAL PRIMARY KEY,
    college_name VARCHAR(200) NOT NULL,
    college_code VARCHAR(50) UNIQUE NOT NULL,
    city VARCHAR(100),
    subscription_plan VARCHAR(50) DEFAULT 'BASIC' CHECK (subscription_plan IN ('BASIC', 'PRO', 'ENTERPRISE')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hostels under a College
CREATE TABLE IF NOT EXISTS HOSTEL (
    hostel_id SERIAL PRIMARY KEY,
    college_id INT NOT NULL REFERENCES COLLEGE(college_id) ON DELETE CASCADE,
    hostel_name VARCHAR(200) NOT NULL,
    capacity INT NOT NULL CHECK (capacity > 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Students linked to College and Hostel
CREATE TABLE IF NOT EXISTS STUDENT (
    student_id SERIAL PRIMARY KEY,
    college_id INT NOT NULL REFERENCES COLLEGE(college_id) ON DELETE CASCADE,
    roll_no VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    hostel_id INT REFERENCES HOSTEL(hostel_id) ON DELETE SET NULL,
    room_no VARCHAR(20),
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_college_student_roll UNIQUE (college_id, roll_no)
);

-- Administrative and operational staff
CREATE TABLE IF NOT EXISTS STAFF_ADMIN (
    staff_id SERIAL PRIMARY KEY,
    college_id INT NOT NULL REFERENCES COLLEGE(college_id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('SUPER_ADMIN', 'HOSTEL_ADMIN', 'MESS_STAFF', 'LAUNDRY_STAFF')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Standard Meal Windows per College
CREATE TABLE IF NOT EXISTS MEAL_TYPE (
    meal_id SERIAL PRIMARY KEY,
    college_id INT NOT NULL REFERENCES COLLEGE(college_id) ON DELETE CASCADE,
    meal_name VARCHAR(50) NOT NULL, -- Breakfast, Lunch, Dinner, High Tea
    standard_start_time TIME NOT NULL,
    standard_end_time TIME NOT NULL,
    avg_eating_time_minutes INT NOT NULL DEFAULT 15 CHECK (avg_eating_time_minutes > 0),
    buffer_minutes INT NOT NULL DEFAULT 5 CHECK (buffer_minutes >= 0),
    CONSTRAINT uq_college_meal UNIQUE (college_id, meal_name)
);

-- Weekly Mess Menu with Dish-Aware Preparation Time
CREATE TABLE IF NOT EXISTS MESS_MENU (
    menu_id SERIAL PRIMARY KEY,
    meal_id INT NOT NULL REFERENCES MEAL_TYPE(meal_id) ON DELETE CASCADE,
    day_of_week VARCHAR(10) NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
    dish_name VARCHAR(200) NOT NULL,
    expected_prep_time_minutes INT NOT NULL DEFAULT 5 CHECK (expected_prep_time_minutes >= 0),
    CONSTRAINT uq_meal_day_dish UNIQUE (meal_id, day_of_week, dish_name)
);

-- Mess Visits with Automated Exit Time Detection
CREATE TABLE IF NOT EXISTS MESS_VISIT (
    visit_id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES STUDENT(student_id) ON DELETE CASCADE,
    meal_id INT NOT NULL REFERENCES MEAL_TYPE(meal_id) ON DELETE CASCADE,
    visit_date DATE NOT NULL,
    mess_entry_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    mess_exit_time TIMESTAMPTZ,
    CONSTRAINT uq_student_meal_date UNIQUE (student_id, meal_id, visit_date)
);

-- Strict 1:1 Permanent Laundry Bag Assignment
CREATE TABLE IF NOT EXISTS LAUNDRY_BAG (
    bag_number VARCHAR(30) PRIMARY KEY,
    student_id INT NOT NULL UNIQUE REFERENCES STUDENT(student_id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW()
);

-- Laundry Request Lifecycle Tracking
CREATE TABLE IF NOT EXISTS LAUNDRY_REQUEST (
    request_id SERIAL PRIMARY KEY,
    bag_number VARCHAR(30) NOT NULL REFERENCES LAUNDRY_BAG(bag_number) ON DELETE CASCADE,
    submitted_datetime TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    bags_ahead_at_submission INT NOT NULL DEFAULT 0,
    expected_return_datetime TIMESTAMPTZ,
    actual_received_datetime TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'WASHING', 'READY', 'COLLECTED'))
);

-- ============================================================================
-- 2. INDEXES FOR HIGH-THROUGHPUT CONCURRENCY
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_hostel_college ON HOSTEL(college_id);
CREATE INDEX IF NOT EXISTS idx_student_college ON STUDENT(college_id);
CREATE INDEX IF NOT EXISTS idx_student_hostel ON STUDENT(hostel_id);
CREATE INDEX IF NOT EXISTS idx_staff_college ON STAFF_ADMIN(college_id);
CREATE INDEX IF NOT EXISTS idx_meal_college ON MEAL_TYPE(college_id);
CREATE INDEX IF NOT EXISTS idx_menu_meal ON MESS_MENU(meal_id);
CREATE INDEX IF NOT EXISTS idx_visit_student ON MESS_VISIT(student_id);
CREATE INDEX IF NOT EXISTS idx_visit_meal ON MESS_VISIT(meal_id);
CREATE INDEX IF NOT EXISTS idx_visit_entry ON MESS_VISIT(mess_entry_time);
CREATE INDEX IF NOT EXISTS idx_visit_exit ON MESS_VISIT(mess_exit_time);
CREATE INDEX IF NOT EXISTS idx_laundry_req_bag ON LAUNDRY_REQUEST(bag_number);
CREATE INDEX IF NOT EXISTS idx_laundry_req_status ON LAUNDRY_REQUEST(status);
CREATE INDEX IF NOT EXISTS idx_laundry_req_submitted ON LAUNDRY_REQUEST(submitted_datetime);

-- ============================================================================
-- 3. STORED PROCEDURES & TRIGGERS
-- ============================================================================

-- Function 1: Compute exit time for MESS_VISIT
CREATE OR REPLACE FUNCTION trg_fn_calculate_mess_exit()
RETURNS TRIGGER AS $$
DECLARE
    v_college_id INT;
    v_entry_ist_time TIME;
    v_day_name VARCHAR(10);
    v_avg_eating INT;
    v_buffer INT;
    v_prep_time INT := 5;
    v_detected_meal_id INT;
BEGIN
    -- 1. Identify student's college
    SELECT college_id INTO v_college_id
    FROM STUDENT
    WHERE student_id = NEW.student_id;

    -- 2. Extract IST day and time for meal comparison
    v_entry_ist_time := (NEW.mess_entry_time AT TIME ZONE 'Asia/Kolkata')::TIME;
    v_day_name := TRIM(TO_CHAR(NEW.mess_entry_time AT TIME ZONE 'Asia/Kolkata', 'Day'));

    -- 3. Automatically detect meal_id if not supplied or if matching standard windows
    IF NEW.meal_id IS NULL THEN
        SELECT meal_id INTO v_detected_meal_id
        FROM MEAL_TYPE
        WHERE college_id = v_college_id
          AND v_entry_ist_time BETWEEN standard_start_time AND standard_end_time
        ORDER BY standard_start_time
        LIMIT 1;

        IF v_detected_meal_id IS NOT NULL THEN
            NEW.meal_id := v_detected_meal_id;
        ELSE
            -- Default to nearest meal if scanned slightly outside official boundary
            SELECT meal_id INTO NEW.meal_id
            FROM MEAL_TYPE
            WHERE college_id = v_college_id
            ORDER BY ABS(EXTRACT(EPOCH FROM (standard_start_time - v_entry_ist_time)))
            LIMIT 1;
        END IF;
    END IF;

    -- 4. Set visit_date in Indian Standard Time
    NEW.visit_date := (NEW.mess_entry_time AT TIME ZONE 'Asia/Kolkata')::DATE;

    -- 5. Fetch meal parameters
    SELECT avg_eating_time_minutes, buffer_minutes
    INTO v_avg_eating, v_buffer
    FROM MEAL_TYPE
    WHERE meal_id = NEW.meal_id;

    IF v_avg_eating IS NULL THEN
        v_avg_eating := 15;
    END IF;
    IF v_buffer IS NULL THEN
        v_buffer := 5;
    END IF;

    -- 6. Fetch dish expected prep time for today's menu
    SELECT COALESCE(MAX(expected_prep_time_minutes), 5)
    INTO v_prep_time
    FROM MESS_MENU
    WHERE meal_id = NEW.meal_id
      AND day_of_week = v_day_name;

    -- 7. Compute mess_exit_time = mess_entry_time + (prep + eating + buffer) minutes
    NEW.mess_exit_time := NEW.mess_entry_time + ((v_prep_time + v_avg_eating + v_buffer) * INTERVAL '1 minute');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_before_insert_mess_visit ON MESS_VISIT;
CREATE TRIGGER trg_before_insert_mess_visit
    BEFORE INSERT ON MESS_VISIT
    FOR EACH ROW
    EXECUTE FUNCTION trg_fn_calculate_mess_exit();

-- Function 2: Compute queue snapshot and ETA for LAUNDRY_REQUEST
CREATE OR REPLACE FUNCTION trg_fn_calculate_laundry_eta()
RETURNS TRIGGER AS $$
DECLARE
    v_college_id INT;
    v_active_ahead INT := 0;
    v_avg_proc_minutes INT := 90; -- Standard 1.5 hours per laundry cycle
BEGIN
    -- 1. Find college_id for this laundry bag's owner
    SELECT s.college_id INTO v_college_id
    FROM LAUNDRY_BAG lb
    JOIN STUDENT s ON lb.student_id = s.student_id
    WHERE lb.bag_number = NEW.bag_number;

    -- 2. Count active bags ahead (SUBMITTED or WASHING) across this college's laundry room
    SELECT COUNT(*) INTO v_active_ahead
    FROM LAUNDRY_REQUEST lr
    JOIN LAUNDRY_BAG lb ON lr.bag_number = lb.bag_number
    JOIN STUDENT s ON lb.student_id = s.student_id
    WHERE s.college_id = v_college_id
      AND lr.status IN ('SUBMITTED', 'WASHING')
      AND lr.request_id != COALESCE(NEW.request_id, -1);

    NEW.bags_ahead_at_submission := v_active_ahead;

    -- 3. Point-in-time ETA calculation:
    -- Expected Return = submitted_time + ((bags_ahead + 1) * processing_minutes_per_bag)
    NEW.expected_return_datetime := NEW.submitted_datetime + (((v_active_ahead + 1) * v_avg_proc_minutes) * INTERVAL '1 minute');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_before_insert_laundry_request ON LAUNDRY_REQUEST;
CREATE TRIGGER trg_before_insert_laundry_request
    BEFORE INSERT ON LAUNDRY_REQUEST
    FOR EACH ROW
    EXECUTE FUNCTION trg_fn_calculate_laundry_eta();

-- ============================================================================
-- 4. REPORTING & ANALYTICAL SQL VIEWS
-- ============================================================================

-- View 1: Real-time Live Diners in Mess
CREATE OR REPLACE VIEW v_live_mess_crowd AS
SELECT
    h.hostel_id,
    h.hostel_name,
    h.college_id,
    c.college_name,
    mt.meal_id,
    mt.meal_name,
    COUNT(mv.visit_id) AS active_diners,
    ROUND((COUNT(mv.visit_id)::NUMERIC / NULLIF(h.capacity, 0)) * 100, 1) AS capacity_utilization_pct
FROM HOSTEL h
JOIN COLLEGE c ON h.college_id = c.college_id
CROSS JOIN MEAL_TYPE mt
LEFT JOIN STUDENT s ON s.hostel_id = h.hostel_id
LEFT JOIN MESS_VISIT mv ON mv.student_id = s.student_id
    AND mv.meal_id = mt.meal_id
    AND NOW() BETWEEN mv.mess_entry_time AND mv.mess_exit_time
WHERE mt.college_id = h.college_id
GROUP BY h.hostel_id, h.hostel_name, h.college_id, c.college_name, h.capacity, mt.meal_id, mt.meal_name;

-- View 2: 15-Minute Slot Analytics (Crowd Heatmap & Predictor)
CREATE OR REPLACE VIEW v_mess_slot_analytics AS
SELECT
    s.college_id,
    mv.meal_id,
    mt.meal_name,
    TRIM(TO_CHAR(mv.mess_entry_time AT TIME ZONE 'Asia/Kolkata', 'Day')) AS day_of_week,
    DATE_TRUNC('hour', mv.mess_entry_time AT TIME ZONE 'Asia/Kolkata') +
    (FLOOR(EXTRACT(MINUTE FROM mv.mess_entry_time AT TIME ZONE 'Asia/Kolkata') / 15) * 15 * INTERVAL '1 minute') AS time_slot,
    TO_CHAR(
        DATE_TRUNC('hour', mv.mess_entry_time AT TIME ZONE 'Asia/Kolkata') +
        (FLOOR(EXTRACT(MINUTE FROM mv.mess_entry_time AT TIME ZONE 'Asia/Kolkata') / 15) * 15 * INTERVAL '1 minute'),
        'HH24:MI'
    ) AS slot_label,
    COUNT(mv.visit_id) AS visit_count,
    ROUND(AVG(EXTRACT(EPOCH FROM (mv.mess_exit_time - mv.mess_entry_time)) / 60)::NUMERIC, 1) AS avg_duration_mins
FROM MESS_VISIT mv
JOIN MEAL_TYPE mt ON mv.meal_id = mt.meal_id
JOIN STUDENT s ON mv.student_id = s.student_id
WHERE mv.mess_exit_time IS NOT NULL
GROUP BY
    s.college_id,
    mv.meal_id,
    mt.meal_name,
    TRIM(TO_CHAR(mv.mess_entry_time AT TIME ZONE 'Asia/Kolkata', 'Day')),
    DATE_TRUNC('hour', mv.mess_entry_time AT TIME ZONE 'Asia/Kolkata') +
    (FLOOR(EXTRACT(MINUTE FROM mv.mess_entry_time AT TIME ZONE 'Asia/Kolkata') / 15) * 15 * INTERVAL '1 minute');

-- View 3: Laundry Queue Operational Summary
CREATE OR REPLACE VIEW v_laundry_queue_summary AS
SELECT
    s.college_id,
    COUNT(CASE WHEN lr.status = 'SUBMITTED' THEN 1 END) AS submitted_count,
    COUNT(CASE WHEN lr.status = 'WASHING' THEN 1 END) AS washing_count,
    COUNT(CASE WHEN lr.status = 'READY' THEN 1 END) AS ready_count,
    COUNT(CASE WHEN lr.status = 'COLLECTED' THEN 1 END) AS collected_count,
    COUNT(CASE WHEN lr.status IN ('SUBMITTED', 'WASHING') THEN 1 END) AS active_queue_total,
    ROUND(AVG(CASE WHEN lr.status = 'COLLECTED' AND lr.actual_received_datetime IS NOT NULL
        THEN EXTRACT(EPOCH FROM (lr.actual_received_datetime - lr.submitted_datetime)) / 3600
    END)::NUMERIC, 1) AS avg_turnaround_hours
FROM LAUNDRY_REQUEST lr
JOIN LAUNDRY_BAG lb ON lr.bag_number = lb.bag_number
JOIN STUDENT s ON lb.student_id = s.student_id
GROUP BY s.college_id;

-- View 4: Dish Impact on Stay and Queue Duration
CREATE OR REPLACE VIEW v_dish_impact AS
SELECT
    s.college_id,
    mm.meal_id,
    mt.meal_name,
    mm.dish_name,
    mm.expected_prep_time_minutes,
    COUNT(mv.visit_id) AS visit_count,
    ROUND(AVG(EXTRACT(EPOCH FROM (mv.mess_exit_time - mv.mess_entry_time)) / 60)::NUMERIC, 1) AS avg_duration_mins
FROM MESS_MENU mm
JOIN MEAL_TYPE mt ON mm.meal_id = mt.meal_id
JOIN MESS_VISIT mv ON mv.meal_id = mt.meal_id
    AND TRIM(TO_CHAR(mv.mess_entry_time AT TIME ZONE 'Asia/Kolkata', 'Day')) = mm.day_of_week
JOIN STUDENT s ON mv.student_id = s.student_id
WHERE mv.mess_exit_time IS NOT NULL
GROUP BY s.college_id, mm.meal_id, mt.meal_name, mm.dish_name, mm.expected_prep_time_minutes;
