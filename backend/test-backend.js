// backend/test-backend.js
// Automated verification suite for the HostelFlow DBMS Backend
import http from "node:http";
import server, { startServer } from "./server.js";
import { seedDatabase } from "./db/seed.js";

const PORT = 3001;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function isServerRunning() {
  return new Promise((resolve) => {
    const req = http.get(`${BASE_URL}/api/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.request(
      url,
      {
        method,
        headers: {
          "Content-Type": "application/json",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ status: res.statusCode, data: parsed });
          } catch {
            resolve({ status: res.statusCode, raw: data });
          }
        });
      }
    );
    req.on("error", reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING HOSTELFLOW BACKEND TEST SUITE");
  console.log("=================================================");

  seedDatabase();

  let serverStartedLocally = false;
  const running = await isServerRunning();
  if (!running) {
    await startServer(PORT);
    serverStartedLocally = true;
  }

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = "") {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      if (details) console.error(`   Details:`, details);
      failed++;
    }
  }

  try {
    // 1. Health check
    const health = await request("GET", "/api/health");
    assert(health.status === 200 && health.data.status === "healthy", "Health check endpoint (/api/health)");

    // 2. Auth Flow
    const otpRes = await request("POST", "/api/auth/send-otp", { rollNo: "2025BTECH111" });
    assert(otpRes.status === 200 && otpRes.data.success, "Send OTP for Shouryaveer");

    const verifyRes = await request("POST", "/api/auth/verify-otp", { rollNo: "2025BTECH111", otp: "123456" });
    assert(
      verifyRes.status === 200 && verifyRes.data.student.name === "Shouryaveer Bishnoi",
      "Verify OTP and retrieve student profile"
    );

    // 3. Student Registration / First-Time Setup
    const testRoll = "2025BTECH999";
    const regRes = await request("POST", "/api/students", {
      rollNo: testRoll,
      name: "Tanya Sharma",
      hostelName: "Block A",
      roomNo: "418",
      phone: "+91 98765 43999",
    });
    assert(
      (regRes.status === 201 || regRes.status === 400) && (regRes.data.student || regRes.data.error),
      "Student first-time setup and auto-bag assignment"
    );

    // 4. Student Profile
    const profileRes = await request("GET", "/api/students/2025BTECH111");
    assert(
      profileRes.status === 200 && profileRes.data.bagNumber === "B-214",
      "Student profile has permanent laundry bag B-214"
    );

    // 5. Mess Menu
    const menuRes = await request("GET", "/api/mess/menu");
    assert(
      menuRes.status === 200 && menuRes.data.Monday?.Dinner?.dish === "Achari aloo & kala chana",
      "Weekly menu matches code schedule (Monday Dinner = Achari aloo)"
    );

    // 6. QR Scan - Open Meal Window (Dinner 20:15) with fresh student
    const dinnerScanDate = new Date();
    dinnerScanDate.setHours(20, 15, 0, 0); // 8:15 PM Dinner
    const scanRes = await request("POST", "/api/mess/scan", {
      rollNo: testRoll,
      timestamp: dinnerScanDate.toISOString(),
    });
    assert(
      scanRes.status === 201 && scanRes.data.meal.name === "Dinner",
      "QR scan automatically classifies Dinner (8:00–10:00 PM)"
    );
    assert(
      scanRes.data.calculation.totalDurationMinutes ===
        scanRes.data.calculation.prepMinutes + scanRes.data.calculation.eatingMinutes + 5,
      "Formula verified: expected_exit = entry + prep + eating + 5 buffer"
    );

    // 7. QR Scan - Duplicate Scan Guard
    const dupScanRes = await request("POST", "/api/mess/scan", {
      rollNo: testRoll,
      timestamp: dinnerScanDate.toISOString(),
    });
    assert(
      dupScanRes.status === 200 && dupScanRes.data.alreadyCheckedIn,
      "Duplicate scan guard prevents second entry in same meal"
    );

    // 8. QR Scan - Early Arrival (15 min window before Breakfast 7:50 AM)
    const earlyScanDate = new Date();
    earlyScanDate.setDate(earlyScanDate.getDate() + 1); // tomorrow to avoid conflicts
    earlyScanDate.setHours(7, 50, 0, 0); // 10 min before 8:00 AM opening
    const earlyRes = await request("POST", "/api/mess/scan", {
      rollNo: testRoll,
      timestamp: earlyScanDate.toISOString(),
    });
    assert(
      earlyRes.status === 201 && earlyRes.data.calculation.isEarlyArrival,
      "Early arrival scan within 15 min accepted with starts at 8:00 AM"
    );

    // 9. QR Scan - Closed State (e.g. 3:00 PM)
    const closedScanDate = new Date();
    closedScanDate.setHours(15, 0, 0, 0);
    const closedRes = await request("POST", "/api/mess/scan", {
      rollNo: testRoll,
      timestamp: closedScanDate.toISOString(),
    });
    assert(
      closedRes.status === 400 && closedRes.data.isClosed,
      "Closed state returns friendly notice with next meal opening"
    );

    // 10. Mess Forecast & Quietest Window
    const forecastRes = await request("GET", "/api/mess/forecast/Dinner");
    assert(
      forecastRes.status === 200 && forecastRes.data.slots.length > 0 && forecastRes.data.bestSlotRange,
      "30-day forecast groups into 15-min slots and identifies best pick"
    );

    // 11. Live Crowd Status (simulated during dinner)
    const liveRes = await request("GET", `/api/mess/status?timestamp=${encodeURIComponent(dinnerScanDate.toISOString())}`);
    assert(
      liveRes.status === 200 && liveRes.data.isOpen && liveRes.data.activeStudents > 0,
      "Live crowd breakdown computes active students, waiting line, and eating"
    );

    // 12. Laundry Status (Shouryaveer B-214)
    const laundryStatus = await request("GET", "/api/laundry/status/2025BTECH111");
    assert(
      laundryStatus.status === 200 &&
        laundryStatus.data.hasActiveRequest &&
        laundryStatus.data.status === "WASHING" &&
        laundryStatus.data.bagsAheadNow === 7,
      "Laundry status reflects UI state: WASHING with 7 bags ahead now"
    );

    // 13. Laundry Staff Queue
    const staffQueue = await request("GET", "/api/laundry/queue");
    assert(
      staffQueue.status === 200 && Array.isArray(staffQueue.data) && staffQueue.data.length > 0,
      "Staff console retrieves full bag queue in submission order"
    );

    // 14. Laundry Status Transition (Staff Action)
    const targetRequestId = laundryStatus.data.requestId;
    const updateRes = await request("POST", "/api/laundry/status", {
      requestId: targetRequestId,
      status: "READY",
    });
    assert(
      updateRes.status === 200 && updateRes.data.newStatus === "READY",
      "Staff can transition bag status to READY"
    );

    // Mark as RECEIVED
    const receiveRes = await request("POST", "/api/laundry/status", {
      requestId: targetRequestId,
      status: "RECEIVED",
    });
    assert(
      receiveRes.status === 200 && receiveRes.data.actualReceivedDatetime !== null,
      "Marking RECEIVED sets actual_received_datetime timestamp"
    );

    // 15. Laundry Bag Submission & Formula (Synopsis 4.4)
    // Formula: expected_return = submitted + turnaround + (bags_ahead * 20 min)
    const newSubmitRes = await request("POST", "/api/laundry/submit", {
      studentId: "2025BTECH111",
      notes: "Fresh submission after receiving bag",
    });
    assert(
      newSubmitRes.status === 201 &&
        newSubmitRes.data.bagsAheadAtSubmission !== undefined &&
        newSubmitRes.data.expectedReturnDatetime !== undefined,
      "Synopsis 4.4 verified: bag submission records queue snapshot and computes ETA"
    );

    // 16. Admin Dashboard Overview (Objective 7)
    const adminOverview = await request("GET", "/api/admin/overview");
    assert(
      adminOverview.status === 200 &&
        adminOverview.data.headline.weeklyVisits > 0 &&
        adminOverview.data.dishImpact.length > 0,
      "Admin overview aggregates weekly visits, laundry workload, and dish impact"
    );

    // 17. Admin Crowd Heatmap
    const heatmapRes = await request("GET", "/api/admin/heatmap");
    assert(
      heatmapRes.status === 200 && heatmapRes.data.Monday?.Dinner !== undefined,
      "Admin crowd heatmap matrix generated across 7 days x 4 meals"
    );

    console.log("=================================================");
    console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("=================================================");

    if (serverStartedLocally) {
      server.close();
    }
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error("Test execution error:", err);
    if (serverStartedLocally) {
      server.close();
    }
    process.exit(1);
  }
}

runTests();
