// backend/routes/laundryRoutes.js
import laundryService from "../services/laundryService.js";

export function handleLaundryRoutes(req, res, pathname, queryParams, body) {
  // GET /api/laundry/status/:studentId
  if (pathname.startsWith("/api/laundry/status/") && req.method === "GET") {
    const studentId = pathname.replace("/api/laundry/status/", "");
    const result = laundryService.getStudentLaundryStatus(studentId);
    return { status: result.statusCode || 200, data: result };
  }

  // POST /api/laundry/submit
  if (pathname === "/api/laundry/submit" && req.method === "POST") {
    const studentId = body?.studentId || body?.rollNo || "2025BTECH111";
    const notes = body?.notes || "";
    const result = laundryService.submitLaundryRequest(studentId, notes);
    return { status: result.statusCode || 201, data: result };
  }

  // POST /api/laundry/status (Staff update)
  if (pathname === "/api/laundry/status" && req.method === "POST") {
    if (!body?.requestId || !body?.status) {
      return { status: 400, data: { error: "requestId and status are required" } };
    }
    const result = laundryService.updateLaundryStatus(body.requestId, body.status);
    return { status: result.statusCode || 200, data: result };
  }

  // GET /api/laundry/history/:studentId
  if (pathname.startsWith("/api/laundry/history/") && req.method === "GET") {
    const studentId = pathname.replace("/api/laundry/history/", "");
    const result = laundryService.getStudentLaundryHistory(studentId);
    return { status: 200, data: result };
  }

  // GET /api/laundry/queue (Staff console)
  if (pathname === "/api/laundry/queue" && req.method === "GET") {
    const result = laundryService.getLaundryQueue();
    return { status: 200, data: result };
  }

  return null;
}

export default handleLaundryRoutes;

