// backend/routes/messRoutes.js
import messService from "../services/messService.js";

export function handleMessRoutes(req, res, pathname, queryParams, body) {
  // POST /api/mess/scan (QR Scan entrance entry)
  if (pathname === "/api/mess/scan" && req.method === "POST") {
    const rollNo = body?.rollNo || "2025BTECH111";
    const scanDate = body?.timestamp ? new Date(body.timestamp) : new Date();
    const result = messService.recordMessScan(rollNo, scanDate);
    return { status: result.statusCode || (result.success ? 200 : 400), data: result };
  }

  // GET /api/mess/status (Live crowd breakdown)
  if (pathname === "/api/mess/status" && req.method === "GET") {
    const dateParam = queryParams.get("timestamp") ? new Date(queryParams.get("timestamp")) : new Date();
    const result = messService.getLiveCrowdStatus(dateParam);
    return { status: 200, data: result };
  }

  // GET /api/mess/forecast/:meal (30-day historical pattern)
  if (pathname.startsWith("/api/mess/forecast/") && req.method === "GET") {
    const mealName = decodeURIComponent(pathname.replace("/api/mess/forecast/", ""));
    const result = messService.getMealForecastHistory(mealName);
    return { status: 200, data: result };
  }

  // GET /api/mess/menu (Weekly mess menu)
  if (pathname === "/api/mess/menu" && req.method === "GET") {
    const result = messService.getWeeklyMenu();
    return { status: 200, data: result };
  }

  // GET /api/mess/visits/:studentId
  if (pathname.startsWith("/api/mess/visits/") && req.method === "GET") {
    const studentId = pathname.replace("/api/mess/visits/", "");
    const result = messService.getStudentVisits(studentId);
    return { status: 200, data: result };
  }

  return null;
}

export default handleMessRoutes;

