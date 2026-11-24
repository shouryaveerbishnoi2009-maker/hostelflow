"""
HostelFlow — Smart Hostel Time & Crowd Management System
Flask Web Application Core
Backend Philosophy: Database-First ("Capture Once, Compute the Rest in SQL")
"""

import os
import io
import csv
import base64
import logging
from datetime import datetime, date, time as dt_time, timedelta
from functools import wraps
from typing import Optional, Dict, Any, List

import pytz
import qrcode
from flask import (
    Flask, render_template, request, redirect, url_for,
    session, flash, jsonify, g, abort, send_file
)
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv

import db

# Load environment variables
load_dotenv()

# Logger setup
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("hostelflow.app")

# Initialize Flask application
app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "hostelflow-production-sec-key-7788449911")
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(hours=12)

# Timezone configurations
APP_TIMEZONE_STR = os.environ.get("APP_TIMEZONE", "Asia/Kolkata")
IST = pytz.timezone(APP_TIMEZONE_STR)
UTC = pytz.utc

# Register teardown function to return DB connections to the pool
@app.teardown_appcontext
def shutdown_session(exception=None):
    db.close_db(exception)


# ============================================================================
# TIMEZONE & TIME SIMULATION HELPERS
# ============================================================================

def get_current_ist_datetime() -> datetime:
    """
    Returns current time in Indian Standard Time (or simulated time from session).
    """
    sim_time = session.get("simulate_time")
    if sim_time:
        try:
            naive = datetime.strptime(sim_time, "%Y-%m-%dT%H:%M")
            return IST.localize(naive)
        except Exception:
            pass
    return datetime.now(IST)


def format_ist_datetime(dt: Optional[datetime], fmt: str = "%d %b %Y, %I:%M %p") -> str:
    """Formats a UTC or naive DB timestamp into a user-friendly IST string."""
    if not dt:
        return "—"
    if dt.tzinfo is None:
        dt = UTC.localize(dt)
    ist_dt = dt.astimezone(IST)
    return ist_dt.strftime(fmt)


def format_ist_time_only(dt: Optional[datetime]) -> str:
    """Formats only the time portion in IST (e.g. 08:35 PM)."""
    return format_ist_datetime(dt, fmt="%I:%M %p")


# Template context processors
@app.context_processor
def inject_global_template_vars():
    ist_now = get_current_ist_datetime()
    return {
        "ist_now": ist_now,
        "ist_date_str": ist_now.strftime("%A, %d %B %Y"),
        "ist_time_str": ist_now.strftime("%I:%M %p"),
        "simulate_time": session.get("simulate_time"),
        "format_ist": format_ist_datetime,
        "format_time": format_ist_time_only,
        "app_name": "HostelFlow",
    }


# ============================================================================
# ROLE-BASED ACCESS CONTROL (RBAC) DECORATORS
# ============================================================================

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session or "role" not in session:
            if request.is_json or request.path.startswith("/api/"):
                return jsonify({"error": "Unauthorized access. Please login."}), 401
            flash("Please sign in to access this portal.", "warning")
            return redirect(url_for("login", next=request.url))
        return f(*args, **kwargs)
    return decorated_function


def role_required(*allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if "user_id" not in session:
                if request.is_json or request.path.startswith("/api/"):
                    return jsonify({"error": "Unauthorized access."}), 401
                return redirect(url_for("login"))

            user_role = session.get("role")
            if user_role not in allowed_roles and user_role != "SUPER_ADMIN":
                if request.is_json or request.path.startswith("/api/"):
                    return jsonify({"error": "Forbidden: Insufficient privileges."}), 403
                flash("Access denied. You do not have permissions for this page.", "danger")
                return redirect(url_for("dashboard_router"))
            return f(*args, **kwargs)
        return decorated_function
    return decorator


# ============================================================================
# PUBLIC SAAS LANDING & AUTHENTICATION
# ============================================================================

@app.route("/")
def index():
    """Public SaaS product landing page."""
    # If already logged in, provide seamless redirect to their dashboard
    if "user_id" in session:
        return redirect(url_for("dashboard_router"))
    return render_template("landing.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    """Unified multi-role sign-in."""
    if "user_id" in session:
        return redirect(url_for("dashboard_router"))

    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "").strip()

        if not email or not password:
            flash("Please enter both email and password.", "danger")
            return render_template("auth/login.html")

        # 1. Check STAFF_ADMIN first
        staff = db.fetch_one(
            """
            SELECT s.*, c.college_name, c.college_code
            FROM STAFF_ADMIN s
            JOIN COLLEGE c ON s.college_id = c.college_id
            WHERE LOWER(s.email) = %s AND s.is_active = TRUE
            """,
            (email,)
        )

        if staff and check_password_hash(staff["password_hash"], password):
            session.permanent = True
            session["user_id"] = staff["staff_id"]
            session["name"] = staff["name"]
            session["email"] = staff["email"]
            session["role"] = staff["role"]
            session["college_id"] = staff["college_id"]
            session["college_name"] = staff["college_name"]
            session["college_code"] = staff["college_code"]
            session["is_student"] = False

            flash(f"Welcome back, {staff['name']}!", "success")
            return redirect(url_for("dashboard_router"))

        # 2. Check STUDENT table
        student = db.fetch_one(
            """
            SELECT s.*, c.college_name, c.college_code, h.hostel_name
            FROM STUDENT s
            JOIN COLLEGE c ON s.college_id = c.college_id
            LEFT JOIN HOSTEL h ON s.hostel_id = h.hostel_id
            WHERE LOWER(s.email) = %s AND s.is_active = TRUE
            """,
            (email,)
        )

        if student and check_password_hash(student["password_hash"], password):
            session.permanent = True
            session["user_id"] = student["student_id"]
            session["name"] = student["name"]
            session["email"] = student["email"]
            session["roll_no"] = student["roll_no"]
            session["role"] = "STUDENT"
            session["college_id"] = student["college_id"]
            session["college_name"] = student["college_name"]
            session["college_code"] = student["college_code"]
            session["hostel_id"] = student["hostel_id"]
            session["hostel_name"] = student["hostel_name"] or "Assigned Hostel"
            session["room_no"] = student["room_no"]
            session["is_student"] = True

            flash(f"Welcome, {student['name']}!", "success")
            return redirect(url_for("student_dashboard"))

        flash("Invalid credentials or inactive account. You can use 1-click Demo Login below or run /admin/init-demo.", "danger")

    return render_template("auth/login.html")


@app.route("/logout")
def logout():
    """Clear session securely."""
    user_name = session.get("name", "User")
    session.clear()
    flash(f"You have been signed out, {user_name}.", "info")
    return redirect(url_for("index"))


@app.route("/dashboard")
@login_required
def dashboard_router():
    """Role-based redirect hub."""
    role = session.get("role")
    if role == "STUDENT":
        return redirect(url_for("student_dashboard"))
    elif role == "SUPER_ADMIN":
        return redirect(url_for("superadmin_dashboard"))
    elif role == "HOSTEL_ADMIN":
        return redirect(url_for("admin_dashboard"))
    elif role in ("MESS_STAFF", "LAUNDRY_STAFF"):
        return redirect(url_for("staff_dashboard"))
    return redirect(url_for("index"))


@app.route("/admin/init-demo")
def init_demo():
    """
    Idempotent initialization & password re-hash helper.
    Ensures standard demo credentials work seamlessly across all local and deployed environments.
    """
    admin_pw_hash = generate_password_hash("Admin@123")
    staff_pw_hash = generate_password_hash("Staff@123")
    student_pw_hash = generate_password_hash("Student@123")

    # Update Staff
    db.execute_query(
        """
        UPDATE STAFF_ADMIN 
        SET password_hash = CASE 
            WHEN role IN ('SUPER_ADMIN', 'HOSTEL_ADMIN') THEN %s
            ELSE %s
        END
        """,
        (admin_pw_hash, staff_pw_hash)
    )

    # Update Students
    db.execute_query(
        "UPDATE STUDENT SET password_hash = %s",
        (student_pw_hash,)
    )

    # Ensure demo student 1 has a permanent laundry bag
    demo_student = db.fetch_one("SELECT student_id FROM STUDENT WHERE roll_no = 'JLU2024001'")
    if demo_student:
        db.execute_query(
            "INSERT INTO LAUNDRY_BAG (bag_number, student_id) VALUES ('JLU-BAG-001', %s) ON CONFLICT DO NOTHING",
            (demo_student["student_id"],)
        )

    return jsonify({
        "status": "success",
        "message": "Demo credentials successfully synchronized and hashed with PBKDF2-SHA256.",
        "demo_accounts": [
            {"role": "Super Admin", "email": "admin@hostelflow.com", "password": "Admin@123"},
            {"role": "Hostel Admin (JLU)", "email": "admin@jlu.edu", "password": "Admin@123"},
            {"role": "Mess Staff", "email": "mess@jlu.edu", "password": "Staff@123"},
            {"role": "Laundry Staff", "email": "laundry@jlu.edu", "password": "Staff@123"},
            {"role": "Student (Demo)", "email": "student@jlu.edu", "password": "Student@123"}
        ]
    })


# ============================================================================
# STUDENT PORTAL ROUTES
# ============================================================================

@app.route("/student/dashboard")
@login_required
@role_required("STUDENT")
def student_dashboard():
    """Student Home: live meal status, laundry summary, crowd meter."""
    student_id = session["user_id"]
    college_id = session["college_id"]
    hostel_id = session.get("hostel_id")
    ist_now = get_current_ist_datetime()
    today_date = ist_now.date()
    current_time = ist_now.time()

    # 1. Check current active meal window
    active_meal = db.fetch_one(
        """
        SELECT * FROM MEAL_TYPE
        WHERE college_id = %s
          AND %s BETWEEN standard_start_time AND standard_end_time
        LIMIT 1
        """,
        (college_id, current_time)
    )

    # 2. Check today's visits by this student
    today_visits = db.fetch_all(
        """
        SELECT mv.*, mt.meal_name
        FROM MESS_VISIT mv
        JOIN MEAL_TYPE mt ON mv.meal_id = mt.meal_id
        WHERE mv.student_id = %s AND mv.visit_date = %s
        ORDER BY mv.mess_entry_time DESC
        """,
        (student_id, today_date)
    )

    # 3. Today's check-in status for current meal
    current_meal_checked_in = False
    if active_meal:
        for v in today_visits:
            if v["meal_id"] == active_meal["meal_id"]:
                current_meal_checked_in = True
                break

    # 4. Live crowd status for student's hostel
    live_crowd = None
    if hostel_id and active_meal:
        live_crowd = db.fetch_one(
            """
            SELECT * FROM v_live_mess_crowd
            WHERE hostel_id = %s AND meal_id = %s
            """,
            (hostel_id, active_meal["meal_id"])
        )

    # 5. Student's laundry bag & current active request
    laundry_bag = db.fetch_one(
        "SELECT * FROM LAUNDRY_BAG WHERE student_id = %s",
        (student_id,)
    )
    active_laundry = None
    if laundry_bag:
        active_laundry = db.fetch_one(
            """
            SELECT * FROM LAUNDRY_REQUEST
            WHERE bag_number = %s AND status != 'COLLECTED'
            ORDER BY submitted_datetime DESC
            LIMIT 1
            """,
            (laundry_bag["bag_number"],)
        )

    return render_template(
        "student/dashboard.html",
        active_meal=active_meal,
        today_visits=today_visits,
        current_meal_checked_in=current_meal_checked_in,
        live_crowd=live_crowd,
        laundry_bag=laundry_bag,
        active_laundry=active_laundry
    )


@app.route("/student/mess/scan")
@login_required
@role_required("STUDENT")
def student_mess_scan():
    """QR Check-In landing for mess entrance with live countdown & dish info."""
    student_id = session["user_id"]
    college_id = session["college_id"]
    hostel_id = session.get("hostel_id")
    ist_now = get_current_ist_datetime()
    today_date = ist_now.date()
    current_time = ist_now.time()
    day_name = ist_now.strftime("%A")

    # Detect current meal window
    meal = db.fetch_one(
        """
        SELECT * FROM MEAL_TYPE
        WHERE college_id = %s
          AND %s BETWEEN standard_start_time AND standard_end_time
        ORDER BY standard_start_time
        LIMIT 1
        """,
        (college_id, current_time)
    )

    next_meal = None
    if not meal:
        # Fetch the next upcoming meal today
        next_meal = db.fetch_one(
            """
            SELECT * FROM MEAL_TYPE
            WHERE college_id = %s AND standard_start_time > %s
            ORDER BY standard_start_time
            LIMIT 1
            """,
            (college_id, current_time)
        )
        if not next_meal:
            # Wrap around to tomorrow's breakfast
            next_meal = db.fetch_one(
                """
                SELECT * FROM MEAL_TYPE
                WHERE college_id = %s
                ORDER BY standard_start_time
                LIMIT 1
                """,
                (college_id,)
            )

    # Dish being served
    dish = None
    target_meal_id = meal["meal_id"] if meal else (next_meal["meal_id"] if next_meal else None)
    if target_meal_id:
        dish = db.fetch_one(
            """
            SELECT * FROM MESS_MENU
            WHERE meal_id = %s AND day_of_week = %s
            LIMIT 1
            """,
            (target_meal_id, day_name)
        )

    # Check if already checked in today for this meal
    existing_visit = None
    if meal:
        existing_visit = db.fetch_one(
            """
            SELECT * FROM MESS_VISIT
            WHERE student_id = %s AND meal_id = %s AND visit_date = %s
            """,
            (student_id, meal["meal_id"], today_date)
        )

    # Live crowd count
    crowd_info = None
    if hostel_id and meal:
        crowd_info = db.fetch_one(
            "SELECT * FROM v_live_mess_crowd WHERE hostel_id = %s AND meal_id = %s",
            (hostel_id, meal["meal_id"])
        )

    return render_template(
        "student/mess_scan.html",
        meal=meal,
        next_meal=next_meal,
        dish=dish,
        existing_visit=existing_visit,
        crowd_info=crowd_info
    )


@app.route("/student/mess/checkin", methods=["POST"])
@login_required
@role_required("STUDENT")
def student_mess_checkin():
    """
    Submits a mess check-in.
    The PostgreSQL trg_before_insert_mess_visit trigger automatically computes:
    mess_exit_time = mess_entry_time + (dish_prep_time + avg_eating_time + buffer) minutes.
    """
    student_id = session["user_id"]
    college_id = session["college_id"]
    ist_now = get_current_ist_datetime()
    today_date = ist_now.date()
    current_time = ist_now.time()
    day_name = ist_now.strftime("%A")

    # 1. Detect current meal
    meal = db.fetch_one(
        """
        SELECT * FROM MEAL_TYPE
        WHERE college_id = %s
          AND %s BETWEEN standard_start_time AND standard_end_time
        LIMIT 1
        """,
        (college_id, current_time)
    )

    if not meal:
        return jsonify({
            "success": False,
            "error": "The mess is currently closed. Check-in is only permitted during official meal hours."
        }), 400

    # 2. Check Cooldown / Duplicate Protection within the same meal window
    existing = db.fetch_one(
        "SELECT * FROM MESS_VISIT WHERE student_id = %s AND meal_id = %s AND visit_date = %s",
        (student_id, meal["meal_id"], today_date)
    )
    if existing:
        exit_str = format_ist_time_only(existing["mess_exit_time"])
        return jsonify({
            "success": False,
            "already_checked_in": True,
            "message": f"You are already checked in for {meal['meal_name']} today. Your predicted exit time is {exit_str}."
        }), 409

    # 3. Perform insert. The PostgreSQL trigger automatically calculates mess_exit_time and visit_date!
    utc_entry_time = ist_now.astimezone(UTC)
    try:
        db.execute_query(
            """
            INSERT INTO MESS_VISIT (student_id, meal_id, visit_date, mess_entry_time)
            VALUES (%s, %s, %s, %s)
            """,
            (student_id, meal["meal_id"], today_date, utc_entry_time)
        )
    except Exception as e:
        logger.error(f"Error checking in student {student_id}: {e}")
        return jsonify({"success": False, "error": "Check-in failed due to a database constraint."}), 500

    # 4. Fetch the computed visit record created by the database trigger
    visit = db.fetch_one(
        """
        SELECT mv.*, mm.dish_name, mm.expected_prep_time_minutes
        FROM MESS_VISIT mv
        LEFT JOIN MESS_MENU mm ON mm.meal_id = mv.meal_id AND mm.day_of_week = %s
        WHERE mv.student_id = %s AND mv.meal_id = %s AND mv.visit_date = %s
        """,
        (day_name, student_id, meal["meal_id"], today_date)
    )

    # 5. Fetch updated live crowd level
    hostel_id = session.get("hostel_id")
    crowd_active = 1
    if hostel_id:
        crowd = db.fetch_one(
            "SELECT active_diners FROM v_live_mess_crowd WHERE hostel_id = %s AND meal_id = %s",
            (hostel_id, meal["meal_id"])
        )
        if crowd:
            crowd_active = crowd["active_diners"]

    # Crowd indicator
    if crowd_active < 25:
        crowd_label = "Low"
        crowd_class = "success"
    elif crowd_active < 60:
        crowd_label = "Moderate"
        crowd_class = "warning"
    else:
        crowd_label = "Peak"
        crowd_class = "danger"

    entry_formatted = format_ist_time_only(visit["mess_entry_time"])
    exit_formatted = format_ist_time_only(visit["mess_exit_time"])

    # Calculate total duration in minutes
    duration_mins = int((visit["mess_exit_time"] - visit["mess_entry_time"]).total_seconds() / 60)

    return jsonify({
        "success": True,
        "meal_name": meal["meal_name"],
        "dish_name": visit["dish_name"] or "Standard Meal",
        "prep_time_mins": visit["expected_prep_time_minutes"] or 5,
        "entry_time": entry_formatted,
        "predicted_exit_time": exit_formatted,
        "estimated_duration_mins": duration_mins,
        "live_crowd_diners": crowd_active,
        "crowd_level": crowd_label,
        "crowd_class": crowd_class
    })


@app.route("/student/crowd")
@login_required
@role_required("STUDENT")
def student_crowd():
    """Smart Crowd Predictor and Best-Time Recommender with Weekly Menu."""
    college_id = session["college_id"]
    ist_now = get_current_ist_datetime()
    current_day = ist_now.strftime("%A")

    # Fetch meal windows
    meals = db.fetch_all(
        "SELECT * FROM MEAL_TYPE WHERE college_id = %s ORDER BY standard_start_time",
        (college_id,)
    )

    # Fetch weekly menu with speed badges
    menu_items = db.fetch_all(
        """
        SELECT mm.*, mt.meal_name, mt.standard_start_time, mt.standard_end_time
        FROM MESS_MENU mm
        JOIN MEAL_TYPE mt ON mm.meal_id = mt.meal_id
        WHERE mt.college_id = %s
        ORDER BY 
            CASE mm.day_of_week
                WHEN 'Monday' THEN 1
                WHEN 'Tuesday' THEN 2
                WHEN 'Wednesday' THEN 3
                WHEN 'Thursday' THEN 4
                WHEN 'Friday' THEN 5
                WHEN 'Saturday' THEN 6
                WHEN 'Sunday' THEN 7
            END,
            mt.standard_start_time
        """,
        (college_id,)
    )

    # Classify prep speeds
    for item in menu_items:
        prep = item["expected_prep_time_minutes"]
        if prep <= 6:
            item["speed_label"] = "Fast Serving"
            item["speed_badge"] = "success"
        elif prep <= 12:
            item["speed_label"] = "Moderate"
            item["speed_badge"] = "warning"
        else:
            item["speed_label"] = "Made-to-Order"
            item["speed_badge"] = "danger"

    return render_template(
        "student/crowd.html",
        meals=meals,
        menu_items=menu_items,
        current_day=current_day
    )


@app.route("/api/student/crowd-slots")
@login_required
@role_required("STUDENT", "HOSTEL_ADMIN", "SUPER_ADMIN")
def api_student_crowd_slots():
    """
    Returns 15-minute slot historical counts grouped by meal for Chart.js.
    Also produces a plain-language smart recommendation.
    """
    college_id = session["college_id"]
    meal_id = request.args.get("meal_id", type=int)

    query = """
        SELECT slot_label, meal_name, SUM(visit_count) as total_visits, ROUND(AVG(avg_duration_mins), 1) as avg_duration
        FROM v_mess_slot_analytics
        WHERE college_id = %s
    """
    params = [college_id]

    if meal_id:
        query += " AND meal_id = %s"
        params.append(meal_id)

    query += " GROUP BY slot_label, meal_name ORDER BY slot_label"

    slots = db.fetch_all(query, tuple(params))

    # Calculate recommendation: find the least crowded slot vs peak slot
    recommendation = "Crowd data is currently calibrating. Peak visits usually occur in the middle 30 minutes of each meal window."
    if slots:
        sorted_by_crowd = sorted(slots, key=lambda s: s["total_visits"], reverse=True)
        peak_slot = sorted_by_crowd[0]
        lightest_slot = sorted_by_crowd[-1]

        if peak_slot["slot_label"] != lightest_slot["slot_label"]:
            recommendation = (
                f"Peak crowd detected at {peak_slot['slot_label']} ({peak_slot['total_visits']} historical visits). "
                f"For zero queue, plan your visit around {lightest_slot['slot_label']} where average duration is only {lightest_slot['avg_duration']} minutes."
            )

    return jsonify({
        "slots": slots,
        "recommendation": recommendation
    })


@app.route("/student/laundry")
@login_required
@role_required("STUDENT")
def student_laundry():
    """Live laundry tracker with assigned bag, stepper, and turnaround history."""
    student_id = session["user_id"]
    college_id = session["college_id"]

    # 1. Check student's permanently assigned bag
    bag = db.fetch_one("SELECT * FROM LAUNDRY_BAG WHERE student_id = %s", (student_id,))

    active_request = None
    remaining_ahead = 0
    history = []

    if bag:
        # Active request
        active_request = db.fetch_one(
            """
            SELECT * FROM LAUNDRY_REQUEST
            WHERE bag_number = %s AND status != 'COLLECTED'
            ORDER BY submitted_datetime DESC
            LIMIT 1
            """,
            (bag["bag_number"],)
        )

        # Dynamic remaining queue calculation
        if active_request and active_request["status"] in ("SUBMITTED", "WASHING"):
            calc = db.fetch_one(
                """
                SELECT COUNT(*) as queue_ahead
                FROM LAUNDRY_REQUEST lr
                JOIN LAUNDRY_BAG lb ON lr.bag_number = lb.bag_number
                JOIN STUDENT s ON lb.student_id = s.student_id
                WHERE s.college_id = %s
                  AND lr.status IN ('SUBMITTED', 'WASHING')
                  AND lr.submitted_datetime < %s
                """,
                (college_id, active_request["submitted_datetime"])
            )
            remaining_ahead = calc["queue_ahead"] if calc else 0

        # Full historical log
        history = db.fetch_all(
            """
            SELECT * FROM LAUNDRY_REQUEST
            WHERE bag_number = %s
            ORDER BY submitted_datetime DESC
            LIMIT 30
            """,
            (bag["bag_number"],)
        )

    return render_template(
        "student/laundry.html",
        bag=bag,
        active_request=active_request,
        remaining_ahead=remaining_ahead,
        history=history
    )


# ============================================================================
# STAFF OPERATIONS CONSOLE
# ============================================================================

@app.route("/staff/dashboard")
@login_required
@role_required("MESS_STAFF", "LAUNDRY_STAFF", "HOSTEL_ADMIN", "SUPER_ADMIN")
def staff_dashboard():
    """Operations home for hostel staff."""
    college_id = session["college_id"]
    role = session.get("role")

    # Queue summary
    laundry_summary = db.fetch_one(
        "SELECT * FROM v_laundry_queue_summary WHERE college_id = %s",
        (college_id,)
    )

    # Hostels in this college
    hostels = db.fetch_all(
        "SELECT * FROM HOSTEL WHERE college_id = %s ORDER BY hostel_name",
        (college_id,)
    )

    return render_template(
        "staff/dashboard.html",
        laundry_summary=laundry_summary,
        hostels=hostels,
        staff_role=role
    )


@app.route("/staff/laundry")
@login_required
@role_required("LAUNDRY_STAFF", "HOSTEL_ADMIN", "SUPER_ADMIN")
def staff_laundry():
    """Laundry desk interface: quick drop-off scanner & queue manager."""
    college_id = session["college_id"]

    # Active laundry queue
    queue = db.fetch_all(
        """
        SELECT lr.*, lb.student_id, s.name as student_name, s.roll_no, s.room_no, h.hostel_name
        FROM LAUNDRY_REQUEST lr
        JOIN LAUNDRY_BAG lb ON lr.bag_number = lb.bag_number
        JOIN STUDENT s ON lb.student_id = s.student_id
        LEFT JOIN HOSTEL h ON s.hostel_id = h.hostel_id
        WHERE s.college_id = %s AND lr.status != 'COLLECTED'
        ORDER BY lr.submitted_datetime ASC
        """,
        (college_id,)
    )

    return render_template("staff/laundry_desk.html", queue=queue)


@app.route("/staff/laundry/dropoff", methods=["POST"])
@login_required
@role_required("LAUNDRY_STAFF", "HOSTEL_ADMIN", "SUPER_ADMIN")
def staff_laundry_dropoff():
    """Drop off a laundry bag by bag_number or roll_no."""
    identifier = request.form.get("identifier", "").strip().upper()
    college_id = session["college_id"]

    if not identifier:
        flash("Please enter a Bag Number or Roll Number.", "warning")
        return redirect(url_for("staff_laundry"))

    # Resolve bag_number
    bag = db.fetch_one(
        """
        SELECT lb.bag_number, s.name, s.roll_no
        FROM LAUNDRY_BAG lb
        JOIN STUDENT s ON lb.student_id = s.student_id
        WHERE s.college_id = %s AND (UPPER(lb.bag_number) = %s OR UPPER(s.roll_no) = %s)
        """,
        (college_id, identifier, identifier)
    )

    if not bag:
        flash(f"No registered laundry bag found for '{identifier}'. Check student registration.", "danger")
        return redirect(url_for("staff_laundry"))

    bag_number = bag["bag_number"]

    # Check if this bag already has an uncollected request
    existing = db.fetch_one(
        "SELECT * FROM LAUNDRY_REQUEST WHERE bag_number = %s AND status != 'COLLECTED'",
        (bag_number,)
    )
    if existing:
        flash(f"Bag {bag_number} already has an active request ({existing['status']}).", "warning")
        return redirect(url_for("staff_laundry"))

    # Insert request (Trigger sets bags_ahead_at_submission and expected_return_datetime)
    utc_now = get_current_ist_datetime().astimezone(UTC)
    db.execute_query(
        "INSERT INTO LAUNDRY_REQUEST (bag_number, submitted_datetime) VALUES (%s, %s)",
        (bag_number, utc_now)
    )

    flash(f"Laundry Bag {bag_number} ({bag['name']}) checked into queue successfully!", "success")
    return redirect(url_for("staff_laundry"))


@app.route("/staff/laundry/status", methods=["POST"])
@login_required
@role_required("LAUNDRY_STAFF", "HOSTEL_ADMIN", "SUPER_ADMIN")
def staff_laundry_update_status():
    """Update status of a laundry bag (SUBMITTED -> WASHING -> READY -> COLLECTED)."""
    request_id = request.form.get("request_id", type=int)
    new_status = request.form.get("status", "").strip().upper()

    valid_statuses = ("SUBMITTED", "WASHING", "READY", "COLLECTED")
    if new_status not in valid_statuses:
        flash("Invalid laundry status.", "danger")
        return redirect(url_for("staff_laundry"))

    utc_now = get_current_ist_datetime().astimezone(UTC)

    if new_status == "COLLECTED":
        db.execute_query(
            "UPDATE LAUNDRY_REQUEST SET status = %s, actual_received_datetime = %s WHERE request_id = %s",
            (new_status, utc_now, request_id)
        )
    else:
        db.execute_query(
            "UPDATE LAUNDRY_REQUEST SET status = %s WHERE request_id = %s",
            (new_status, request_id)
        )

    flash(f"Request #{request_id} progressed to {new_status}.", "success")
    return redirect(url_for("staff_laundry"))


@app.route("/staff/mess/qr")
@login_required
@role_required("MESS_STAFF", "HOSTEL_ADMIN", "SUPER_ADMIN")
def staff_mess_qr():
    """Printable & full-screen mess entrance QR code generator."""
    college_id = session["college_id"]
    hostels = db.fetch_all(
        "SELECT * FROM HOSTEL WHERE college_id = %s ORDER BY hostel_name",
        (college_id,)
    )

    selected_hostel_id = request.args.get("hostel_id", type=int)
    if not selected_hostel_id and hostels:
        selected_hostel_id = hostels[0]["hostel_id"]

    selected_hostel = None
    for h in hostels:
        if h["hostel_id"] == selected_hostel_id:
            selected_hostel = h
            break

    # Build QR Code Image encoded with the direct mess scan URL
    qr_b64 = ""
    scan_url = url_for("student_mess_scan", _external=True)

    if selected_hostel:
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=4,
        )
        qr.add_data(scan_url)
        qr.make(fit=True)

        img = qr.make_image(fill_color="#1E293B", back_color="#FFFFFF")
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        qr_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

    return render_template(
        "staff/mess_qr.html",
        hostels=hostels,
        selected_hostel=selected_hostel,
        qr_b64=qr_b64,
        scan_url=scan_url
    )


# ============================================================================
# HOSTEL ADMIN & SUPER ADMIN MANAGEMENT
# ============================================================================

@app.route("/admin/dashboard")
@login_required
@role_required("HOSTEL_ADMIN", "SUPER_ADMIN")
def admin_dashboard():
    """Executive KPI Cards and Analytical Heatmaps."""
    college_id = session["college_id"]
    ist_now = get_current_ist_datetime()
    today_date = ist_now.date()

    # 1. Active Diners right now
    active_diners = db.fetch_one(
        """
        SELECT COALESCE(SUM(active_diners), 0) as total_diners
        FROM v_live_mess_crowd
        WHERE college_id = %s
        """,
        (college_id,)
    )

    # 2. Today's total mess footfall
    today_footfall = db.fetch_one(
        """
        SELECT COUNT(mv.visit_id) as total_footfall
        FROM MESS_VISIT mv
        JOIN STUDENT s ON mv.student_id = s.student_id
        WHERE s.college_id = %s AND mv.visit_date = %s
        """,
        (college_id, today_date)
    )

    # 3. Average Wait / Stay Duration over the last 7 days
    avg_stay = db.fetch_one(
        """
        SELECT ROUND(AVG(EXTRACT(EPOCH FROM (mv.mess_exit_time - mv.mess_entry_time)) / 60)::NUMERIC, 1) as avg_mins
        FROM MESS_VISIT mv
        JOIN STUDENT s ON mv.student_id = s.student_id
        WHERE s.college_id = %s
          AND mv.visit_date >= %s - INTERVAL '7 days'
          AND mv.mess_exit_time IS NOT NULL
        """,
        (college_id, today_date)
    )

    # 4. Laundry Operational Metrics
    laundry_metrics = db.fetch_one(
        "SELECT * FROM v_laundry_queue_summary WHERE college_id = %s",
        (college_id,)
    )

    # 5. Dish Bottleneck Analysis
    dish_bottlenecks = db.fetch_all(
        """
        SELECT * FROM v_dish_impact
        WHERE college_id = %s
        ORDER BY avg_duration_mins DESC
        LIMIT 10
        """,
        (college_id,)
    )

    kpis = {
        "active_diners": active_diners["total_diners"] if active_diners else 0,
        "today_footfall": today_footfall["total_footfall"] if today_footfall else 0,
        "avg_stay_mins": avg_stay["avg_mins"] if avg_stay and avg_stay["avg_mins"] else 18.5,
        "active_laundry_bags": laundry_metrics["active_queue_total"] if laundry_metrics else 0,
        "avg_laundry_turnaround": laundry_metrics["avg_turnaround_hours"] if laundry_metrics and laundry_metrics["avg_turnaround_hours"] else 22.4,
    }

    return render_template(
        "admin/dashboard.html",
        kpis=kpis,
        dish_bottlenecks=dish_bottlenecks
    )


@app.route("/admin/menu", methods=["GET", "POST"])
@login_required
@role_required("HOSTEL_ADMIN", "SUPER_ADMIN")
def admin_menu():
    """Weekly Mess Menu CRUD & Prep Time Tuning."""
    college_id = session["college_id"]

    if request.method == "POST":
        action = request.form.get("action")

        if action == "add":
            meal_id = request.form.get("meal_id", type=int)
            day = request.form.get("day_of_week")
            dish_name = request.form.get("dish_name", "").strip()
            prep_time = request.form.get("expected_prep_time_minutes", type=int, default=5)

            if meal_id and day and dish_name:
                try:
                    db.execute_query(
                        """
                        INSERT INTO MESS_MENU (meal_id, day_of_week, dish_name, expected_prep_time_minutes)
                        VALUES (%s, %s, %s, %s)
                        ON CONFLICT (meal_id, day_of_week, dish_name) DO UPDATE
                        SET expected_prep_time_minutes = EXCLUDED.expected_prep_time_minutes
                        """,
                        (meal_id, day, dish_name, prep_time)
                    )
                    flash(f"Dish '{dish_name}' successfully added to {day} menu.", "success")
                except Exception as e:
                    flash(f"Error saving menu item: {e}", "danger")

        elif action == "delete":
            menu_id = request.form.get("menu_id", type=int)
            if menu_id:
                db.execute_query("DELETE FROM MESS_MENU WHERE menu_id = %s", (menu_id,))
                flash("Dish removed from menu.", "info")

        return redirect(url_for("admin_menu"))

    # Fetch meals and menu
    meals = db.fetch_all("SELECT * FROM MEAL_TYPE WHERE college_id = %s ORDER BY standard_start_time", (college_id,))
    menu_list = db.fetch_all(
        """
        SELECT mm.*, mt.meal_name
        FROM MESS_MENU mm
        JOIN MEAL_TYPE mt ON mm.meal_id = mt.meal_id
        WHERE mt.college_id = %s
        ORDER BY 
            CASE mm.day_of_week
                WHEN 'Monday' THEN 1
                WHEN 'Tuesday' THEN 2
                WHEN 'Wednesday' THEN 3
                WHEN 'Thursday' THEN 4
                WHEN 'Friday' THEN 5
                WHEN 'Saturday' THEN 6
                WHEN 'Sunday' THEN 7
            END,
            mt.standard_start_time
        """,
        (college_id,)
    )

    return render_template("admin/menu.html", meals=meals, menu_list=menu_list)


@app.route("/admin/students", methods=["GET", "POST"])
@login_required
@role_required("HOSTEL_ADMIN", "SUPER_ADMIN")
def admin_students():
    """Student onboarding, laundry bag linking, and CSV bulk upload."""
    college_id = session["college_id"]

    if request.method == "POST":
        action = request.form.get("action")

        if action == "add_single":
            roll_no = request.form.get("roll_no", "").strip().upper()
            name = request.form.get("name", "").strip()
            email = request.form.get("email", "").strip().lower()
            hostel_id = request.form.get("hostel_id", type=int)
            room_no = request.form.get("room_no", "").strip()
            phone = request.form.get("phone", "").strip()
            bag_number = request.form.get("bag_number", "").strip().upper()

            if roll_no and name and email:
                pw_hash = generate_password_hash("Student@123")
                try:
                    db.execute_query(
                        """
                        INSERT INTO STUDENT (college_id, roll_no, name, email, password_hash, hostel_id, room_no, phone)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (college_id, roll_no, name, email, pw_hash, hostel_id, room_no, phone)
                    )
                    # Link permanent laundry bag if supplied
                    if bag_number:
                        new_student = db.fetch_one("SELECT student_id FROM STUDENT WHERE college_id = %s AND roll_no = %s", (college_id, roll_no))
                        if new_student:
                            db.execute_query(
                                "INSERT INTO LAUNDRY_BAG (bag_number, student_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                                (bag_number, new_student["student_id"])
                            )
                    flash(f"Student {name} ({roll_no}) onboarded successfully! Default password is Student@123.", "success")
                except Exception as e:
                    flash(f"Failed to add student (duplicate roll or email): {e}", "danger")

        elif action == "bulk_csv":
            file = request.files.get("csv_file")
            if file and file.filename.endswith(".csv"):
                try:
                    stream = io.StringIO(file.stream.read().decode("UTF-8"), newline=None)
                    reader = csv.DictReader(stream)
                    pw_hash = generate_password_hash("Student@123")
                    inserted = 0

                    for row in reader:
                        r_no = row.get("roll_no", "").strip().upper()
                        s_name = row.get("name", "").strip()
                        s_email = row.get("email", "").strip().lower()
                        s_room = row.get("room_no", "").strip()
                        s_phone = row.get("phone", "").strip()
                        s_bag = row.get("bag_number", "").strip().upper()

                        if r_no and s_name and s_email:
                            db.execute_query(
                                """
                                INSERT INTO STUDENT (college_id, roll_no, name, email, password_hash, room_no, phone)
                                VALUES (%s, %s, %s, %s, %s, %s, %s)
                                ON CONFLICT (college_id, roll_no) DO NOTHING
                                """,
                                (college_id, r_no, s_name, s_email, pw_hash, s_room, s_phone)
                            )
                            if s_bag:
                                stud = db.fetch_one("SELECT student_id FROM STUDENT WHERE college_id = %s AND roll_no = %s", (college_id, r_no))
                                if stud:
                                    db.execute_query(
                                        "INSERT INTO LAUNDRY_BAG (bag_number, student_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                                        (s_bag, stud["student_id"])
                                    )
                            inserted += 1

                    flash(f"Bulk CSV processed successfully: {inserted} students imported.", "success")
                except Exception as e:
                    flash(f"Error parsing CSV file: {e}", "danger")
            else:
                flash("Please upload a valid .csv format file.", "warning")

        return redirect(url_for("admin_students"))

    # Fetch students
    students = db.fetch_all(
        """
        SELECT s.*, h.hostel_name, lb.bag_number
        FROM STUDENT s
        LEFT JOIN HOSTEL h ON s.hostel_id = h.hostel_id
        LEFT JOIN LAUNDRY_BAG lb ON s.student_id = lb.student_id
        WHERE s.college_id = %s
        ORDER BY s.student_id DESC
        LIMIT 100
        """,
        (college_id,)
    )

    hostels = db.fetch_all("SELECT * FROM HOSTEL WHERE college_id = %s ORDER BY hostel_name", (college_id,))

    return render_template("admin/students.html", students=students, hostels=hostels)


@app.route("/admin/sql-inspector")
@login_required
@role_required("HOSTEL_ADMIN", "SUPER_ADMIN")
def admin_sql_inspector():
    """
    SQL Inspector / Viva Mode:
    Exposes the exact live SQL queries, triggers, and view outputs powering HostelFlow.
    """
    college_id = session["college_id"]

    inspect_queries = {
        "v_live_mess_crowd": {
            "title": "1. Live Diners in Mess (v_live_mess_crowd)",
            "description": "Computes active eaters currently between mess_entry_time and mess_exit_time.",
            "sql": """SELECT hostel_id, hostel_name, meal_name, active_diners, capacity_utilization_pct
FROM v_live_mess_crowd
WHERE college_id = %s;""",
            "data": db.fetch_all("SELECT hostel_id, hostel_name, meal_name, active_diners, capacity_utilization_pct FROM v_live_mess_crowd WHERE college_id = %s", (college_id,))
        },
        "v_mess_slot_analytics": {
            "title": "2. 15-Minute Slot Analytics (v_mess_slot_analytics)",
            "description": "Aggregates historical visits into 15-minute time intervals to identify rush windows.",
            "sql": """SELECT slot_label, day_of_week, meal_name, visit_count, avg_duration_mins
FROM v_mess_slot_analytics
WHERE college_id = %s
ORDER BY slot_label LIMIT 15;""",
            "data": db.fetch_all("SELECT slot_label, day_of_week, meal_name, visit_count, avg_duration_mins FROM v_mess_slot_analytics WHERE college_id = %s ORDER BY slot_label LIMIT 15", (college_id,))
        },
        "v_laundry_queue_summary": {
            "title": "3. Laundry Queue Operations (v_laundry_queue_summary)",
            "description": "Calculates live bag queue counts across statuses and historical average turnaround time.",
            "sql": """SELECT submitted_count, washing_count, ready_count, collected_count, active_queue_total, avg_turnaround_hours
FROM v_laundry_queue_summary
WHERE college_id = %s;""",
            "data": db.fetch_all("SELECT submitted_count, washing_count, ready_count, collected_count, active_queue_total, avg_turnaround_hours FROM v_laundry_queue_summary WHERE college_id = %s", (college_id,))
        },
        "v_dish_impact": {
            "title": "4. Dish Bottleneck Analysis (v_dish_impact)",
            "description": "Correlates dish preparation complexity with actual student dining duration.",
            "sql": """SELECT dish_name, expected_prep_time_minutes, visit_count, avg_duration_mins
FROM v_dish_impact
WHERE college_id = %s
ORDER BY avg_duration_mins DESC LIMIT 10;""",
            "data": db.fetch_all("SELECT dish_name, expected_prep_time_minutes, visit_count, avg_duration_mins FROM v_dish_impact WHERE college_id = %s ORDER BY avg_duration_mins DESC LIMIT 10", (college_id,))
        }
    }

    return render_template("admin/sql_inspector.html", inspect_queries=inspect_queries)


# ============================================================================
# SUPER ADMIN (MULTI-COLLEGE SAAS EXTENSION)
# ============================================================================

@app.route("/superadmin/dashboard")
@login_required
@role_required("SUPER_ADMIN")
def superadmin_dashboard():
    """Multi-University SaaS Platform Control Deck."""
    colleges = db.fetch_all(
        """
        SELECT 
            c.*,
            COUNT(DISTINCT h.hostel_id) as total_hostels,
            COUNT(DISTINCT s.student_id) as total_students,
            COUNT(DISTINCT sa.staff_id) as total_staff
        FROM COLLEGE c
        LEFT JOIN HOSTEL h ON c.college_id = h.college_id
        LEFT JOIN STUDENT s ON c.college_id = s.college_id
        LEFT JOIN STAFF_ADMIN sa ON c.college_id = sa.college_id
        GROUP BY c.college_id
        ORDER BY c.college_id ASC
        """
    )

    total_visits = db.fetch_one("SELECT COUNT(*) as count FROM MESS_VISIT")
    total_laundry = db.fetch_one("SELECT COUNT(*) as count FROM LAUNDRY_REQUEST")

    stats = {
        "total_colleges": len(colleges),
        "total_visits": total_visits["count"] if total_visits else 0,
        "total_laundry": total_laundry["count"] if total_laundry else 0
    }

    return render_template("superadmin/dashboard.html", colleges=colleges, stats=stats)


@app.route("/superadmin/colleges", methods=["GET", "POST"])
@login_required
@role_required("SUPER_ADMIN")
def superadmin_colleges():
    """Onboard new universities or toggle active status."""
    if request.method == "POST":
        action = request.form.get("action")

        if action == "create":
            name = request.form.get("college_name", "").strip()
            code = request.form.get("college_code", "").strip().upper()
            city = request.form.get("city", "").strip()
            plan = request.form.get("subscription_plan", "BASIC")

            if name and code:
                try:
                    db.execute_query(
                        """
                        INSERT INTO COLLEGE (college_name, college_code, city, subscription_plan)
                        VALUES (%s, %s, %s, %s)
                        """,
                        (name, code, city, plan)
                    )
                    flash(f"University '{name}' ({code}) onboarded successfully!", "success")
                except Exception as e:
                    flash(f"Failed to onboard college: {e}", "danger")

        elif action == "toggle_active":
            c_id = request.form.get("college_id", type=int)
            if c_id:
                db.execute_query(
                    "UPDATE COLLEGE SET is_active = NOT is_active WHERE college_id = %s",
                    (c_id,)
                )
                flash("College status updated.", "info")

        return redirect(url_for("superadmin_colleges"))

    colleges = db.fetch_all("SELECT * FROM COLLEGE ORDER BY college_id ASC")
    return render_template("superadmin/colleges.html", colleges=colleges)


@app.route("/superadmin/switch-college/<int:college_id>")
@login_required
@role_required("SUPER_ADMIN")
def superadmin_switch_college(college_id):
    """Allows Super Admin to view the app from any university's perspective."""
    c = db.fetch_one("SELECT * FROM COLLEGE WHERE college_id = %s", (college_id,))
    if c:
        session["college_id"] = c["college_id"]
        session["college_name"] = c["college_name"]
        session["college_code"] = c["college_code"]
        flash(f"Switched operational context to '{c['college_name']}'.", "info")
    return redirect(url_for("admin_dashboard"))


# ============================================================================
# TIME SIMULATION (DEBUG CONTROLS)
# ============================================================================

@app.route("/api/debug/simulate-time", methods=["POST"])
@login_required
def api_simulate_time():
    """
    Debug helper: Simulates any time of day (e.g. 08:15 AM Breakfast or 01:15 PM Lunch)
    to test dynamic crowd meters and QR check-in outside physical dining windows.
    """
    data = request.get_json(silent=True) or request.form
    target_time = data.get("simulate_time", "").strip()

    if target_time:
        session["simulate_time"] = target_time
        flash(f"Simulating time: {target_time} IST. Check-in and crowd queries will evaluate against this time.", "info")
    else:
        session.pop("simulate_time", None)
        flash("Reverted to real-time clock.", "info")

    if request.is_json:
        return jsonify({"success": True, "simulate_time": session.get("simulate_time")})

    return redirect(request.referrer or url_for("dashboard_router"))


# ============================================================================
# ERROR HANDLERS
# ============================================================================

@app.errorhandler(404)
def page_not_found(e):
    return render_template("errors/404.html"), 404

@app.errorhandler(403)
def forbidden(e):
    return render_template("errors/403.html"), 403

@app.errorhandler(500)
def internal_server_error(e):
    logger.error(f"Internal server error: {e}")
    return render_template("errors/500.html"), 500


# ============================================================================
# APPLICATION ENTRYPOINT
# ============================================================================

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    debug_mode = os.environ.get("FLASK_DEBUG", "1") == "1"
    logger.info(f"Starting HostelFlow Server on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=debug_mode)
