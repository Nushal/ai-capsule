// SQLite access using Node's built-in node:sqlite module (same module as the
// Week 1 lab). No native build tools are needed, which keeps local installs
// and Render builds simple.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

export function openDatabase(dbPath) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  return db;
}
