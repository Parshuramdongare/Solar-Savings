/**
 * db.js
 * Shared sql.js database helper — persists to events.db file using fs.
 */
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'events.db');

let _db = null;
let _SQL = null;

async function getDb() {
  if (_db) return _db;
  const initSqlJs = require('sql.js');
  _SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    _db = new _SQL.Database(fileBuffer);
  } else {
    _db = new _SQL.Database();
  }

  _db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      topic TEXT,
      value TEXT,
      ledger INTEGER,
      tx_hash TEXT UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  return _db;
}

function saveDb() {
  if (!_db) return;
  const data = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

module.exports = { getDb, saveDb, DB_PATH };
