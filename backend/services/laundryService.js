// backend/services/laundryService.js
// Core business logic for permanent bag tracking, queue snapshot calculation,
// dynamic turnaround estimation, and status lifecycle management.
import { query, get, run } from "../db/connection.js";

const DEFAULT_HISTORICAL_TURNAROUND_HOURS = 36.0;
const AVG_PROCESSING_MINUTES_PER_BAG = 20;

/**
 * Calculates historical average turnaround in hours from past received bags
 */
export function getHistoricalTurnaroundHours() {
  const result = get(`
    SELECT AVG((julianday(actual_received_datetime) - julianday(submitted_datetime)) * 24) AS avg_hours
    FROM LAUNDRY_REQUEST
    WHERE status = 'RECEIVED' AND actual_received_datetime IS NOT NULL
  `);

  if (result?.avg_hours && !isNaN(result.avg_hours)) {
    return Math.round(result.avg_hours * 10) / 10;
  }
  return DEFAULT_HISTORICAL_TURNAROUND_HOURS;
}

/**
 * Counts how many bags are currently ahead in SUBMITTED or WASHING status
 */
export function countBagsCurrentlyAhead(beforeSubmittedDatetime = null) {
  if (beforeSubmittedDatetime) {
    const res = get(
      `SELECT COUNT(*) AS count 
       FROM LAUNDRY_REQUEST 
       WHERE status IN ('SUBMITTED', 'WASHING')
         AND submitted_datetime < ?`,
      [beforeSubmittedDatetime]
    );
    return res?.count ?? 0;
  }

  const res = get(
    `SELECT COUNT(*) AS count 
     FROM LAUNDRY_REQUEST 
     WHERE status IN ('SUBMITTED', 'WASHING')`
  );
  return res?.count ?? 0;
}

/**
 * Gets student's permanent bag and current laundry status
 */
export function getStudentLaundryStatus(studentId) {
  const student = get("SELECT * FROM STUDENT WHERE student_id = ? OR roll_no = ?", [studentId, studentId]);
  if (!student) {
    return { error: "Student not found", statusCode: 404 };
  }

  const bag = get("SELECT * FROM LAUNDRY_BAG WHERE student_id = ?", [student.student_id]);
  if (!bag) {
    return { error: "No permanent bag assigned to student", statusCode: 404 };
  }

  // Find active request (status != 'RECEIVED')
  const activeRequest = get(
    `SELECT * FROM LAUNDRY_REQUEST 
     WHERE bag_number = ? AND status != 'RECEIVED'
     ORDER BY submitted_datetime DESC LIMIT 1`,
    [bag.bag_number]
  );

  // Find last received request for history preview
  const lastCompleted = get(
    `SELECT * FROM LAUNDRY_REQUEST 
     WHERE bag_number = ? AND status = 'RECEIVED'
     ORDER BY actual_received_datetime DESC LIMIT 1`,
    [bag.bag_number]
  );

  if (!activeRequest) {
    return {
      hasActiveRequest: false,
      bagNumber: bag.bag_number,
      studentName: student.name,
      rollNo: student.roll_no,
      lastRequest: lastCompleted
        ? {
            requestId: lastCompleted.request_id,
            submittedAt: lastCompleted.submitted_datetime,
            receivedAt: lastCompleted.actual_received_datetime,
            status: "RECEIVED",
          }
        : null,
    };
  }

  // Count bags currently ahead now (down from bags_ahead_at_submission)
  const bagsAheadNow = countBagsCurrentlyAhead(activeRequest.submitted_datetime);

  const statusSteps = ["SUBMITTED", "WASHING", "READY", "RECEIVED"];
  const currentStepIndex = statusSteps.indexOf(activeRequest.status);

  // Calculate if on track or late
  const expTime = new Date(activeRequest.expected_return_datetime.replace(" ", "T")).getTime();
  const nowTime = Date.now();
  const isOnTrack = nowTime <= expTime;
  const hoursRemaining = Math.round((expTime - nowTime) / (3600 * 1000));

  return {
    hasActiveRequest: true,
    requestId: activeRequest.request_id,
    bagNumber: bag.bag_number,
    studentName: student.name,
    rollNo: student.roll_no,
    status: activeRequest.status,
    stepIndex: currentStepIndex >= 0 ? currentStepIndex : 0,
    totalSteps: 4,
    bagsAheadAtSubmission: activeRequest.bags_ahead_at_submission,
    bagsAheadNow,
    submittedDatetime: activeRequest.submitted_datetime,
    expectedReturnDatetime: activeRequest.expected_return_datetime,
    isOnTrack,
    hoursRemaining,
    notes: activeRequest.notes,
    lastRequest: lastCompleted
      ? {
          requestId: lastCompleted.request_id,
          submittedAt: lastCompleted.submitted_datetime,
          receivedAt: lastCompleted.actual_received_datetime,
          status: "RECEIVED",
        }
      : null,
  };
}

/**
 * Submits laundry bag and calculates expected return time (Synopsis 4.4)
 * Formula: submitted + average historical turnaround + (bags_ahead_at_submission * avg_processing_time)
 */
export function submitLaundryRequest(studentId, notes = "") {
  const student = get("SELECT * FROM STUDENT WHERE student_id = ? OR roll_no = ?", [studentId, studentId]);
  if (!student) {
    return { error: "Student not found", statusCode: 404 };
  }

  const bag = get("SELECT * FROM LAUNDRY_BAG WHERE student_id = ?", [student.student_id]);
  if (!bag) {
    return { error: "No permanent bag assigned to student", statusCode: 404 };
  }

  // Check if an active request already exists
  const activeExisting = get(
    `SELECT * FROM LAUNDRY_REQUEST WHERE bag_number = ? AND status != 'RECEIVED'`,
    [bag.bag_number]
  );
  if (activeExisting) {
    return {
      error: `Bag ${bag.bag_number} is already in progress (${activeExisting.status}). Collect it before submitting a new request.`,
      statusCode: 400,
    };
  }

  const now = new Date();
  const submittedDatetime = now.toISOString().replace("T", " ").slice(0, 19);

  // Snapshot queue: count bags currently ahead in SUBMITTED or WASHING
  const bagsAhead = countBagsCurrentlyAhead();

  // Get historical turnaround
  const avgTurnaroundHours = getHistoricalTurnaroundHours();

  // Calculate additional minutes from bags ahead (20 min per bag)
  const additionalHoursFromQueue = (bagsAhead * AVG_PROCESSING_MINUTES_PER_BAG) / 60;
  const totalTurnaroundHours = avgTurnaroundHours + additionalHoursFromQueue;

  const expectedReturnDate = new Date(now.getTime() + totalTurnaroundHours * 3600 * 1000);
  const expectedReturnDatetime = expectedReturnDate.toISOString().replace("T", " ").slice(0, 19);

  const res = run(
    `INSERT INTO LAUNDRY_REQUEST 
      (bag_number, submitted_datetime, bags_ahead_at_submission, expected_return_datetime, status, notes)
     VALUES (?, ?, ?, ?, 'SUBMITTED', ?)`,
    [bag.bag_number, submittedDatetime, bagsAhead, expectedReturnDatetime, notes]
  );

  return {
    success: true,
    requestId: res.lastInsertRowid,
    bagNumber: bag.bag_number,
    status: "SUBMITTED",
    submittedDatetime,
    bagsAheadAtSubmission: bagsAhead,
    avgTurnaroundHours,
    avgProcessingMinutesPerBag: AVG_PROCESSING_MINUTES_PER_BAG,
    totalEstimatedHours: Math.round(totalTurnaroundHours * 10) / 10,
    expectedReturnDatetime,
    statusCode: 201,
  };
}

/**
 * Updates status of a laundry bag (Staff Action: SUBMITTED -> WASHING -> READY -> RECEIVED)
 */
export function updateLaundryStatus(requestId, newStatus) {
  const allowed = ["SUBMITTED", "WASHING", "READY", "RECEIVED"];
  if (!allowed.includes(newStatus)) {
    return { error: `Invalid status "${newStatus}". Must be one of: ${allowed.join(", ")}`, statusCode: 400 };
  }

  const request = get("SELECT * FROM LAUNDRY_REQUEST WHERE request_id = ?", [requestId]);
  if (!request) {
    return { error: `Laundry request #${requestId} not found`, statusCode: 404 };
  }

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  if (newStatus === "RECEIVED") {
    run(
      "UPDATE LAUNDRY_REQUEST SET status = ?, actual_received_datetime = ? WHERE request_id = ?",
      [newStatus, now, requestId]
    );
  } else {
    run(
      "UPDATE LAUNDRY_REQUEST SET status = ? WHERE request_id = ?",
      [newStatus, requestId]
    );
  }

  return {
    success: true,
    requestId,
    bagNumber: request.bag_number,
    previousStatus: request.status,
    newStatus,
    actualReceivedDatetime: newStatus === "RECEIVED" ? now : request.actual_received_datetime,
  };
}

/**
 * Returns complete queue list for staff console (Phase 8)
 */
export function getLaundryQueue() {
  return query(`
    SELECT 
      lr.*,
      lb.student_id,
      s.name AS student_name,
      s.roll_no,
      s.room_no,
      h.hostel_name
    FROM LAUNDRY_REQUEST lr
    JOIN LAUNDRY_BAG lb ON lr.bag_number = lb.bag_number
    JOIN STUDENT s ON lb.student_id = s.student_id
    JOIN HOSTEL h ON s.hostel_id = h.hostel_id
    WHERE lr.status != 'RECEIVED'
    ORDER BY lr.submitted_datetime ASC
  `);
}

/**
 * Returns laundry history for a student
 */
export function getStudentLaundryHistory(studentId) {
  const student = get("SELECT * FROM STUDENT WHERE student_id = ? OR roll_no = ?", [studentId, studentId]);
  if (!student) return [];

  const bag = get("SELECT * FROM LAUNDRY_BAG WHERE student_id = ?", [student.student_id]);
  if (!bag) return [];

  return query(
    `SELECT lr.*,
       CASE 
         WHEN lr.actual_received_datetime IS NOT NULL 
              AND lr.actual_received_datetime > lr.expected_return_datetime THEN 'Late'
         WHEN lr.actual_received_datetime IS NOT NULL THEN 'On Time'
         ELSE 'In Progress'
       END AS timing_verdict
     FROM LAUNDRY_REQUEST lr
     WHERE lr.bag_number = ?
     ORDER BY lr.submitted_datetime DESC`,
    [bag.bag_number]
  );
}

export default {
  getHistoricalTurnaroundHours,
  countBagsCurrentlyAhead,
  getStudentLaundryStatus,
  submitLaundryRequest,
  updateLaundryStatus,
  getLaundryQueue,
  getStudentLaundryHistory,
};

