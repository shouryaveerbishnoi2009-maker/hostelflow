// src/services/api.ts
// HostelFlow Client API Service for connecting frontend to the REST backend

// All requests go through Vite's /api proxy → backend:3001
// Works on both localhost and LAN (via HTTPS Vite server)
const API_BASE = "/api";

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      return errBody as T;
    }
    return (await res.json()) as T;
  } catch {
    // If backend is not running or offline, return null for graceful fallback
    return null;
  }
}

export const api = {
  async checkHealth() {
    return fetchJson<{ status: string; version: string }>("/health");
  },

  async sendOtp(rollNo: string) {
    return fetchJson<{ success: boolean; message: string; demoOtp?: string }>("/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({ rollNo }),
    });
  },

  async verifyOtp(rollNo: string, otp: string) {
    return fetchJson<{
      success: boolean;
      needsSetup?: boolean;
      student?: {
        studentId: number;
        rollNo: string;
        name: string;
        hostelName: string;
        roomNo: string;
        phone: string;
        bagNumber: string;
      };
      error?: string;
    }>("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ rollNo, otp }),
    });
  },

  async registerStudent(data: {
    rollNo: string;
    name: string;
    hostelName: string;
    roomNo: string;
    phone: string;
  }) {
    return fetchJson<{
      success: boolean;
      student?: {
        studentId: number;
        rollNo: string;
        name: string;
        hostelName: string;
        roomNo: string;
        phone: string;
        bagNumber: string;
      };
      error?: string;
    }>("/students", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getStudentProfile(rollNo: string) {
    return fetchJson<{
      studentId: number;
      rollNo: string;
      name: string;
      hostelName: string;
      roomNo: string;
      phone: string;
      bagNumber: string;
      notificationLaundry: boolean;
    }>(`/students/${encodeURIComponent(rollNo)}`);
  },

  async scanMessQR(rollNo: string, timestamp?: string) {
    return fetchJson<{
      success: boolean;
      alreadyCheckedIn?: boolean;
      isClosed?: boolean;
      message?: string;
      meal?: { id: number; name: string; window: string };
      dish?: { name: string; prepMinutes: number; servingTime: string };
      calculation?: {
        isEarlyArrival: boolean;
        minutesUntilOpening: number;
        startTimeDisplay: string;
        prepMinutes: number;
        eatingMinutes: number;
        bufferMinutes: number;
        totalDurationMinutes: number;
        expectedExitDisplay: string;
      };
      visit?: {
        visitId: number;
        meal: string;
        entryTime: string;
        expectedExitTime: string;
        dish: string;
      };
      nextMeal?: {
        name: string;
        startsAt: string;
        window: string;
        minutesUntilOpening: number;
        tomorrow: boolean;
      };
      error?: string;
    }>("/mess/scan", {
      method: "POST",
      body: JSON.stringify({ rollNo, timestamp }),
    });
  },

  async getLiveCrowdStatus(timestamp?: string) {
    const query = timestamp ? `?timestamp=${encodeURIComponent(timestamp)}` : "";
    return fetchJson<{
      isOpen: boolean;
      mealName: string;
      mealWindow?: string;
      crowdLabel?: string;
      activeStudents?: number;
      waitingInQueue?: number;
      eatingCount?: number;
      nextExpectedExit?: string | null;
      recommendation?: { title: string; detail: string };
      activeEntryGroups?: Array<{
        offset: number;
        count: number;
        enteredAt: string;
        waiting: number;
        eating: number;
        expectedExit: string;
      }>;
      message?: string;
    }>(`/mess/status${query}`);
  },

  async getMealForecast(mealName: string) {
    return fetchJson<{
      mealName: string;
      mealWindow: string;
      slots: Array<{
        time: string;
        value: number;
        label: string;
        level: number;
        best?: boolean;
        avgPerDay?: number;
      }>;
      bestSlotRange: string;
      bestSlotTime: string;
      peakSlotTime: string;
      timeSavedMinutes: number;
      recommendationText: string;
    }>(`/mess/forecast/${encodeURIComponent(mealName)}`);
  },

  async getWeeklyMenu() {
    return fetchJson<Record<string, Record<string, { dish: string; prepMinutes: number; servingTime: string }>>>(
      "/mess/menu"
    );
  },

  async getLaundryStatus(studentId: string) {
    return fetchJson<{
      hasActiveRequest: boolean;
      requestId?: number;
      bagNumber: string;
      studentName: string;
      rollNo: string;
      status?: "SUBMITTED" | "WASHING" | "READY" | "RECEIVED";
      stepIndex?: number;
      totalSteps?: number;
      bagsAheadAtSubmission?: number;
      bagsAheadNow?: number;
      submittedDatetime?: string;
      expectedReturnDatetime?: string;
      isOnTrack?: boolean;
      hoursRemaining?: number;
      lastRequest?: {
        requestId: number;
        submittedAt: string;
        receivedAt: string;
        status: string;
      };
    }>(`/laundry/status/${encodeURIComponent(studentId)}`);
  },

  async submitLaundry(studentId: string, notes?: string) {
    return fetchJson<{
      success: boolean;
      requestId?: number;
      bagNumber?: string;
      status?: string;
      submittedDatetime?: string;
      bagsAheadAtSubmission?: number;
      expectedReturnDatetime?: string;
      error?: string;
    }>("/laundry/submit", {
      method: "POST",
      body: JSON.stringify({ studentId, notes }),
    });
  },

  async updateLaundryStatus(requestId: number, status: string) {
    return fetchJson<{
      success: boolean;
      requestId: number;
      newStatus: string;
      actualReceivedDatetime?: string;
      error?: string;
    }>("/laundry/status", {
      method: "POST",
      body: JSON.stringify({ requestId, status }),
    });
  },

  async getLaundryQueue() {
    return fetchJson<
      Array<{
        request_id: number;
        bag_number: string;
        student_name: string;
        roll_no: string;
        room_no: string;
        hostel_name: string;
        submitted_datetime: string;
        expected_return_datetime: string;
        status: string;
        bags_ahead_at_submission: number;
      }>
    >("/laundry/queue");
  },

  async getAdminOverview() {
    return fetchJson<{
      headline: {
        weeklyVisits: number;
        priorWeekVisits: number;
        changePercent: number;
        displayString: string;
      };
      laundryWorkload: {
        submitted: number;
        washing: number;
        ready: number;
        received: number;
        avgTurnaroundHours: number;
        onTimePercentage: number;
      };
      busiestSlots: Array<{ meal: string; time: string; visits: number; description: string }>;
      quietestSlots: Array<{ meal: string; time: string; visits: number; description: string }>;
      dishImpact: Array<{
        dish_name: string;
        expected_prep_time_minutes: number;
        meal_name: string;
        avg_duration_minutes: number;
        recorded_visits: number;
      }>;
      alerts: Array<{ type: string; facility: string; message: string }>;
    }>("/admin/overview");
  },

  async getAdminHeatmap() {
    return fetchJson<Record<string, Record<string, number>>>("/admin/heatmap");
  },
};

export default api;

