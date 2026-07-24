/**
 * server.js — Express API server for Solar Savings dApp.
 * Routes:
 *   GET /assets           — list registered asset events
 *   GET /events           — list all indexed events
 *   GET /balances/:address — estimated balance from indexed events
 *   GET /health           — health check
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { getDb } = require('./db');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

function loadAddresses() {
  const addrFile = path.join(__dirname, '..', 'deployed_addresses.txt');
  if (!fs.existsSync(addrFile)) return {};
  const content = fs.readFileSync(addrFile, 'utf8');
  const result = {};
  content.split('\n').forEach(line => {
    const [key, val] = line.split('=');
    if (key && val) result[key.trim()] = val.trim();
  });
  return result;
}

function dbAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  const results = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row);
  }
  stmt.free();
  return results;
}

function dbAllParams(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// GET /assets
app.get('/assets', async (req, res) => {
  try {
    const addresses = loadAddresses();
    const registryId = addresses.ENERGY_REGISTRY || '';
    const db = await getDb();

    const events = dbAllParams(db,
      `SELECT * FROM events WHERE contract_id = ? AND event_type = 'asset_registered' ORDER BY ledger ASC`,
      [registryId]
    );

    const assets = events.map((e, i) => {
      let owner = 'unknown';
      try { owner = JSON.parse(e.value) || e.value; } catch (_) { owner = e.value; }
      return { asset_id: i + 1, owner, event_ledger: e.ledger, created_at: e.created_at };
    });

    res.json({ assets, count: assets.length, registry: registryId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /events
app.get('/events', async (req, res) => {
  try {
    const { limit = '200', contract, type } = req.query;
    const db = await getDb();

    let sql = 'SELECT * FROM events';
    const params = [];
    const conditions = [];
    if (contract) { conditions.push('contract_id = ?'); params.push(contract); }
    if (type) { conditions.push('event_type = ?'); params.push(type); }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY ledger DESC, id DESC LIMIT ?';
    params.push(parseInt(limit));

    const events = dbAllParams(db, sql, params);
    res.json({ events, count: events.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /balances/:address
app.get('/balances/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const addresses = loadAddresses();
    const splitterId = addresses.PAYOUT_SPLITTER || '';
    const db = await getDb();

    const events = dbAllParams(db,
      `SELECT value, event_type FROM events WHERE contract_id = ? AND event_type IN ('payout_settled','buyer_deposit') ORDER BY ledger DESC`,
      [splitterId]
    );

    let estimate = 0;
    events.forEach(e => {
      try {
        const v = JSON.parse(e.value);
        estimate += parseInt(v?.i128?.lo || v || 0);
      } catch (_) {}
    });

    res.json({
      address,
      balance_estimate: estimate,
      splitter: splitterId,
      note: 'Estimated from indexed events. For exact on-chain balance, call get_balance directly.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /health
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function start() {
  await getDb(); // ensure db is ready
  app.listen(PORT, () => {
    console.log(`🚀 Solar Savings API → http://localhost:${PORT}`);
    console.log(`   GET /assets | GET /events | GET /balances/:address`);
  });
}

start();
