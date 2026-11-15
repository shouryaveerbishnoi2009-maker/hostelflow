// backend/server.js
// HostelFlow: Smart Hostel Time & Crowd Management System
// High-performance, zero-dependency Node.js REST API Server
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { URL, fileURLToPath } from "node:url";
import { handleAuthRoutes } from "./routes/authRoutes.js";
import { handleMessRoutes } from "./routes/messRoutes.js";
import { handleLaundryRoutes } from "./routes/laundryRoutes.js";
import { handleAdminRoutes } from "./routes/adminRoutes.js";
import { seedDatabase } from "./db/seed.js";
import { get } from "./db/connection.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, "../dist");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

function serveStatic(req, res, pathname) {
  if (!fs.existsSync(DIST_DIR)) return false;

  let filePath = path.join(DIST_DIR, pathname === "/" ? "index.html" : pathname);

  if (!filePath.startsWith(DIST_DIR)) return false;

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, "index.html");
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
    return true;
  }
  return false;
}

// Ensure database has initial data if empty
try {
  const studentCheck = get("SELECT COUNT(*) AS count FROM STUDENT");
  if (!studentCheck || studentCheck.count === 0) {
    console.log("Database empty. Auto-seeding initial data...");
    seedDatabase();
  }
} catch (err) {
  console.log("Initializing database...");
  seedDatabase();
}

const PORT = parseInt(process.env.PORT || process.env.BACKEND_PORT || "3001", 10);
const HOST = process.env.BACKEND_HOST || "0.0.0.0";

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

  // Handle preflight CORS request
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;
  const queryParams = parsedUrl.searchParams;

  // Read request body if present
  let body = null;
  if (req.method === "POST" || req.method === "PUT") {
    try {
      const buffers = [];
      for await (const chunk of req) {
        buffers.push(chunk);
      }
      const rawBody = Buffer.concat(buffers).toString("utf-8");
      if (rawBody.trim().length > 0) {
        body = JSON.parse(rawBody);
      }
    } catch (parseErr) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON in request body", details: parseErr.message }));
      return;
    }
  }

  // If not an API endpoint, serve static React frontend
  if (!pathname.startsWith("/api") && pathname !== "/health") {
    if (serveStatic(req, res, pathname)) {
      return;
    }
  }

  // API Health Check
  if (pathname === "/api/health" || pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "healthy",
        project: "HostelFlow Backend",
        version: "1.0.0",
        institution: "JK Lakshmipath University",
        author: "Shouryaveer Bishnoi (2025BTECH111)",
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  // Dispatch to route handlers
  try {
    let routeResponse =
      handleAuthRoutes(req, res, pathname, body) ||
      handleMessRoutes(req, res, pathname, queryParams, body) ||
      handleLaundryRoutes(req, res, pathname, queryParams, body) ||
      handleAdminRoutes(req, res, pathname, queryParams, body);

    if (routeResponse) {
      res.writeHead(routeResponse.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(routeResponse.data));
      return;
    }

    // 404 Route Not Found
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Route not found",
        path: pathname,
        method: req.method,
      })
    );
  } catch (serverErr) {
    console.error("Internal Server Error:", serverErr);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Internal Server Error",
        message: serverErr.message,
      })
    );
  }
});

export function startServer(port = PORT, host = HOST) {
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, host, () => {
      console.log(`🚀 HostelFlow Backend running at http://localhost:${port}`);
      console.log(`📡 Health Check: http://localhost:${port}/api/health`);
      console.log(`📊 DBMS Project: II Year - Shouryaveer Bishnoi (2025BTECH111)`);
      resolve(server);
    });
  });
}

// Auto-start when executed directly
if (process.argv[1]?.endsWith("server.js")) {
  startServer().catch((err) => {
    console.error("Failed to start server:", err);
  });
}

export default server;

