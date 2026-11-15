// backend/db/connection.js
// Database connection manager using Node.js built-in node:sqlite
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, "../data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "hostelflow.db");
const db = new DatabaseSync(DB_PATH);

// Enable foreign key constraints and WAL mode for reliability & concurrency
db.exec("PRAGMA foreign_keys = ON;");
db.exec("PRAGMA journal_mode = WAL;");

// Initialize schema if not present
const schemaPath = path.join(__dirname, "schema.sql");
if (fs.existsSync(schemaPath)) {
  const schemaSQL = fs.readFileSync(schemaPath, "utf-8");
  db.exec(schemaSQL);
}

export const query = (sql, params = []) => {
  const stmt = db.prepare(sql);
  return stmt.all(...params);
};

export const get = (sql, params = []) => {
  const stmt = db.prepare(sql);
  return stmt.get(...params);
};

export const run = (sql, params = []) => {
  const stmt = db.prepare(sql);
  return stmt.run(...params);
};

export const exec = (sql) => {
  return db.exec(sql);
};

export default {
  db,
  query,
  get,
  run,
  exec,
};

