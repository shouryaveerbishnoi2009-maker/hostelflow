-- HostelFlow: Analytical & Operational SQL Queries
-- Course: Database Management Systems - II Year Project
-- Author: Shouryaveer Bishnoi (2025BTECH111)

-- ============================================================================
-- QUERY 1: Automatic Exit-Time Derivation at QR Scan Time
-- Derives the expected exit time dynamically based on menu and meal parameters
-- Formula: Entry + expected_prep_time_minutes + avg_eating_time_minutes + buffer_time_minutes
-- ============================================================================
SELECT 
    s.student_id,
    s.name AS student_name,
    s.roll_no,
    mt.meal_name,
    mm.dish_name,
    mm.expected_prep_time_minutes,
    mt.avg_eating_time_minutes,
    mt.buffer_time_minutes,
    (mm.expected_prep_time_minutes + mt.avg_eating_time_minutes + mt.buffer_time_minutes) AS total_duration_minutes,
    time('now', 'localtime') AS entry_time,
    time('now', 'localtime', '+' || (mm.expected_prep_time_minutes + mt.avg_eating_time_minutes + mt.buffer_time_minutes) || ' minutes') AS derived_expected_exit_time
FROM STUDENT s
CROSS JOIN MEAL_TYPE mt
JOIN MESS_MENU mm ON mm.meal_id = mt.meal_id AND mm.day_of_week = strftime('%w', 'now')
WHERE s.roll_no = '2025BTECH111'
  AND mt.meal_name = 'Dinner';

-- ============================================================================
-- QUERY 2: 15-Minute Slot Historical Occupancy Analysis (30-Day Aggregation)
-- Groups visits into 15-minute buckets to calculate average crowd density
-- Used for finding "Quietest window" and "Busiest rush hour"
-- ============================================================================
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

-- ============================================================================
-- QUERY 3: Recommendation Engine (Quietest Slot vs Busiest Slot)
-- Identifies the slot with lowest historical count ("Best pick") and computes time saved
-- ============================================================================
WITH SlotAverages AS (
    SELECT 
        mt.meal_id,
        mt.meal_name,
        strftime('%H:%M', v.entry_timestamp) AS slot_time,
        COUNT(v.visit_id) AS slot_visit_count,
        ROW_NUMBER() OVER (PARTITION BY mt.meal_id ORDER BY COUNT(v.visit_id) ASC) AS rank_quietest,
        ROW_NUMBER() OVER (PARTITION BY mt.meal_id ORDER BY COUNT(v.visit_id) DESC) AS rank_busiest
    FROM MESS_VISIT v
    JOIN MEAL_TYPE mt ON v.meal_id = mt.meal_id
    WHERE v.visit_date >= date('now', '-30 days')
    GROUP BY mt.meal_id, mt.meal_name, (strftime('%M', v.entry_timestamp) / 15)
)
SELECT 
    q.meal_name,
    q.slot_time AS recommended_quiet_slot,
    q.slot_visit_count AS quiet_slot_traffic,
    b.slot_time AS peak_busy_slot,
    b.slot_visit_count AS peak_busy_traffic,
    (b.slot_visit_count - q.slot_visit_count) AS traffic_reduction
FROM SlotAverages q
JOIN SlotAverages b ON q.meal_id = b.meal_id
WHERE q.rank_quietest = 1 AND b.rank_busiest = 1;

-- ============================================================================
-- QUERY 4: Laundry Queue Snapshot & Expected Return Calculation
-- Count bags currently in SUBMITTED or WASHING to derive bags_ahead_at_submission
-- ============================================================================
SELECT 
    COUNT(*) AS bags_ahead,
    COALESCE(
        ROUND(AVG(
            (julianday(actual_received_datetime) - julianday(submitted_datetime)) * 24
        ), 1),
        36.0
    ) AS historical_avg_turnaround_hours
FROM LAUNDRY_REQUEST
WHERE status IN ('SUBMITTED', 'WASHING');

-- ============================================================================
-- QUERY 5: Dish Serving Speed Impact on Queue & Occupancy
-- Demonstrates how heavier dishes (e.g., Aloo Paratha) affect counter queue vs staples
-- ============================================================================
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

-- ============================================================================
-- QUERY 6: Admin Weekly Usage & Laundry Workload Summary (Objective 7)
-- ============================================================================
SELECT 
    (SELECT COUNT(*) FROM MESS_VISIT WHERE visit_date >= date('now', '-7 days')) AS mess_visits_this_week,
    (SELECT COUNT(*) FROM LAUNDRY_REQUEST WHERE status = 'SUBMITTED') AS laundry_bags_submitted,
    (SELECT COUNT(*) FROM LAUNDRY_REQUEST WHERE status = 'WASHING') AS laundry_bags_washing,
    (SELECT COUNT(*) FROM LAUNDRY_REQUEST WHERE status = 'READY') AS laundry_bags_ready,
    (SELECT ROUND(AVG((julianday(actual_received_datetime) - julianday(submitted_datetime)) * 24), 1) 
     FROM LAUNDRY_REQUEST WHERE status = 'RECEIVED') AS avg_turnaround_hours;

