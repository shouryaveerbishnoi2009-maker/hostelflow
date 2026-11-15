// backend/https-proxy.js
// Lightweight HTTPS reverse proxy for mobile device camera support on LAN
import https from "node:https";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certDir = path.resolve(__dirname, "../.cert");
const keyPath = path.join(certDir, "key.pem");
const certPath = path.join(certDir, "cert.pem");

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.error("SSL certificates missing at .cert/key.pem and .cert/cert.pem");
  process.exit(1);
}

const sslOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
};

const HTTPS_PORT = parseInt(process.env.HTTPS_PORT || "8444", 10);
const VITE_PORT = parseInt(process.env.PORT || "8443", 10);
const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || "3001", 10);

const proxyServer = https.createServer(sslOptions, (req, res) => {
  const isApi = req.url.startsWith("/api");
  const targetPort = isApi ? BACKEND_PORT : VITE_PORT;

  const headers = { ...req.headers };
  headers.host = `127.0.0.1:${targetPort}`;
  headers["x-forwarded-proto"] = "https";
  headers["x-forwarded-for"] = req.socket.remoteAddress || "127.0.0.1";

  const proxyReq = http.request(
    {
      hostname: "127.0.0.1",
      port: targetPort,
      path: req.url,
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on("error", (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Proxy error",
          message: `Could not reach ${isApi ? "backend server" : "Vite server"} on port ${targetPort}`,
          details: err.message,
        })
      );
    }
  });

  req.pipe(proxyReq);
});

// Proxy WebSocket connections for Vite HMR over HTTPS (WSS)
proxyServer.on("upgrade", (req, socket, head) => {
  const proxyReq = http.request({
    hostname: "127.0.0.1",
    port: VITE_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers,
  });

  proxyReq.on("upgrade", (proxyRes, proxySocket, proxyHead) => {
    let headers = "HTTP/1.1 101 Switching Protocols\r\n";
    for (const [k, v] of Object.entries(proxyRes.headers)) {
      if (Array.isArray(v)) {
        for (const item of v) headers += `${k}: ${item}\r\n`;
      } else if (v !== undefined) {
        headers += `${k}: ${v}\r\n`;
      }
    }
    headers += "\r\n";
    socket.write(headers);
    if (proxyHead && proxyHead.length) socket.write(proxyHead);
    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });

  proxyReq.on("error", (err) => {
    socket.destroy();
  });

  proxyReq.end();
});

proxyServer.listen(HTTPS_PORT, "0.0.0.0", () => {
  console.log(`\n🔒 HostelFlow HTTPS Gateway running on port ${HTTPS_PORT}`);
  console.log(`   Local:   https://localhost:${HTTPS_PORT}`);
  console.log(`   Network: https://10.41.23.102:${HTTPS_PORT}`);
  console.log(`   (Secure Context enabled: camera permissions will prompt on mobile!)\n`);
});

