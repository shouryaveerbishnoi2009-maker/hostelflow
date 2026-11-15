// backend/routes/authRoutes.js
import authService from "../services/authService.js";

export function handleAuthRoutes(req, res, pathname, body) {
  // POST /api/auth/send-otp
  if (pathname === "/api/auth/send-otp" && req.method === "POST") {
    if (!body?.rollNo) {
      return { status: 400, data: { error: "rollNo is required" } };
    }
    const result = authService.sendOtp(body.rollNo);
    return { status: 200, data: result };
  }

  // POST /api/auth/verify-otp
  if (pathname === "/api/auth/verify-otp" && req.method === "POST") {
    if (!body?.rollNo || !body?.otp) {
      return { status: 400, data: { error: "rollNo and otp are required" } };
    }
    const result = authService.verifyOtp(body.rollNo, body.otp);
    return { status: result.statusCode || (result.success ? 200 : 400), data: result };
  }

  // POST /api/students (Registration / First-time setup)
  if (pathname === "/api/students" && req.method === "POST") {
    if (!body?.rollNo || !body?.name) {
      return { status: 400, data: { error: "rollNo and name are required" } };
    }
    const result = authService.registerStudent(body);
    return { status: result.statusCode || 201, data: result };
  }

  // GET /api/students/:rollNoOrId
  if (pathname.startsWith("/api/students/") && req.method === "GET") {
    const id = pathname.replace("/api/students/", "");
    const profile = authService.getStudentProfile(id);
    if (!profile) {
      return { status: 404, data: { error: "Student not found" } };
    }
    return { status: 200, data: profile };
  }

  return null;
}

export default handleAuthRoutes;

