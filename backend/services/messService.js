// backend/services/messService.js
// Core business logic for QR-based mess entry, meal detection,
// exit time derivation, live crowd breakdown, and 30-day analytics.
import { query, get, run } from "../db/connection.js";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Parses time string "HH:MM" into total minutes from midnight
 */
export function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Formats total minutes from midnight into 12-hour string (e.g. "8:33 PM")
 */
export function minutesToTimeString(minutes) {
  const normalized = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hour24 = Math.floor(normalized / 60);
  const min = normalized % 60;
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(min).padStart(2, "0")} ${period}`;
}

/**
 * Formats total minutes into 24-hour "HH:MM:SS"
 */
export function minutesToTime24(minutes) {
  const normalized = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

/**
 * Determines current meal context (open meal or upcoming meal)
 * Supports early arrival window (up to 15 min before opening)
 */
export function getMealContext(date = new Date()) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  const meals = query("SELECT * FROM MEAL_TYPE ORDER BY meal_id ASC");

  const parsedMeals = meals.map((m) => ({
    ...m,
    startMinutes: timeToMinutes(m.standard_start_time),
    endMinutes: timeToMinutes(m.standard_end_time),
  }));

  // Check if currently inside an open meal window
  const openMeal = parsedMeals.find((m) => minutes >= m.startMinutes && minutes < m.endMinutes);
  if (openMeal) {
    return {
      meal: openMeal,
      isOpen: true,
      isEarlyArrival: false,
      minutesUntilOpening: 0,
      tomorrow: false,
    };
  }

  // Check if student arrived early (within 15 minutes before opening)
  const earlyMeal = parsedMeals.find(
    (m) => minutes < m.startMinutes && m.startMinutes - minutes <= 15
  );
  if (earlyMeal) {
    return {
      meal: earlyMeal,
      isOpen: false,
      isEarlyArrival: true,
      minutesUntilOpening: earlyMeal.startMinutes - minutes,
      tomorrow: false,
    };
  }

  // Find next upcoming meal today
  const nextMeal = parsedMeals.find((m) => minutes < m.startMinutes);
  if (nextMeal) {
    return {
      meal: nextMeal,
      isOpen: false,
      isEarlyArrival: false,
      minutesUntilOpening: nextMeal.startMinutes - minutes,
      tomorrow: false,
    };
  }

  // Next meal is tomorrow's first meal (Breakfast)
  const firstMealTomorrow = parsedMeals[0];
  const minutesUntilTomorrowOpening = 24 * 60 - minutes + firstMealTomorrow.startMinutes;
  return {
    meal: firstMealTomorrow,
    isOpen: false,
    isEarlyArrival: false,
    minutesUntilOpening: minutesUntilTomorrowOpening,
    tomorrow: true,
  };
}

/**
 * Handles QR-code scan at the mess entrance (Synopsis 4.1, 4.2, 4.3)
 * Derives meal type automatically, calculates dish-aware expected exit time,
 * and enforces duplicate-scan guards.
 */
export function recordMessScan(rollNo, scanDate = new Date()) {
  const student = get("SELECT * FROM STUDENT WHERE roll_no = ?", [rollNo]);
  if (!student) {
    return { error: `Student with roll number "${rollNo}" was not found.`, statusCode: 404 };
  }

  const context = getMealContext(scanDate);
  const { meal, isOpen, isEarlyArrival, minutesUntilOpening, tomorrow } = context;

  // If mess is closed and student is NOT in the 15-min early arrival window:
  if (!isOpen && !isEarlyArrival) {
    return {
      success: false,
      isClosed: true,
      message: `The mess is not open right now. ${meal.meal_name} opens ${tomorrow ? "tomorrow " : ""}at ${minutesToTimeString(meal.startMinutes)}.`,
      nextMeal: {
        name: meal.meal_name,
        startsAt: minutesToTimeString(meal.startMinutes),
        window: meal.time_display,
        minutesUntilOpening,
        tomorrow,
      },
      statusCode: 400,
    };
  }

  const dayOfWeek = DAY_NAMES[scanDate.getDay()];
  const yyyy = scanDate.getFullYear();
  const mm = String(scanDate.getMonth() + 1).padStart(2, "0");
  const dd = String(scanDate.getDate()).padStart(2, "0");
  const visitDateStr = `${yyyy}-${mm}-${dd}`;

  // Duplicate-scan guard: has student already scanned in for this meal today?
  const existingVisit = get(
    `SELECT v.*, mt.meal_name, mm.dish_name 
     FROM MESS_VISIT v
     JOIN MEAL_TYPE mt ON v.meal_id = mt.meal_id
     LEFT JOIN MESS_MENU mm ON mm.meal_id = mt.meal_id AND mm.day_of_week = ?
     WHERE v.student_id = ? AND v.meal_id = ? AND v.visit_date = ?`,
    [dayOfWeek, student.student_id, meal.meal_id, visitDateStr]
  );

  if (existingVisit) {
    const [exitH, exitM] = existingVisit.mess_exit_time.split(":").map(Number);
    const exitTimeString = minutesToTimeString(exitH * 60 + exitM);
    return {
      success: true,
      alreadyCheckedIn: true,
      message: `You're already checked in for ${meal.meal_name}. Expected exit was calculated at ${exitTimeString}.`,
      visit: {
        visitId: existingVisit.visit_id,
        meal: meal.meal_name,
        entryTime: existingVisit.mess_entry_time,
        expectedExitTime: exitTimeString,
        dish: existingVisit.dish_name,
      },
      statusCode: 200,
    };
  }

  // Lookup dish from MESS_MENU
  const menuItem = get(
    "SELECT * FROM MESS_MENU WHERE meal_id = ? AND day_of_week = ?",
    [meal.meal_id, dayOfWeek]
  );
  const dishName = menuItem?.dish_name ?? "Standard Meal";
  const expectedPrepMinutes = menuItem?.expected_prep_time_minutes ?? 3;
  const avgEatingMinutes = meal.avg_eating_time_minutes;
  const bufferMinutes = meal.buffer_time_minutes || 5;

  // Synopsis 4.3 & App.tsx calculationStart logic:
  // If early arrival, calculation starts from meal opening time; else from current scan minutes
  const scanMinutes = scanDate.getHours() * 60 + scanDate.getMinutes();
  const calculationStart = isOpen ? scanMinutes : meal.startMinutes;
  const expectedExitMinutes = calculationStart + expectedPrepMinutes + avgEatingMinutes + bufferMinutes;

  const entryTimeStr = `${String(scanDate.getHours()).padStart(2, "0")}:${String(scanDate.getMinutes()).padStart(2, "0")}:${String(scanDate.getSeconds()).padStart(2, "0")}`;
  const exitTimeStr = minutesToTime24(expectedExitMinutes);

  const entryTimestamp = `${visitDateStr} ${entryTimeStr}`;
  const exitTimestamp = `${visitDateStr} ${exitTimeStr}`;

  const insertResult = run(
    `INSERT INTO MESS_VISIT 
      (student_id, meal_id, visit_date, mess_entry_time, mess_exit_time, entry_timestamp, expected_exit_timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [student.student_id, meal.meal_id, visitDateStr, entryTimeStr, exitTimeStr, entryTimestamp, exitTimestamp]
  );

  return {
    success: true,
    alreadyCheckedIn: false,
    visitId: insertResult.lastInsertRowid,
    student: {
      studentId: student.student_id,
      name: student.name,
      rollNo: student.roll_no,
      roomNo: student.room_no,
    },
    meal: {
      id: meal.meal_id,
      name: meal.meal_name,
      window: meal.time_display,
    },
    dish: {
      name: dishName,
      prepMinutes: expectedPrepMinutes,
      servingTime: `~${expectedPrepMinutes} min to serve`,
    },
    calculation: {
      isEarlyArrival,
      minutesUntilOpening: isEarlyArrival ? minutesUntilOpening : 0,
      startTimeDisplay: minutesToTimeString(calculationStart),
      prepMinutes: expectedPrepMinutes,
      eatingMinutes: avgEatingMinutes,
      bufferMinutes: bufferMinutes,
      totalDurationMinutes: expectedPrepMinutes + avgEatingMinutes + bufferMinutes,
      expectedExitDisplay: minutesToTimeString(expectedExitMinutes),
    },
    statusCode: 201,
  };
}

/**
 * Returns live status of mess crowd right now from today's scans (Synopsis 4.3 & App.tsx)
 */
export function getLiveCrowdStatus(date = new Date()) {
  const context = getMealContext(date);
  const { meal, isOpen, tomorrow } = context;

  if (!isOpen) {
    return {
      isOpen: false,
      mealName: meal.meal_name,
      message: `The mess is closed right now. Next serving: ${meal.meal_name} at ${minutesToTimeString(meal.startMinutes)}.`,
      nextStart: minutesToTimeString(meal.startMinutes),
      nextWindow: meal.time_display,
      tomorrow,
      breakdown: null,
    };
  }

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const dateStr = `${yyyy}-${mm}-${dd}`;
  const currentMinutes = date.getHours() * 60 + date.getMinutes();

  // Query visits for today during the current meal
  const todayVisits = query(
    `SELECT v.*, mt.standard_start_time, mm.expected_prep_time_minutes
     FROM MESS_VISIT v
     JOIN MEAL_TYPE mt ON v.meal_id = mt.meal_id
     LEFT JOIN MESS_MENU mm ON mm.meal_id = mt.meal_id AND mm.day_of_week = ?
     WHERE v.meal_id = ? AND v.visit_date = ?
     ORDER BY v.entry_timestamp ASC`,
    [DAY_NAMES[date.getDay()], meal.meal_id, dateStr]
  );

  const mealStartMin = meal.startMinutes;
  const elapsed = currentMinutes - mealStartMin;

  // Group visits into 15-minute entry buckets
  const bucketMap = new Map();
  for (const visit of todayVisits) {
    const [entryH, entryM] = visit.mess_entry_time.split(":").map(Number);
    const entryMin = entryH * 60 + entryM;
    const [exitH, exitM] = visit.mess_exit_time.split(":").map(Number);
    const exitMin = exitH * 60 + exitM;

    // Check if visit is currently active (entry has occurred and expected exit has not passed)
    if (entryMin <= currentMinutes && currentMinutes < exitMin) {
      const offset = Math.floor((entryMin - mealStartMin) / 15) * 15;
      if (!bucketMap.has(offset)) {
        bucketMap.set(offset, {
          offset: Math.max(0, offset),
          enteredAtMinutes: mealStartMin + Math.max(0, offset),
          count: 0,
          expectedExitMinutes: exitMin,
          prepMinutes: visit.expected_prep_time_minutes || 3,
        });
      }
      const b = bucketMap.get(offset);
      b.count += 1;
      b.expectedExitMinutes = Math.max(b.expectedExitMinutes, exitMin);
    }
  }

  let totalWaiting = 0;
  let totalEating = 0;
  let totalActive = 0;

  const groups = Array.from(bucketMap.values()).map((group) => {
    const minutesSinceEntry = currentMinutes - group.enteredAtMinutes;
    // Food collection estimation (matches App.tsx serving pace)
    const served = Math.min(
      group.count,
      Math.max(0, Math.floor((minutesSinceEntry - group.prepMinutes) / 0.75))
    );
    const waiting = group.count - served;
    const eating = served;

    totalWaiting += waiting;
    totalEating += eating;
    totalActive += group.count;

    return {
      offset: group.offset,
      count: group.count,
      enteredAt: minutesToTimeString(group.enteredAtMinutes),
      waiting,
      eating,
      expectedExit: minutesToTimeString(group.expectedExitMinutes),
      rawExitMinutes: group.expectedExitMinutes,
    };
  });

  const nextExpectedExit = groups.length
    ? Math.min(...groups.map((g) => g.rawExitMinutes))
    : null;

  const crowdLabel = totalActive >= 25 ? "Busy" : totalActive >= 12 ? "Moderate" : "Quiet";

  let recommendationTitle = "Go now";
  let recommendationDetail = "There are no active entries right now.";

  if (totalActive > 0) {
    if (nextExpectedExit && nextExpectedExit < meal.endMinutes) {
      recommendationTitle = `Around ${minutesToTimeString(nextExpectedExit)}`;
      recommendationDetail = "The next active group is expected to leave around this time.";
    } else {
      recommendationTitle = "Go now";
      recommendationDetail = "The current meal window is nearing its end, so waiting may not leave enough serving time.";
    }
  }

  return {
    isOpen: true,
    mealName: meal.meal_name,
    mealWindow: meal.time_display,
    crowdLabel,
    activeStudents: totalActive,
    waitingInQueue: totalWaiting,
    eatingCount: totalEating,
    nextExpectedExit: nextExpectedExit ? minutesToTimeString(nextExpectedExit) : null,
    recommendation: {
      title: recommendationTitle,
      detail: recommendationDetail,
    },
    activeEntryGroups: groups,
  };
}

/**
 * 30-day historical pattern and recommendations for a given meal (Synopsis 4.5 & App.tsx)
 */
export function getMealForecastHistory(mealName = "Dinner") {
  const meal = get("SELECT * FROM MEAL_TYPE WHERE meal_name = ?", [mealName]);
  if (!meal) return { error: `Meal ${mealName} not found` };

  const startMin = timeToMinutes(meal.standard_start_time);
  const endMin = timeToMinutes(meal.standard_end_time);

  // Generate 15-minute slot intervals for this meal window
  const slotCount = (endMin - startMin) / 15;
  const slots = [];

  for (let i = 0; i < slotCount; i++) {
    const slotMin = startMin + i * 15;
    const slotH = Math.floor(slotMin / 60);
    const slotM = slotMin % 60;
    const timeDisplay = `${slotH % 12 || 12}:${String(slotM).padStart(2, "0")}`;

    // Query 30-day visits for this 15-minute slot
    const slotStats = get(
      `SELECT COUNT(*) AS visit_count
       FROM MESS_VISIT
       WHERE meal_id = ? 
         AND visit_date >= date('now', '-30 days')
         AND CAST(strftime('%H', mess_entry_time) AS INTEGER) * 60 + CAST(strftime('%M', mess_entry_time) AS INTEGER) >= ?
         AND CAST(strftime('%H', mess_entry_time) AS INTEGER) * 60 + CAST(strftime('%M', mess_entry_time) AS INTEGER) < ?`,
      [meal.meal_id, slotMin, slotMin + 15]
    );

    const count = slotStats?.visit_count ?? 0;
    slots.push({
      index: i,
      time: timeDisplay,
      totalVisits: count,
      avgPerDay: Math.round((count / 30) * 10) / 10,
    });
  }

  // Calculate percentage values, labels, levels, and identify best slot
  const maxVisits = Math.max(...slots.map((s) => s.totalVisits), 1);
  const minVisits = Math.min(...slots.map((s) => s.totalVisits));

  const enhancedSlots = slots.map((s) => {
    const value = Math.max(15, Math.min(95, Math.round((s.totalVisits / maxVisits) * 85)));
    let label = "Quiet";
    let level = 1;
    if (value >= 65) {
      label = "Busy";
      level = 4;
    } else if (value >= 45) {
      label = "Moderate";
      level = 3;
    } else if (value >= 30) {
      label = "Quiet";
      level = 2;
    }

    const isBest = s.totalVisits === minVisits;
    return {
      time: s.time,
      value,
      label,
      level,
      best: isBest,
      avgPerDay: s.avgPerDay,
    };
  });

  const bestSlot = enhancedSlots.find((s) => s.best) || enhancedSlots[0];
  const busiestSlot = enhancedSlots.reduce((prev, curr) => (curr.value > prev.value ? curr : prev), enhancedSlots[0]);

  // Calculate slot range for best slot
  const bestIdx = enhancedSlots.findIndex((s) => s.best);
  const endSlotTime = bestIdx === enhancedSlots.length - 1
    ? minutesToTimeString(endMin)
    : enhancedSlots[bestIdx + 1].time;
  const bestRange = `${bestSlot.time}–${endSlotTime} ${mealName === "Breakfast" ? "AM" : "PM"}`;

  return {
    mealName,
    mealWindow: meal.time_display,
    slots: enhancedSlots,
    bestSlotRange: bestRange,
    bestSlotTime: bestSlot.time,
    peakSlotTime: busiestSlot.time,
    timeSavedMinutes: 12,
    recommendationText: `${mealName} is usually busiest ${busiestSlot.time} ${mealName === "Breakfast" ? "AM" : "PM"} — try ${bestRange} instead.`,
  };
}

/**
 * Returns full weekly menu
 */
export function getWeeklyMenu() {
  const rows = query(
    `SELECT mm.*, mt.meal_name, mt.time_display
     FROM MESS_MENU mm
     JOIN MEAL_TYPE mt ON mm.meal_id = mt.meal_id
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
       mt.meal_id ASC`
  );

  const menuByDay = {};
  for (const row of rows) {
    if (!menuByDay[row.day_of_week]) {
      menuByDay[row.day_of_week] = {};
    }
    menuByDay[row.day_of_week][row.meal_name] = {
      dish: row.dish_name,
      prepMinutes: row.expected_prep_time_minutes,
      servingTime: row.serving_note || `~${row.expected_prep_time_minutes} min to serve`,
      timeWindow: row.time_display,
    };
  }

  return menuByDay;
}

/**
 * Returns visit history for a student
 */
export function getStudentVisits(studentId, limit = 20) {
  return query(
    `SELECT v.*, mt.meal_name, mm.dish_name, mm.expected_prep_time_minutes
     FROM MESS_VISIT v
     JOIN MEAL_TYPE mt ON v.meal_id = mt.meal_id
     LEFT JOIN MESS_MENU mm ON mm.meal_id = mt.meal_id 
       AND mm.day_of_week = CASE strftime('%w', v.visit_date)
         WHEN '0' THEN 'Sunday'
         WHEN '1' THEN 'Monday'
         WHEN '2' THEN 'Tuesday'
         WHEN '3' THEN 'Wednesday'
         WHEN '4' THEN 'Thursday'
         WHEN '5' THEN 'Friday'
         WHEN '6' THEN 'Saturday'
       END
     WHERE v.student_id = ?
     ORDER BY v.entry_timestamp DESC
     LIMIT ?`,
    [studentId, limit]
  );
}

export default {
  timeToMinutes,
  minutesToTimeString,
  minutesToTime24,
  getMealContext,
  recordMessScan,
  getLiveCrowdStatus,
  getMealForecastHistory,
  getWeeklyMenu,
  getStudentVisits,
};

