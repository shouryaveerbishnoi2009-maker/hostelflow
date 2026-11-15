// backend/db/seed.js
// Seeds the HostelFlow SQLite database with realistic university data,
// 30 days of historical mess visits, laundry queues, and weekly menu.
import { query, get, run, exec } from "./connection.js";

export function seedDatabase() {
  console.log("🌱 Starting HostelFlow database seeding...");

  // Clear existing data to ensure clean idempotency
  exec(`
    DELETE FROM LAUNDRY_REQUEST;
    DELETE FROM LAUNDRY_BAG;
    DELETE FROM MESS_VISIT;
    DELETE FROM MESS_MENU;
    DELETE FROM MEAL_TYPE;
    DELETE FROM STUDENT;
    DELETE FROM HOSTEL;
  `);

  // 1. Seed HOSTEL
  const hostels = [
    { name: "Block A", code: "BLK-A" },
    { name: "Block B", code: "BLK-B" },
    { name: "Block C", code: "BLK-C" },
  ];
  for (const h of hostels) {
    run("INSERT INTO HOSTEL (hostel_name, block_code) VALUES (?, ?)", [h.name, h.code]);
  }
  const blockA = get("SELECT hostel_id FROM HOSTEL WHERE hostel_name = 'Block A'");
  const blockB = get("SELECT hostel_id FROM HOSTEL WHERE hostel_name = 'Block B'");
  const blockC = get("SELECT hostel_id FROM HOSTEL WHERE hostel_name = 'Block C'");

  // 2. Seed STUDENTS
  const students = [
    { roll: "2025BTECH111", name: "Shouryaveer Bishnoi", hostelId: blockA.hostel_id, room: "214", phone: "+91 98765 43240", bag: "B-214" },
    { roll: "2025BTECH112", name: "Raghuraj Rathore", hostelId: blockA.hostel_id, room: "215", phone: "+91 98765 43241", bag: "B-215" },
    { roll: "2025BTECH113", name: "Ananya Sharma", hostelId: blockB.hostel_id, room: "104", phone: "+91 98765 43242", bag: "B-104" },
    { roll: "2025BTECH114", name: "Rohan Mehta", hostelId: blockA.hostel_id, room: "302", phone: "+91 98765 43243", bag: "B-302" },
    { roll: "2025BTECH115", name: "Sneha Patel", hostelId: blockC.hostel_id, room: "205", phone: "+91 98765 43244", bag: "C-205" },
    { roll: "2025BTECH116", name: "Aditya Verma", hostelId: blockA.hostel_id, room: "118", phone: "+91 98765 43245", bag: "B-118" },
    { roll: "2025BTECH117", name: "Kavya Iyer", hostelId: blockB.hostel_id, room: "301", phone: "+91 98765 43246", bag: "B-301" },
    { roll: "2025BTECH118", name: "Siddharth Rao", hostelId: blockA.hostel_id, room: "219", phone: "+91 98765 43247", bag: "B-219" },
    { roll: "2025BTECH119", name: "Diya Joshi", hostelId: blockB.hostel_id, room: "112", phone: "+91 98765 43248", bag: "B-112" },
    { roll: "2025BTECH120", name: "Yash Singhal", hostelId: blockA.hostel_id, room: "405", phone: "+91 98765 43249", bag: "B-405" },
    { roll: "2025BTECH121", name: "Aarav Gupta", hostelId: blockA.hostel_id, room: "220", phone: "+91 98765 43250", bag: "B-220" },
    { roll: "2025BTECH122", name: "Pooja Choudhary", hostelId: blockB.hostel_id, room: "204", phone: "+91 98765 43251", bag: "B-204" },
    { roll: "2025BTECH123", name: "Vikram Malhotra", hostelId: blockC.hostel_id, room: "108", phone: "+91 98765 43252", bag: "C-108" },
    { roll: "2025BTECH124", name: "Tanvi Saxena", hostelId: blockB.hostel_id, room: "310", phone: "+91 98765 43253", bag: "B-310" },
    { roll: "2025BTECH125", name: "Manish Agarwal", hostelId: blockA.hostel_id, room: "312", phone: "+91 98765 43254", bag: "B-312" },
  ];

  const studentMap = {};
  for (const s of students) {
    const res = run(
      "INSERT INTO STUDENT (roll_no, name, hostel_id, room_no, phone) VALUES (?, ?, ?, ?, ?)",
      [s.roll, s.name, s.hostelId, s.room, s.phone]
    );
    const studentId = res.lastInsertRowid;
    studentMap[s.roll] = studentId;

    // 1:1 permanent laundry bag assignment
    run("INSERT INTO LAUNDRY_BAG (bag_number, student_id) VALUES (?, ?)", [s.bag, studentId]);
  }

  // 3. Seed MEAL_TYPE (matching code schedule)
  const mealTypes = [
    { name: "Breakfast", start: "08:00", end: "09:00", eating: 15, buffer: 5, display: "8–9 AM" },
    { name: "Lunch", start: "11:30", end: "14:00", eating: 20, buffer: 5, display: "11:30 AM–2 PM" },
    { name: "High Tea", start: "17:00", end: "18:00", eating: 15, buffer: 5, display: "5–6 PM" },
    { name: "Dinner", start: "20:00", end: "22:00", eating: 20, buffer: 5, display: "8–10 PM" },
  ];

  const mealMap = {};
  for (const m of mealTypes) {
    const res = run(
      "INSERT INTO MEAL_TYPE (meal_name, standard_start_time, standard_end_time, avg_eating_time_minutes, buffer_time_minutes, time_display) VALUES (?, ?, ?, ?, ?, ?)",
      [m.name, m.start, m.end, m.eating, m.buffer, m.display]
    );
    mealMap[m.name] = res.lastInsertRowid;
  }

  // 4. Seed MESS_MENU (exact dishes and prep minutes from frontend code)
  const weeklyMenu = {
    Monday: {
      Breakfast: { dish: "Aloo paratha & curd", prep: 2, note: "~2 min to serve" },
      Lunch: { dish: "Kurkure bhindi & lobia masala", prep: 3, note: "~3 min to serve" },
      "High Tea": { dish: "Dal vada", prep: 2, note: "~2 min to serve" },
      Dinner: { dish: "Achari aloo & kala chana", prep: 5, note: "~5 min to serve" },
    },
    Tuesday: {
      Breakfast: { dish: "Uttapam, sambhar & chutney", prep: 2, note: "~2 min to serve" },
      Lunch: { dish: "Rajma & veg kofta", prep: 3, note: "~3 min to serve" },
      "High Tea": { dish: "Crispy corn", prep: 2, note: "~2 min to serve" },
      Dinner: { dish: "Mutter masala & jeera rice", prep: 5, note: "~5 min to serve" },
    },
    Wednesday: {
      Breakfast: { dish: "Poha", prep: 2, note: "~2 min to serve" },
      Lunch: { dish: "Stuffed tomato & dal rice", prep: 3, note: "~3 min to serve" },
      "High Tea": { dish: "Bhel puri", prep: 2, note: "~2 min to serve" },
      Dinner: { dish: "Bhindi do pyaza & egg curry", prep: 5, note: "~5 min to serve" },
    },
    Thursday: {
      Breakfast: { dish: "Idli sambhar & chutney", prep: 2, note: "~2 min to serve" },
      Lunch: { dish: "Honey chilli potato & dal", prep: 3, note: "~3 min to serve" },
      "High Tea": { dish: "Aloo chole tikki", prep: 2, note: "~2 min to serve" },
      Dinner: { dish: "Kadhai paneer & veg biryani", prep: 5, note: "~5 min to serve" },
    },
    Friday: {
      Breakfast: { dish: "Moong dal chilla", prep: 2, note: "~2 min to serve" },
      Lunch: { dish: "Aloo chole puri & soyabean rice", prep: 3, note: "~3 min to serve" },
      "High Tea": { dish: "Samosa", prep: 2, note: "~2 min to serve" },
      Dinner: { dish: "Idli, uttapam & sambhar", prep: 5, note: "~5 min to serve" },
    },
    Saturday: {
      Breakfast: { dish: "Methi thepla", prep: 2, note: "~2 min to serve" },
      Lunch: { dish: "Rajma, mix veg & rice", prep: 3, note: "~3 min to serve" },
      "High Tea": { dish: "Cutlet", prep: 2, note: "~2 min to serve" },
      Dinner: { dish: "Paneer toofani & green rice", prep: 5, note: "~5 min to serve" },
    },
    Sunday: {
      Breakfast: { dish: "Masala dosa & sambhar", prep: 2, note: "~2 min to serve" },
      Lunch: { dish: "Kadhi pakoda & veg Jaipuri", prep: 3, note: "~3 min to serve" },
      "High Tea": { dish: "Paani puri", prep: 2, note: "~2 min to serve" },
      Dinner: { dish: "Chole bhature & masala rice", prep: 5, note: "~5 min to serve" },
    },
  };

  for (const [day, meals] of Object.entries(weeklyMenu)) {
    for (const [mealName, item] of Object.entries(meals)) {
      run(
        "INSERT INTO MESS_MENU (meal_id, day_of_week, dish_name, expected_prep_time_minutes, serving_note) VALUES (?, ?, ?, ?, ?)",
        [mealMap[mealName], day, item.dish, item.prep, item.note]
      );
    }
  }

  // 5. Seed 30 Days of Historical MESS_VISIT records
  // Simulates realistic crowd patterns matching the FORECASTS in App.tsx
  const studentIds = Object.values(studentMap);
  const now = new Date();

  // Probability weight distribution per 15-min slot
  const slotProfiles = {
    Breakfast: [
      { minute: 0, weight: 70 }, // 8:00 Busy
      { minute: 15, weight: 52 }, // 8:15 Moderate
      { minute: 30, weight: 28 }, // 8:30 Quiet (Best)
      { minute: 45, weight: 38 }, // 8:45 Quiet
    ],
    Lunch: [
      { minute: 0, weight: 42, baseH: 11, baseM: 30 }, // 11:30
      { minute: 15, weight: 58, baseH: 11, baseM: 45 }, // 11:45
      { minute: 30, weight: 75, baseH: 12, baseM: 0 },  // 12:00 Peak Busy
      { minute: 45, weight: 68, baseH: 12, baseM: 15 }, // 12:15
      { minute: 60, weight: 55, baseH: 12, baseM: 30 }, // 12:30
      { minute: 75, weight: 40, baseH: 12, baseM: 45 }, // 12:45
      { minute: 90, weight: 31, baseH: 13, baseM: 0 },  // 13:00 Quiet (Best)
      { minute: 105, weight: 44, baseH: 13, baseM: 15 }, // 13:15
      { minute: 120, weight: 58, baseH: 13, baseM: 30 }, // 13:30
      { minute: 135, weight: 35, baseH: 13, baseM: 45 }, // 13:45
    ],
    "High Tea": [
      { minute: 0, weight: 61 },  // 17:00 Moderate
      { minute: 15, weight: 74 }, // 17:15 Busy
      { minute: 30, weight: 42 }, // 17:30 Quiet
      { minute: 45, weight: 24 }, // 17:45 Quiet (Best)
    ],
    Dinner: [
      { minute: 0, weight: 78 },  // 20:00 Busy
      { minute: 15, weight: 62 }, // 20:15 Moderate
      { minute: 30, weight: 34 }, // 20:30 Quiet (Best)
      { minute: 45, weight: 40 }, // 20:45 Quiet
      { minute: 60, weight: 56 }, // 21:00 Moderate
      { minute: 75, weight: 68 }, // 21:15 Busy
      { minute: 90, weight: 48 }, // 21:30 Moderate
      { minute: 105, weight: 29 }, // 21:45 Quiet
    ],
  };

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // Generate 30 days of past visits
  for (let d = 30; d >= 1; d--) {
    const targetDate = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, "0");
    const dd = String(targetDate.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const dayOfWeek = dayNames[targetDate.getDay()];

    for (const meal of mealTypes) {
      const mealId = mealMap[meal.name];
      const menuRow = get(
        "SELECT expected_prep_time_minutes FROM MESS_MENU WHERE meal_id = ? AND day_of_week = ?",
        [mealId, dayOfWeek]
      );
      const prepMinutes = menuRow?.expected_prep_time_minutes ?? 3;
      const eatingMinutes = meal.eating;
      const bufferMinutes = meal.buffer;
      const totalDuration = prepMinutes + eatingMinutes + bufferMinutes;

      const slots = slotProfiles[meal.name];
      for (const slot of slots) {
        // Calculate number of visitors for this slot based on weight
        const visitorCount = Math.max(1, Math.round((slot.weight / 100) * (studentIds.length * 0.45)));
        const [startH, startM] = meal.start.split(":").map(Number);

        let slotHour = startH;
        let slotMin = slot.minute;
        if (slot.baseH !== undefined) {
          slotHour = slot.baseH;
          slotMin = slot.baseM;
        } else {
          slotMin = startM + slot.minute;
          slotHour += Math.floor(slotMin / 60);
          slotMin %= 60;
        }

        for (let i = 0; i < visitorCount; i++) {
          const studentId = studentIds[(i * 3 + d * 5 + slotMin) % studentIds.length];
          const entryOffsetMin = (i * 2) % 15;
          const finalMin = slotMin + entryOffsetMin;
          const actualH = slotHour + Math.floor(finalMin / 60);
          const actualM = finalMin % 60;

          const entryTimeStr = `${String(actualH).padStart(2, "0")}:${String(actualM).padStart(2, "0")}:00`;
          const entryTimestamp = `${dateStr} ${entryTimeStr}`;

          // Exit time calculation: entry + prep + eating + buffer
          const exitMinTotal = actualH * 60 + actualM + totalDuration;
          const exitH = Math.floor(exitMinTotal / 60);
          const exitM = exitMinTotal % 60;
          const exitTimeStr = `${String(exitH).padStart(2, "0")}:${String(exitM).padStart(2, "0")}:00`;
          const exitTimestamp = `${dateStr} ${exitTimeStr}`;

          run(
            `INSERT INTO MESS_VISIT 
              (student_id, meal_id, visit_date, mess_entry_time, mess_exit_time, entry_timestamp, expected_exit_timestamp) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [studentId, mealId, dateStr, entryTimeStr, exitTimeStr, entryTimestamp, exitTimestamp]
          );
        }
      }
    }
  }

  // 6. Seed Today's active scans for live queue breakdown
  const todayYyyy = now.getFullYear();
  const todayMm = String(now.getMonth() + 1).padStart(2, "0");
  const todayDd = String(now.getDate()).padStart(2, "0");
  const todayDateStr = `${todayYyyy}-${todayMm}-${todayDd}`;
  const todayDayName = dayNames[now.getDay()];

  // Create today's visits for students
  const activeMeal = mealTypes[3]; // Dinner
  const dinnerMenu = get("SELECT expected_prep_time_minutes FROM MESS_MENU WHERE meal_id = ? AND day_of_week = ?", [
    mealMap["Dinner"],
    todayDayName,
  ]);
  const dinnerPrep = dinnerMenu?.expected_prep_time_minutes ?? 5;
  const dinnerDuration = dinnerPrep + activeMeal.eating + activeMeal.buffer;

  // Insert a visit for Shouryaveer earlier today or active
  const shouryaId = studentMap["2025BTECH111"];
  run(
    `INSERT INTO MESS_VISIT 
      (student_id, meal_id, visit_date, mess_entry_time, mess_exit_time, entry_timestamp, expected_exit_timestamp) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      shouryaId,
      mealMap["Breakfast"],
      todayDateStr,
      "08:14:00",
      "08:36:00",
      `${todayDateStr} 08:14:00`,
      `${todayDateStr} 08:36:00`,
    ]
  );

  // Today active groups to match App.tsx LIVE_ENTRY_GROUPS
  const sampleOffsets = [0, 15, 30, 45];
  for (let idx = 0; idx < sampleOffsets.length; idx++) {
    const offset = sampleOffsets[idx];
    const groupCount = [12, 8, 6, 9][idx % 4];
    for (let c = 0; c < groupCount; c++) {
      const sId = studentIds[(idx * 4 + c + 1) % studentIds.length];
      const entryTime = `20:${String(offset + (c % 10)).padStart(2, "0")}:00`;
      const exitTime = `20:${String(offset + (c % 10) + dinnerDuration).padStart(2, "0")}:00`;
      run(
        `INSERT INTO MESS_VISIT 
          (student_id, meal_id, visit_date, mess_entry_time, mess_exit_time, entry_timestamp, expected_exit_timestamp) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          sId,
          mealMap["Dinner"],
          todayDateStr,
          entryTime,
          exitTime,
          `${todayDateStr} ${entryTime}`,
          `${todayDateStr} ${exitTime}`,
        ]
      );
    }
  }

  // 7. Seed LAUNDRY_REQUEST records
  // Past requests with actual_received_datetime (to establish historical turnaround average ~36 hours)
  const pastSubmissions = [
    { bag: "B-214", subHours: 240, recHours: 204, status: "RECEIVED", ahead: 5 }, // 36 hours turnaround
    { bag: "B-215", subHours: 216, recHours: 180, status: "RECEIVED", ahead: 8 }, // 36 hours turnaround
    { bag: "B-104", subHours: 192, recHours: 154, status: "RECEIVED", ahead: 4 }, // 38 hours turnaround
    { bag: "B-302", subHours: 168, recHours: 133, status: "RECEIVED", ahead: 6 }, // 35 hours turnaround
    { bag: "C-205", subHours: 144, recHours: 108, status: "RECEIVED", ahead: 9 }, // 36 hours turnaround
    { bag: "B-118", subHours: 120, recHours: 85, status: "RECEIVED", ahead: 7 }, // 35 hours turnaround
  ];

  for (const p of pastSubmissions) {
    const subDate = new Date(now.getTime() - p.subHours * 3600 * 1000).toISOString().replace("T", " ").slice(0, 19);
    const recDate = new Date(now.getTime() - p.recHours * 3600 * 1000).toISOString().replace("T", " ").slice(0, 19);
    const expDate = new Date(now.getTime() - (p.subHours - 36) * 3600 * 1000).toISOString().replace("T", " ").slice(0, 19);

    run(
      `INSERT INTO LAUNDRY_REQUEST 
        (bag_number, submitted_datetime, bags_ahead_at_submission, expected_return_datetime, actual_received_datetime, status) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [p.bag, subDate, p.ahead, expDate, recDate, p.status]
    );
  }

  // Active queue snapshot matching UI states:
  // UI states for Shouryaveer:
  // "2 of 4 steps (Washing)"
  // "7 bags ahead now, Down from 11 when you submitted"
  // "Expected back Friday, around 6:00 AM"

  // 7 bags currently ahead in WASHING / SUBMITTED:
  const activeBagsAhead = [
    { bag: "B-104", hoursAgo: 26, status: "WASHING", ahead: 1 },
    { bag: "B-118", hoursAgo: 24, status: "WASHING", ahead: 2 },
    { bag: "B-112", hoursAgo: 22, status: "WASHING", ahead: 3 },
    { bag: "B-301", hoursAgo: 20, status: "WASHING", ahead: 4 },
    { bag: "C-205", hoursAgo: 18, status: "WASHING", ahead: 5 },
    { bag: "B-219", hoursAgo: 16, status: "WASHING", ahead: 6 },
    { bag: "B-405", hoursAgo: 15, status: "SUBMITTED", ahead: 7 },
  ];

  for (const b of activeBagsAhead) {
    const subDate = new Date(now.getTime() - b.hoursAgo * 3600 * 1000).toISOString().replace("T", " ").slice(0, 19);
    const expDate = new Date(now.getTime() + (36 - b.hoursAgo) * 3600 * 1000).toISOString().replace("T", " ").slice(0, 19);

    run(
      `INSERT INTO LAUNDRY_REQUEST 
        (bag_number, submitted_datetime, bags_ahead_at_submission, expected_return_datetime, status) 
       VALUES (?, ?, ?, ?, ?)`,
      [b.bag, subDate, b.ahead, expDate, b.status]
    );
  }

  // Now insert Shouryaveer's active bag B-214:
  // Submitted with 11 bags ahead, now 7 ahead, status WASHING
  const shouryaSubDate = new Date(now.getTime() - 14 * 3600 * 1000).toISOString().replace("T", " ").slice(0, 19);
  // Expected back Friday 6:00 AM
  const fridayExp = new Date(now);
  fridayExp.setDate(now.getDate() + ((5 + 7 - now.getDay()) % 7 || 7));
  fridayExp.setHours(6, 0, 0, 0);
  const shouryaExpDate = fridayExp.toISOString().replace("T", " ").slice(0, 19);

  run(
    `INSERT INTO LAUNDRY_REQUEST 
      (bag_number, submitted_datetime, bags_ahead_at_submission, expected_return_datetime, status, notes) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    ["B-214", shouryaSubDate, 11, shouryaExpDate, "WASHING", "Delicates included"]
  );

  // 2 bags submitted after Shouryaveer:
  const laterBags = [
    { bag: "B-220", hoursAgo: 10, status: "SUBMITTED", ahead: 12 },
    { bag: "B-310", hoursAgo: 4, status: "SUBMITTED", ahead: 13 },
  ];
  for (const b of laterBags) {
    const subDate = new Date(now.getTime() - b.hoursAgo * 3600 * 1000).toISOString().replace("T", " ").slice(0, 19);
    const expDate = new Date(now.getTime() + 40 * 3600 * 1000).toISOString().replace("T", " ").slice(0, 19);
    run(
      `INSERT INTO LAUNDRY_REQUEST 
        (bag_number, submitted_datetime, bags_ahead_at_submission, expected_return_datetime, status) 
       VALUES (?, ?, ?, ?, ?)`,
      [b.bag, subDate, b.ahead, expDate, b.status]
    );
  }

  console.log("✅ Database seeding completed successfully!");
  console.log(`- Hostels: ${hostels.length}`);
  console.log(`- Students: ${students.length}`);
  console.log(`- Meal Types: ${mealTypes.length}`);
  console.log(`- Menu Items: 28 (7 days x 4 meals)`);
  const visitCount = get("SELECT COUNT(*) AS count FROM MESS_VISIT").count;
  console.log(`- Mess Visits: ${visitCount}`);
  const laundryCount = get("SELECT COUNT(*) AS count FROM LAUNDRY_REQUEST").count;
  console.log(`- Laundry Requests: ${laundryCount}`);
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith("seed.js")) {
  seedDatabase();
}

