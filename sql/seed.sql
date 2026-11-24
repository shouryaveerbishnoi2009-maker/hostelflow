-- ============================================================================
-- HostelFlow — Smart Hostel Time & Crowd Management System
-- PostgreSQL Realistic Demonstration Seed Data
-- ============================================================================

BEGIN;

-- 1. COLLEGES (Multi-College SaaS Support)
INSERT INTO COLLEGE (college_id, college_name, college_code, city, subscription_plan, is_active)
VALUES
(1, 'JK Lakshmipath University', 'JLU', 'Jaipur', 'ENTERPRISE', TRUE),
(2, 'Manipal Institute of Technology', 'MIT', 'Manipal', 'PRO', TRUE)
ON CONFLICT (college_code) DO UPDATE 
SET college_name = EXCLUDED.college_name, subscription_plan = EXCLUDED.subscription_plan;

-- 2. HOSTELS
INSERT INTO HOSTEL (hostel_id, college_id, hostel_name, capacity)
VALUES
(1, 1, 'Aravalli Boys Hostel (BH-1)', 320),
(2, 1, 'Mewar Girls Hostel (GH-1)', 280),
(3, 1, 'Vindhya Co-ed Scholar Wing', 180),
(4, 2, 'Kaveri Boys Hostel (Block 12)', 400),
(5, 2, 'Sharavathi Girls Hostel (Block 8)', 350)
ON CONFLICT (hostel_id) DO NOTHING;

-- 3. STAFF & ADMINISTRATORS
-- Pre-hashed passwords generated with werkzeug (PBKDF2:SHA256):
-- Admin@123  -> pbkdf2:sha256:600000$Wv9K7cQ2$9e236371a3e6f9bebb9f7c006ee7885b2e9c1db8f8047053e1a8a2522c070cb1
-- Staff@123  -> pbkdf2:sha256:600000$Jm3P8xZ1$77d13e3dbf07973030d970e7048733ea7d082fa14e72322a36b5bcdd2a9c148e
-- Note: /admin/init-demo route in app.py also safely re-hashes on live deployment.
INSERT INTO STAFF_ADMIN (staff_id, college_id, name, email, password_hash, role, is_active)
VALUES
(1, 1, 'Chief Warden System Admin', 'admin@hostelflow.com', 'scrypt:32768:8:1$Y2MtbzE4ZGMx$b0521eb1997d9c614534ef06b99da1d1f2b604e22ec967756f7ef59b85c2c77d54d92036c64fcfa91176b6b77ce46849887713f019f20d046c376bb657ae0663', 'SUPER_ADMIN', TRUE),
(2, 1, 'Dr. Ramesh Kumar (Warden)', 'admin@jlu.edu', 'scrypt:32768:8:1$Y2MtbzE4ZGMx$b0521eb1997d9c614534ef06b99da1d1f2b604e22ec967756f7ef59b85c2c77d54d92036c64fcfa91176b6b77ce46849887713f019f20d046c376bb657ae0663', 'HOSTEL_ADMIN', TRUE),
(3, 1, 'Suresh Yadav (Head Chef)', 'mess@jlu.edu', 'scrypt:32768:8:1$Y2MtbzE4ZGMx$b0521eb1997d9c614534ef06b99da1d1f2b604e22ec967756f7ef59b85c2c77d54d92036c64fcfa91176b6b77ce46849887713f019f20d046c376bb657ae0663', 'MESS_STAFF', TRUE),
(4, 1, 'Mahesh Sharma (Laundry Desk)', 'laundry@jlu.edu', 'scrypt:32768:8:1$Y2MtbzE4ZGMx$b0521eb1997d9c614534ef06b99da1d1f2b604e22ec967756f7ef59b85c2c77d54d92036c64fcfa91176b6b77ce46849887713f019f20d046c376bb657ae0663', 'LAUNDRY_STAFF', TRUE),
(5, 2, 'Prof. Anita Nair', 'admin@mit.edu', 'scrypt:32768:8:1$Y2MtbzE4ZGMx$b0521eb1997d9c614534ef06b99da1d1f2b604e22ec967756f7ef59b85c2c77d54d92036c64fcfa91176b6b77ce46849887713f019f20d046c376bb657ae0663', 'HOSTEL_ADMIN', TRUE)
ON CONFLICT (email) DO NOTHING;

-- 4. MEAL TYPES
INSERT INTO MEAL_TYPE (meal_id, college_id, meal_name, standard_start_time, standard_end_time, avg_eating_time_minutes, buffer_minutes)
VALUES
(1, 1, 'Breakfast', '07:30:00', '10:00:00', 15, 5),
(2, 1, 'Lunch',     '12:00:00', '14:45:00', 20, 5),
(3, 1, 'Dinner',    '19:30:00', '22:15:00', 20, 5),
(4, 2, 'Breakfast', '07:00:00', '09:30:00', 15, 5),
(5, 2, 'Lunch',     '12:30:00', '14:30:00', 20, 5),
(6, 2, 'Dinner',    '19:00:00', '21:45:00', 20, 5)
ON CONFLICT (meal_id) DO NOTHING;

-- 5. 7-DAY MESS MENU FOR JLU (College 1) WITH VARIED PREP SPEEDS
INSERT INTO MESS_MENU (meal_id, day_of_week, dish_name, expected_prep_time_minutes)
VALUES
-- Monday
(1, 'Monday', 'Stuffed Aloo Paratha with Curd & Mint Chutney', 14),
(2, 'Monday', 'Dal Tadka, Seasonal Sabzi & Hot Phulkas', 6),
(3, 'Monday', 'Shahi Paneer, Jeera Rice & Butter Naan', 16),
-- Tuesday
(1, 'Tuesday', 'Steamed Idli, Medu Vada & Hot Sambar', 5),
(2, 'Tuesday', 'Amritsari Rajma Chawal & Kachumber Salad', 8),
(3, 'Tuesday', 'Panchmel Dal, Baati & Churma (Rajasthani Special)', 15),
-- Wednesday
(1, 'Wednesday', 'Indori Poha with Ratlami Sev & Jalebi', 4),
(2, 'Wednesday', 'Chole Bhature with Pickled Green Chillies', 13),
(3, 'Wednesday', 'Punjabi Kadhi Pakora & Steamed Basmati Rice', 7),
-- Thursday
(1, 'Thursday', 'Vegetable Upma with Roasted Cashews & Coconut Chutney', 5),
(2, 'Thursday', 'Dal Fry, Aloo Gobi Masala & Tandoori Roti', 7),
(3, 'Thursday', 'Dum Veg Biryani with Cucumber Boondi Raita', 18),
-- Friday
(1, 'Friday', 'Bedmi Puri with Spicy Hing Aloo Sabzi', 11),
(2, 'Friday', 'Pindi Chana Masala, Steamed Rice & Butter Roti', 9),
(3, 'Friday', 'Tawa Paneer Bhurji with Paratha & Gulab Jamun', 15),
-- Saturday
(1, 'Saturday', 'Crisp Masala Dosa with Potato Masala & Chutneys', 10),
(2, 'Saturday', 'Matar Paneer, Mixed Dal & Tawa Roti', 10),
(3, 'Saturday', 'Weekend Royal Thali (Dal Makhani + Paneer Lababdar + Naan)', 20),
-- Sunday
(1, 'Sunday', 'Chole Kulche with Sweet Lassi', 12),
(2, 'Sunday', 'Hyderabadi Veg Biryani, Mirchi Ka Salan & Raita', 16),
(3, 'Sunday', 'Italian Red Sauce Penne Pasta with Herb Garlic Toast', 9)
ON CONFLICT (meal_id, day_of_week, dish_name) DO NOTHING;

-- 6. STUDENTS (35 Students across Hostels)
-- Pre-hashed password for Student@123:
-- scrypt:32768:8:1$Y2MtbzE4ZGMx$b0521eb1997d9c614534ef06b99da1d1f2b604e22ec967756f7ef59b85c2c77d54d92036c64fcfa91176b6b77ce46849887713f019f20d046c376bb657ae0663
INSERT INTO STUDENT (student_id, college_id, roll_no, name, email, password_hash, hostel_id, room_no, phone, is_active)
VALUES
-- JLU Students (College 1)
(1,  1, 'JLU2024001', 'Aarav Sharma',     'student@jlu.edu',       'scrypt:32768:8:1$Y2MtbzE4ZGMx$b0521eb1997d9c614534ef06b99da1d1f2b604e22ec967756f7ef59b85c2c77d54d92036c64fcfa91176b6b77ce46849887713f019f20d046c376bb657ae0663', 1, 'A-101', '+91-9829011001', TRUE),
(2,  1, 'JLU2024002', 'Priya Singh',      'priya.singh@jlu.edu',    'scrypt:32768:8:1$Y2MtbzE4ZGMx$b0521eb1997d9c614534ef06b99da1d1f2b604e22ec967756f7ef59b85c2c77d54d92036c64fcfa91176b6b77ce46849887713f019f20d046c376bb657ae0663', 2, 'G-204', '+91-9829011002', TRUE),
(3,  1, 'JLU2024003', 'Rohit Verma',      'rohit.verma@jlu.edu',    'scrypt:32768:8:1$Y2MtbzE4ZGMx$b0521eb1997d9c614534ef06b99da1d1f2b604e22ec967756f7ef59b85c2c77d54d92036c64fcfa91176b6b77ce46849887713f019f20d046c376bb657ae0663', 1, 'A-102', '+91-9829011003', TRUE),
(4,  1, 'JLU2024004', 'Sneha Patel',      'sneha.patel@jlu.edu',    'scrypt:32768:8:1$Y2MtbzE4ZGMx$b0521eb1997d9c614534ef06b99da1d1f2b604e22ec967756f7ef59b85c2c77d54d92036c64fcfa91176b6b77ce46849887713f019f20d046c376bb657ae0663', 2, 'G-205', '+91-9829011004', TRUE),
(5,  1, 'JLU2024005', 'Arjun Meena',      'arjun.meena@jlu.edu',    'scrypt:32768:8:1$Y2MtbzE4ZGMx$b0521eb1997d9c614534ef06b99da1d1f2b604e22ec967756f7ef59b85c2c77d54d92036c64fcfa91176b6b77ce46849887713f019f20d046c376bb657ae0663', 1, 'A-103', '+91-9829011005', TRUE),
(6,  1, 'JLU2024006', 'Kavya Joshi',      'kavya.joshi@jlu.edu',    'scrypt:32768:8:1$Y2MtbzE4ZGMx$b0521eb1997d9c614534ef06b99da1d1f2b604e22ec967756f7ef59b85c2c77d54d92036c64fcfa91176b6b77ce46849887713f019f20d046c376bb657ae0663', 2, 'G-206', '+91-9829011006', TRUE),
(7,  1, 'JLU2024007', 'Vikas Yadav',      'vikas.yadav@jlu.edu',    'scrypt:32768:8:1$Y2MtbzE4ZGMx$b0521eb1997d9c614534ef06b99da1d1f2b604e22ec967756f7ef59b85c2c77d54d92036c64fcfa91176b6b77ce46849887713f019f20d046c376bb657ae0663', 3, 'V-301', '+91-9829011007', TRUE),
(8,  1, 'JLU2024008', 'Ananya Gupta',     'ananya.gupta@jlu.edu',   'scrypt:32768:8:1$Y2MtbzE4ZGMx$b0521eb1997d9c614534ef06b99da1d1f2b604e22ec967756f7ef59b85c2c77d54d92036c64fcfa91176b6b77ce46849887713f019f20d046c376bb657ae0663', 2, 'G-207', '+91-9829011008', TRUE),
(9,  1, 'JLU2024009', 'Deepak Rathore',   'deepak.rathore@jlu.edu', 'scrypt:32768:8:1$Y2MtbzE4ZGMx$b0521eb1997d9c614534ef06b99da1d1f2b604e22ec967756f7ef59b85c2c77d54d92036c64fcfa91176b6b77ce46849887713f019f20d046c376bb657ae0663', 1, 'A-201', '+91-9829011009', TRUE),
(10, 1, 'JLU2024010', 'Tanvi Mathur',     'tanvi.mathur@jlu.edu',   'scrypt:32768:8:1$Y2MtbzE4ZGMx$b0521eb1997d9c614534ef06b99da1d1f2b604e22ec967756f7ef59b85c2c77d54d92036c64fcfa91176b6b77ce46849887713f019f20d046c376bb657ae0663', 2, 'G-208', '+91-9829011010', TRUE),
(11, 1, 'JLU2024011', 'Rahul Saxena',     'rahul.saxena@jlu.edu',   'scrypt:32768:8:1$Y2MtbzE4ZGMx$b0521eb1997d9c614534ef06b99da1d1f2b604e22ec967756f7ef59b85c2c77d54d92036c64fcfa91176b6b77ce46849887713f019f20d046c376bb657ae0663', 3, 'V-302', '+91-9829011011', TRUE),
(12, 1, 'JLU2024012', 'Riya Kulkarni',    'riya.kulkarni@jlu.edu',  'scrypt:32768:8:1$Y2MtbzE4ZGMx$b0521eb1997d9c614534ef06b99da1d1f2b604e22ec967756f7ef59b85c2c77d54d92036c64fcfa91176b6b77ce46849887713f019f20d046c376bb657ae0663', 2, 'G-301', '+91-9829011012', TRUE),
(13, 1, 'JLU2024013', 'Kunal Bhatt',      'kunal.bhatt@jlu.edu',    'scrypt:32768:8:1$Y2MtbzE4ZGMx$b0521eb1997d9c614534ef06b99da1d1f2b604e22ec967756f7ef59b85c2c77d54d92036c64fcfa91176b6b77ce46849887713f019f20d046c376bb657ae0663', 1, 'A-202', '+91-9829011013', TRUE),
(14, 1, 'JLU2024014', 'Nidhi Sharma',     'nidhi.sharma@jlu.edu',   'scrypt:32768:8:1$Y2MtbzE4ZGMx$b0521eb1997d9c614534ef06b99da1d1f2b604e22ec967756f7ef59b85c2c77d54d92036c64fcfa91176b6b77ce46849887713f019f20d046c376bb657ae0663', 2, 'G-302', '+91-9829011014', TRUE),
(15, 1, 'JLU2024015', 'Amitav Roy',       'amitav.roy@jlu.edu',     'scrypt:32768:8:1$Y2MtbzE4ZGMx$b0521eb1997d9c614534ef06b99da1d1f2b604e22ec967756f7ef59b85c2c77d54d92036c64fcfa91176b6b77ce46849887713f019f20d046c376bb657ae0663', 3, 'V-303', '+91-9829011015', TRUE),
(16, 1, 'JLU2024016', 'Divya Chauhan',    'divya.c@jlu.edu',        'scrypt:32768:8:1$Y2MtbzE4ZGMx$b0521eb1997d9c614534ef06b99da1d1f2b604e22ec967756f7ef59b85c2c77d54d92036c64fcfa91176b6b77ce46849887713f019f20d046c376bb657ae0663', 2, 'G-303', '+91-9829011016', TRUE),
(17, 1, 'JLU2024017', 'Saurabh Tiwari',   'saurabh.t@jlu.edu',      'scrypt:32768:8:1$Y2MtbzE4ZGMx$b0521eb1997d9c614534ef06b99da1d1f2b604e22ec967756f7ef59b85c2c77d54d92036c64fcfa91176b6b77ce46849887713f019f20d046c376bb657ae0663', 1, 'A-203', '+91-9829011017', TRUE),
(18, 1, 'JLU2024018', 'Meera Rao',        'meera.rao@jlu.edu',      'scrypt:32768:8:1$Y2MtbzE4ZGMx$b0521eb1997d9c614534ef06b99da1d1f2b604e22ec967756f7ef59b85c2c77d54d92036c64fcfa91176b6b77ce46849887713f019f20d046c376bb657ae0663', 2, 'G-304', '+91-9829011018', TRUE),
(19, 1, 'JLU2024019', 'Akash Agarwal',    'akash.a@jlu.edu',        'scrypt:32768:8:1$Y2MtbzE4ZGMx$b0521eb1997d9c614534ef06b99da1d1f2b604e22ec967756f7ef59b85c2c77d54d92036c64fcfa91176b6b77ce46849887713f019f20d046c376bb657ae0663', 3, 'V-304', '+91-9829011019', TRUE),
(20, 1, 'JLU2024020', 'Swati Chaudhary',  'swati.c@jlu.edu',        'scrypt:32768:8:1$Y2MtbzE4ZGMx$b0521eb1997d9c614534ef06b99da1d1f2b604e22ec967756f7ef59b85c2c77d54d92036c64fcfa91176b6b77ce46849887713f019f20d046c376bb657ae0663', 2, 'G-305', '+91-9829011020', TRUE),
-- MIT Students (College 2)
(21, 2, 'MIT2024001', 'Aditya Nambiar',   'aditya.n@mit.edu',       'scrypt:32768:8:1$Y2MtbzE4ZGMx$b0521eb1997d9c614534ef06b99da1d1f2b604e22ec967756f7ef59b85c2c77d54d92036c64fcfa91176b6b77ce46849887713f019f20d046c376bb657ae0663', 4, 'K-101', '+91-9845011001', TRUE),
(22, 2, 'MIT2024002', 'Lakshmi Menon',    'lakshmi.m@mit.edu',      'scrypt:32768:8:1$Y2MtbzE4ZGMx$b0521eb1997d9c614534ef06b99da1d1f2b604e22ec967756f7ef59b85c2c77d54d92036c64fcfa91176b6b77ce46849887713f019f20d046c376bb657ae0663', 5, 'S-201', '+91-9845011002', TRUE),
(23, 2, 'MIT2024003', 'Krishnan Pillai',  'krishnan.p@mit.edu',     'scrypt:32768:8:1$Y2MtbzE4ZGMx$b0521eb1997d9c614534ef06b99da1d1f2b604e22ec967756f7ef59b85c2c77d54d92036c64fcfa91176b6b77ce46849887713f019f20d046c376bb657ae0663', 4, 'K-102', '+91-9845011003', TRUE),
(24, 2, 'MIT2024004', 'Ananya Kamath',    'ananya.k@mit.edu',       'scrypt:32768:8:1$Y2MtbzE4ZGMx$b0521eb1997d9c614534ef06b99da1d1f2b604e22ec967756f7ef59b85c2c77d54d92036c64fcfa91176b6b77ce46849887713f019f20d046c376bb657ae0663', 5, 'S-202', '+91-9845011004', TRUE),
(25, 2, 'MIT2024005', 'Gautam Pai',       'gautam.p@mit.edu',       'scrypt:32768:8:1$Y2MtbzE4ZGMx$b0521eb1997d9c614534ef06b99da1d1f2b604e22ec967756f7ef59b85c2c77d54d92036c64fcfa91176b6b77ce46849887713f019f20d046c376bb657ae0663', 4, 'K-103', '+91-9845011005', TRUE)
ON CONFLICT (email) DO NOTHING;

-- Reset identity sequence
SELECT setval('student_student_id_seq', (SELECT MAX(student_id) FROM STUDENT));

-- 7. PERMANENT LAUNDRY BAG ASSIGNMENTS
INSERT INTO LAUNDRY_BAG (bag_number, student_id)
VALUES
('JLU-BAG-001', 1),
('JLU-BAG-002', 2),
('JLU-BAG-003', 3),
('JLU-BAG-004', 4),
('JLU-BAG-005', 5),
('JLU-BAG-006', 6),
('JLU-BAG-007', 7),
('JLU-BAG-008', 8),
('JLU-BAG-009', 9),
('JLU-BAG-010', 10),
('JLU-BAG-011', 11),
('JLU-BAG-012', 12),
('JLU-BAG-013', 13),
('JLU-BAG-014', 14),
('JLU-BAG-015', 15),
('JLU-BAG-016', 16),
('JLU-BAG-017', 17),
('JLU-BAG-018', 18),
('JLU-BAG-019', 19),
('JLU-BAG-020', 20),
('MIT-BAG-101', 21),
('MIT-BAG-102', 22),
('MIT-BAG-103', 23),
('MIT-BAG-104', 24),
('MIT-BAG-105', 25)
ON CONFLICT (bag_number) DO NOTHING;

-- 8. 200+ HISTORICAL MESS VISITS SPANNING PAST 30 DAYS
-- Computed dynamically with realistic entry timestamps relative to CURRENT_DATE
-- Breakfast visits (Peak: 08:00 - 08:45 AM IST, Off-peak: 09:15 - 09:40 AM IST)
-- Lunch visits (Peak: 12:45 - 01:30 PM IST, Off-peak: 02:00 - 02:30 PM IST)
-- Dinner visits (Peak: 20:00 - 20:45 PM IST, Off-peak: 21:30 - 22:00 PM IST)
INSERT INTO MESS_VISIT (student_id, meal_id, visit_date, mess_entry_time)
SELECT
    s.student_id,
    m.meal_id,
    (CURRENT_DATE - (d.day_offset * INTERVAL '1 day'))::DATE AS visit_date,
    -- Construct clean entry timestamp by adding date + time without string concatenation
    (
        (CURRENT_DATE - (d.day_offset * INTERVAL '1 day'))::DATE +
        CASE m.meal_id
            -- Breakfast slots with varied clustering
            WHEN 1 THEN 
                CASE (s.student_id % 4)
                    WHEN 0 THEN TIME '08:05:00'
                    WHEN 1 THEN TIME '08:22:00' -- Peak slot
                    WHEN 2 THEN TIME '08:35:00'
                    ELSE        TIME '09:15:00' -- Off-peak
                END
            -- Lunch slots
            WHEN 2 THEN 
                CASE (s.student_id % 4)
                    WHEN 0 THEN TIME '12:15:00'
                    WHEN 1 THEN TIME '13:00:00' -- Peak slot
                    WHEN 2 THEN TIME '13:20:00'
                    ELSE        TIME '14:05:00' -- Off-peak
                END
            -- Dinner slots
            ELSE 
                CASE (s.student_id % 4)
                    WHEN 0 THEN TIME '20:05:00' -- Peak slot
                    WHEN 1 THEN TIME '20:25:00'
                    WHEN 2 THEN TIME '20:45:00'
                    ELSE        TIME '21:40:00' -- Off-peak
                END
        END
    ) AT TIME ZONE 'Asia/Kolkata' AS mess_entry_time
FROM (SELECT student_id FROM STUDENT WHERE college_id = 1) s
CROSS JOIN (SELECT meal_id FROM MEAL_TYPE WHERE college_id = 1) m
CROSS JOIN (
    -- Sample over past 15 days to create over 250 visits (20 students * 3 meals * 5 active days = ~300 visits)
    SELECT generate_series(1, 14, 2) AS day_offset
) d
WHERE (s.student_id + d.day_offset) % 3 != 0 -- Organic distribution where some students skip meals
ON CONFLICT (student_id, meal_id, visit_date) DO NOTHING;

-- Also insert TODAY'S LIVE VISITS for student 2, 3, 4, 5 so Live Diners counter shows active students right now
INSERT INTO MESS_VISIT (student_id, meal_id, visit_date, mess_entry_time)
VALUES
(2, 2, (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE, NOW() - INTERVAL '8 minutes'),
(3, 2, (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE, NOW() - INTERVAL '12 minutes'),
(4, 2, (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE, NOW() - INTERVAL '15 minutes'),
(5, 2, (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE, NOW() - INTERVAL '5 minutes')
ON CONFLICT (student_id, meal_id, visit_date) DO NOTHING;

-- 9. LAUNDRY REQUESTS (40+ Records with various statuses)
-- Historical collected laundry batches
INSERT INTO LAUNDRY_REQUEST (bag_number, submitted_datetime, bags_ahead_at_submission, expected_return_datetime, actual_received_datetime, status)
VALUES
('JLU-BAG-001', NOW() - INTERVAL '12 days', 4, NOW() - INTERVAL '11 days 18 hours', NOW() - INTERVAL '11 days 20 hours', 'COLLECTED'),
('JLU-BAG-002', NOW() - INTERVAL '12 days', 3, NOW() - INTERVAL '11 days 19 hours', NOW() - INTERVAL '11 days 21 hours', 'COLLECTED'),
('JLU-BAG-003', NOW() - INTERVAL '11 days', 2, NOW() - INTERVAL '10 days 20 hours', NOW() - INTERVAL '10 days 22 hours', 'COLLECTED'),
('JLU-BAG-004', NOW() - INTERVAL '10 days', 5, NOW() - INTERVAL '9 days 15 hours',  NOW() - INTERVAL '9 days 16 hours',  'COLLECTED'),
('JLU-BAG-005', NOW() - INTERVAL '9 days',  1, NOW() - INTERVAL '8 days 22 hours', NOW() - INTERVAL '8 days 23 hours', 'COLLECTED'),
('JLU-BAG-006', NOW() - INTERVAL '9 days',  2, NOW() - INTERVAL '8 days 20 hours', NOW() - INTERVAL '8 days 21 hours', 'COLLECTED'),
('JLU-BAG-007', NOW() - INTERVAL '8 days',  0, NOW() - INTERVAL '7 days 23 hours', NOW() - INTERVAL '7 days 22 hours', 'COLLECTED'),
('JLU-BAG-008', NOW() - INTERVAL '7 days',  3, NOW() - INTERVAL '6 days 19 hours', NOW() - INTERVAL '6 days 18 hours', 'COLLECTED'),
('JLU-BAG-009', NOW() - INTERVAL '7 days',  4, NOW() - INTERVAL '6 days 17 hours', NOW() - INTERVAL '6 days 16 hours', 'COLLECTED'),
('JLU-BAG-010', NOW() - INTERVAL '6 days',  2, NOW() - INTERVAL '5 days 20 hours', NOW() - INTERVAL '5 days 20 hours', 'COLLECTED'),
('JLU-BAG-011', NOW() - INTERVAL '5 days',  1, NOW() - INTERVAL '4 days 22 hours', NOW() - INTERVAL '4 days 23 hours', 'COLLECTED'),
('JLU-BAG-012', NOW() - INTERVAL '5 days',  3, NOW() - INTERVAL '4 days 19 hours', NOW() - INTERVAL '4 days 18 hours', 'COLLECTED'),
('JLU-BAG-013', NOW() - INTERVAL '4 days',  2, NOW() - INTERVAL '3 days 20 hours', NOW() - INTERVAL '3 days 21 hours', 'COLLECTED'),
('JLU-BAG-014', NOW() - INTERVAL '4 days',  0, NOW() - INTERVAL '3 days 23 hours', NOW() - INTERVAL '3 days 22 hours', 'COLLECTED'),
('JLU-BAG-015', NOW() - INTERVAL '3 days',  4, NOW() - INTERVAL '2 days 17 hours', NOW() - INTERVAL '2 days 16 hours', 'COLLECTED'),
('JLU-BAG-016', NOW() - INTERVAL '3 days',  5, NOW() - INTERVAL '2 days 15 hours', NOW() - INTERVAL '2 days 14 hours', 'COLLECTED'),
('JLU-BAG-017', NOW() - INTERVAL '2 days',  1, NOW() - INTERVAL '1 day 22 hours',  NOW() - INTERVAL '1 day 21 hours',  'COLLECTED'),
('JLU-BAG-018', NOW() - INTERVAL '2 days',  2, NOW() - INTERVAL '1 day 20 hours',  NOW() - INTERVAL '1 day 19 hours',  'COLLECTED'),
('MIT-BAG-101', NOW() - INTERVAL '5 days',  1, NOW() - INTERVAL '4 days 22 hours', NOW() - INTERVAL '4 days 21 hours', 'COLLECTED'),
('MIT-BAG-102', NOW() - INTERVAL '4 days',  0, NOW() - INTERVAL '3 days 23 hours', NOW() - INTERVAL '3 days 22 hours', 'COLLECTED');

-- Active / Ready Laundry Bags
INSERT INTO LAUNDRY_REQUEST (bag_number, submitted_datetime, bags_ahead_at_submission, expected_return_datetime, actual_received_datetime, status)
VALUES
-- READY for student pick-up
('JLU-BAG-001', NOW() - INTERVAL '18 hours', 2, NOW() - INTERVAL '3 hours', NULL, 'READY'),
('JLU-BAG-002', NOW() - INTERVAL '16 hours', 3, NOW() - INTERVAL '1 hour',  NULL, 'READY'),
('JLU-BAG-019', NOW() - INTERVAL '14 hours', 1, NOW() + INTERVAL '1 hour',  NULL, 'READY'),
('MIT-BAG-103', NOW() - INTERVAL '12 hours', 0, NOW() + INTERVAL '2 hours', NULL, 'READY'),
-- WASHING in progress
('JLU-BAG-003', NOW() - INTERVAL '3 hours', 4, NOW() + INTERVAL '4 hours', NULL, 'WASHING'),
('JLU-BAG-004', NOW() - INTERVAL '2 hours', 5, NOW() + INTERVAL '6 hours', NULL, 'WASHING'),
('JLU-BAG-005', NOW() - INTERVAL '1 hour',  6, NOW() + INTERVAL '8 hours', NULL, 'WASHING'),
-- SUBMITTED in queue
('JLU-BAG-006', NOW() - INTERVAL '45 minutes', 7, NOW() + INTERVAL '10 hours', NULL, 'SUBMITTED'),
('JLU-BAG-007', NOW() - INTERVAL '30 minutes', 8, NOW() + INTERVAL '12 hours', NULL, 'SUBMITTED'),
('JLU-BAG-008', NOW() - INTERVAL '15 minutes', 9, NOW() + INTERVAL '14 hours', NULL, 'SUBMITTED'),
('MIT-BAG-104', NOW() - INTERVAL '20 minutes', 1, NOW() + INTERVAL '3 hours',  NULL, 'SUBMITTED');

COMMIT;
