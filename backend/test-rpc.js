const { rpc: StellarRpc } = require('@stellar/stellar-sdk');

const RPC_URL = 'https://soroban-testnet.stellar.org';
const contractId = 'CDBAP3YS3SONYSZVG3NQ64ZAL7A2VDXGSDK6FFLU4G7I7OMY3W3MBI2F'; // Registry ID

async function main() {
  const server = new StellarRpc.Server(RPC_URL);
  try {
    console.log('Fetching latest ledger...');
    const latestLedger = await server.getLatestLedger();
    console.log('Latest ledger sequence:', latestLedger.sequence);

    const startLedger = Math.max(1, latestLedger.sequence - 300);
    console.log(`Polling from ledger ${startLedger} to ${latestLedger.sequence}...`);

    const response = await server.getEvents({
      startLedger,
      filters: [{
        type: 'contract',
        contractIds: [contractId]
      }],
      limit: 50
    });

    console.log(`Found ${response.events?.length || 0} events.`);
    if (response.events) {
      response.events.forEach((ev, idx) => {
        console.log(`Event #${idx}: type=${ev.type}, ledger=${ev.ledger}`);
        console.log('Topic:', JSON.stringify(ev.topic));
        console.log('Value:', JSON.stringify(ev.value));
      });
    }
  } catch (err) {
    console.error('Error fetching events:', err);
  }
}

main();
