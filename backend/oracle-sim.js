/**
 * oracle-sim.js
 * Simulates a trusted solar energy reporter.
 * Every 30 seconds, calls report_production on a hardcoded test asset_id
 * with a random amount between 50-200.
 */

const { Contract, Keypair, Networks, rpc: StellarRpc, TransactionBuilder, nativeToScVal, BASE_FEE, Address } = require('@stellar/stellar-sdk');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const NETWORK_PASSPHRASE = Networks.TESTNET;
const RPC_URL = process.env.RPC_URL || 'https://soroban-testnet.stellar.org';

// Load contract IDs from deployed_addresses.txt
function loadAddresses() {
  const addrFile = path.join(__dirname, '..', 'deployed_addresses.txt');
  if (!fs.existsSync(addrFile)) {
    console.error('❌ deployed_addresses.txt not found. Deploy contracts first.');
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

async function reportProduction() {
  const addresses = loadAddresses();
  const registryId = addresses.ENERGY_REGISTRY;
  const reporterSecretKey = process.env.REPORTER_SECRET_KEY;

  if (!registryId) {
    console.error('❌ ENERGY_REGISTRY not found in deployed_addresses.txt');
    return;
  }
  if (!reporterSecretKey) {
    console.error('❌ REPORTER_SECRET_KEY not set in .env. Cannot sign transactions.');
    return;
  }

  const server = new StellarRpc.Server(RPC_URL);
  const reporterKeypair = Keypair.fromSecret(reporterSecretKey);
  const reporterAddress = reporterKeypair.publicKey();

  const testAssetId = parseInt(process.env.TEST_ASSET_ID || '1', 10);
  const amount = Math.floor(Math.random() * 151) + 50; // 50-200

  console.log(`[${new Date().toISOString()}] Reporting ${amount} kWh for asset #${testAssetId} via ${reporterAddress.slice(0, 10)}...`);

  try {
    const account = await server.getAccount(reporterAddress);
    const contract = new Contract(registryId);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call(
          'report_production',
          nativeToScVal(testAssetId, { type: 'u64' }),
          nativeToScVal(amount, { type: 'u64' }),
          new Address(reporterAddress).toScVal()
        )
      )
      .setTimeout(30)
      .build();

    const simResult = await server.simulateTransaction(tx);
    if (StellarRpc.Api.isSimulationError(simResult)) {
      throw new Error(`Simulation failed: ${simResult.error}`);
    }

    const preparedTx = StellarRpc.assembleTransaction(tx, simResult).build();
    preparedTx.sign(reporterKeypair);

    const result = await server.sendTransaction(preparedTx);
    console.log(`[${new Date().toISOString()}] ✅ Transaction sent: ${result.hash}`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ❌ Error:`, err.message);
  }
}

console.log('🔆 Oracle simulator started. Reporting every 30 seconds...');
reportProduction();
setInterval(reportProduction, 30_000);
