// backend/routes/adminRoutes.js
import analyticsService from "../services/analyticsService.js";

export function handleAdminRoutes(req, res, pathname, queryParams, body) {
  // GET /api/admin/overview
  if (pathname === "/api/admin/overview" && req.method === "GET") {
    const result = analyticsService.getAdminOverview();
    return { status: 200, data: result };
  }

  // GET /api/admin/heatmap
  if (pathname === "/api/admin/heatmap" && req.method === "GET") {
    const result = analyticsService.getCrowdHeatmap();
    return { status: 200, data: result };
  }

  // POST /api/admin/menu/update
  if (pathname === "/api/admin/menu/update" && req.method === "POST") {
    if (!body?.menuId || !body?.dishName || body?.expectedPrepMinutes === undefined) {
      return { status: 400, data: { error: "menuId, dishName, and expectedPrepMinutes are required" } };
    }
    const result = analyticsService.updateMenuDish(body.menuId, body.dishName, body.expectedPrepMinutes);
    return { status: 200, data: result };
  }

  return null;
}

export default handleAdminRoutes;

