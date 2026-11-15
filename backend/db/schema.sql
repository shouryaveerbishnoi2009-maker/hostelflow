-- HostelFlow: Smart Hostel Time & Crowd Management System
-- Database Schema (DBMS II Year Project - Relational Model)
-- Student: Shouryaveer Bishnoi (2025BTECH111)

PRAGMA foreign_keys = ON;

-- 1. HOSTEL Entity
-- Every student belongs to exactly one hostel (1:M)
CREATE TABLE IF NOT EXISTS HOSTEL (
    hostel_id INTEGER PRIMARY KEY AUTOINCREMENT,
    hostel_name TEXT NOT NULL UNIQUE,
    block_code TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. STUDENT Entity
-- Stores student profile with permanent association to a hostel
CREATE TABLE IF NOT EXISTS STUDENT (
    student_id INTEGER PRIMARY KEY AUTOINCREMENT,
    roll_no TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    hostel_id INTEGER NOT NULL,
    room_no TEXT NOT NULL,
    phone TEXT NOT NULL,
    notification_laundry INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hostel_id) REFERENCES HOSTEL(hostel_id) ON DELETE RESTRICT
);

-- 3. MEAL_TYPE Entity
-- Stores standard meal windows, eating durations, and buffer times
-- Prefers code meal schedule: Breakfast (08:00-09:00), Lunch (11:30-14:00), High Tea (17:00-18:00), Dinner (20:00-22:00)
CREATE TABLE IF NOT EXISTS MEAL_TYPE (
    meal_id INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_name TEXT NOT NULL UNIQUE,
    standard_start_time TEXT NOT NULL, -- HH:MM (24-hour format)
    standard_end_time TEXT NOT NULL,   -- HH:MM (24-hour format)
    avg_eating_time_minutes INTEGER NOT NULL,
    buffer_time_minutes INTEGER NOT NULL DEFAULT 5,
    time_display TEXT NOT NULL,         -- e.g. "8–9 AM"
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. MESS_MENU Entity
-- Weekly menu storing exactly one dish per day, per meal
-- Each dish has an expected_prep_time_minutes affecting counter service duration
CREATE TABLE IF NOT EXISTS MESS_MENU (
    menu_id INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_id INTEGER NOT NULL,
    day_of_week TEXT NOT NULL CHECK(day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
    dish_name TEXT NOT NULL,
    expected_prep_time_minutes INTEGER NOT NULL CHECK(expected_prep_time_minutes >= 0),
    serving_note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meal_id) REFERENCES MEAL_TYPE(meal_id) ON DELETE CASCADE,
    UNIQUE (meal_id, day_of_week)
);

-- 5. MESS_VISIT Entity
-- Automated entry captured via QR scan
-- mess_exit_time is calculated at entry: entry_time + prep_time + eating_time + buffer
CREATE TABLE IF NOT EXISTS MESS_VISIT (
    visit_id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    meal_id INTEGER NOT NULL,
    visit_date DATE NOT NULL,
    mess_entry_time TIME NOT NULL,     -- HH:MM:SS
    mess_exit_time TIME NOT NULL,      -- Expected exit: HH:MM:SS
    entry_timestamp DATETIME NOT NULL,
    expected_exit_timestamp DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES STUDENT(student_id) ON DELETE CASCADE,
    FOREIGN KEY (meal_id) REFERENCES MEAL_TYPE(meal_id) ON DELETE RESTRICT
);

-- 6. LAUNDRY_BAG Entity
-- Permanent 1:1 assignment of a laundry bag to a student
CREATE TABLE IF NOT EXISTS LAUNDRY_BAG (
    bag_number TEXT PRIMARY KEY,
    student_id INTEGER NOT NULL UNIQUE,
    qr_code TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES STUDENT(student_id) ON DELETE CASCADE
);

-- 7. LAUNDRY_REQUEST Entity
-- 1:M relationship with LAUNDRY_BAG
-- Captures queue snapshot (bags_ahead_at_submission) and calculates expected_return_datetime
CREATE TABLE IF NOT EXISTS LAUNDRY_REQUEST (
    request_id INTEGER PRIMARY KEY AUTOINCREMENT,
    bag_number TEXT NOT NULL,
    submitted_datetime DATETIME NOT NULL,
    bags_ahead_at_submission INTEGER NOT NULL DEFAULT 0,
    expected_return_datetime DATETIME NOT NULL,
    actual_received_datetime DATETIME,
    status TEXT NOT NULL CHECK(status IN ('SUBMITTED', 'WASHING', 'READY', 'RECEIVED')) DEFAULT 'SUBMITTED',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bag_number) REFERENCES LAUNDRY_BAG(bag_number) ON DELETE CASCADE
);

-- Indexes for optimal DBMS performance and query execution
CREATE INDEX IF NOT EXISTS idx_student_roll ON STUDENT(roll_no);
CREATE INDEX IF NOT EXISTS idx_student_hostel ON STUDENT(hostel_id);
CREATE INDEX IF NOT EXISTS idx_visit_date_meal ON MESS_VISIT(visit_date, meal_id);
CREATE INDEX IF NOT EXISTS idx_visit_student ON MESS_VISIT(student_id);
CREATE INDEX IF NOT EXISTS idx_visit_timestamps ON MESS_VISIT(entry_timestamp, expected_exit_timestamp);
CREATE INDEX IF NOT EXISTS idx_laundry_status ON LAUNDRY_REQUEST(status);
CREATE INDEX IF NOT EXISTS idx_laundry_bag ON LAUNDRY_REQUEST(bag_number);
CREATE INDEX IF NOT EXISTS idx_menu_lookup ON MESS_MENU(meal_id, day_of_week);

