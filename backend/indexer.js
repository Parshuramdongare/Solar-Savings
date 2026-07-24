/**
 * indexer.js
 * Polls Soroban RPC every 10 seconds for contract events and stores them in SQLite (sql.js).
 */

const { rpc: StellarRpc, scValToNative } = require('@stellar/stellar-sdk');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { getDb, saveDb } = require('./db');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const RPC_URL = process.env.RPC_URL || 'https://soroban-testnet.stellar.org';

function loadAddresses() {
  const addrFile = path.join(__dirname, '..', 'deployed_addresses.txt');
  if (!fs.existsSync(addrFile)) {
    console.error('❌ deployed_addresses.txt not found.');
    process.exit(1);
  }
  const content = fs.readFileSync(addrFile, 'utf8');
  const result = {};
  content.split('\n').forEach(line => {
    const [key, val] = line.split('=');
    if (key && val) result[key.trim()] = val.trim();
  });
  return result;
}

let lastLedger = 0;

async function pollEvents() {
  const addresses = loadAddresses();
  const server = new StellarRpc.Server(RPC_URL);
  const contractIds = [addresses.ENERGY_REGISTRY, addresses.PAYOUT_SPLITTER].filter(Boolean);
  if (contractIds.length === 0) return;

  try {
    const latestLedger = await server.getLatestLedger();
    const startLedger = lastLedger > 0 ? lastLedger : Math.max(1, latestLedger.sequence - 300);

    const response = await server.getEvents({
      startLedger,
      filters: contractIds.map(id => ({ type: 'contract', contractIds: [id] })),
      limit: 200,
    });

    if (response.events && response.events.length > 0) {
      const db = await getDb();
      let newCount = 0;

      for (const event of response.events) {
        let eventType = 'unknown';
        let topicStr = '';
        let valueStr = '';

        try {
          if (event.topic && event.topic.length > 0) {
            const topicsNative = event.topic.map(scValToNative);
            eventType = topicsNative[0]?.toString() || 'unknown';
            topicStr = topicsNative.map(t => typeof t === 'object' ? JSON.stringify(t) : t).join(',');
          }
          if (event.value) {
            const valueNative = scValToNative(event.value);
            valueStr = typeof valueNative === 'bigint' ? valueNative.toString() : JSON.stringify(valueNative);
          }

          const contractIdStr = event.contractId ? event.contractId.toString() : 'unknown';
          const ledgerVal = Number(event.ledger);
          const idStr = event.id ? event.id.toString() : '';

          db.run(
            `INSERT OR IGNORE INTO events (contract_id, event_type, topic, value, ledger, tx_hash) VALUES (?, ?, ?, ?, ?, ?)`,
            [contractIdStr, eventType, topicStr, valueStr, ledgerVal, idStr]
          );
          newCount++;
        } catch (err) {
          console.error('Error parsing individual event:', err);
        }
      }

      if (newCount > 0) {
        saveDb();
        console.log(`[${new Date().toISOString()}] Indexed ${newCount} events (ledger ${startLedger} → ${latestLedger.sequence})`);
      }
    }

    lastLedger = latestLedger.sequence;
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ❌ Poll error:`, err.message);
  }
}

console.log('📡 Indexer started. Polling every 10 seconds...');
getDb().then(() => {
  pollEvents();
  setInterval(pollEvents, 10_000);
});
