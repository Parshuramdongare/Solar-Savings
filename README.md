# Solar Savings dApp

Solar Savings is a decentralized application on the Stellar blockchain that tracks solar energy production, mints carbon credits, and distributes payouts to producers, maintenance funds, and buyers — all via auditable on-chain logic.

The system combines two Soroban smart contracts, an oracle simulator, an event indexer, and a Next.js web interface to form a complete end-to-end renewable energy incentive platform.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Solar Savings dApp                          │
│                                                                     │
│   ┌──────────────┐    report_production()    ┌──────────────────┐   │
│   │  oracle-sim  │ ─────────────────────────►│ energy-registry  │   │
│   │  (Node.js)   │                           │ (Soroban WASM)   │   │
│   └──────────────┘                           │                  │   │
│                                              │ mint credits ──► │   │
│   ┌──────────────┐    getEvents (RPC poll)   │ settle() ──────► │   │
│   │  indexer.js  │ ◄─────────────────────────┤                  │   │
│   │  (Node.js)   │                           └────────┬─────────┘   │
│   └──────┬───────┘                                    │             │
│          │ events.db                       cross-contract call       │
│   ┌──────▼───────┐                                    ▼             │
│   │  server.js   │                          ┌──────────────────┐   │
│   │  (Express)   │                          │ payout-splitter   │   │
│   │  :4000       │                          │ (Soroban WASM)   │   │
│   └──────┬───────┘                          │ 70/15/15 split   │   │
│          │ REST API                          └──────────────────┘   │
│   ┌──────▼───────┐                                                  │
│   │  Next.js     │ ◄── User interactions (register, deposit)        │
│   │  Frontend    │                                                  │
│   │  :3000       │                                                  │
│   └──────────────┘                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

## Oracle / Trust Model

Production reporting in this system relies on a **single trusted reporter address** stored in the `energy-registry` contract. Only this address (set at initialization) can call `report_production`. This is a deliberate simplification: in production, this would be replaced with a decentralized oracle network, threshold multi-sig, or ZK proof of meter readings. For this submission, the oracle trust model is explicit and transparent — the reporter's identity is on-chain and immutable without an admin `set_reporter` call.

## Setup Instructions

### Prerequisites
- Rust + `wasm32v1-none` target (`rustup target add wasm32v1-none`)
- Stellar CLI v25+ (`stellar --version`)
- Node.js 20+

### Environment Variables
Copy `.env` to your backend dir and fill in:
```env
RPC_URL=https://soroban-testnet.stellar.org
REPORTER_SECRET_KEY=<your reporter secret>
TEST_ASSET_ID=1
PORT=4000
```

### Install & Run

```bash
# 1. Build & test contracts
cd contracts
cargo test
stellar contract build

# 2. Deploy (already done — see deployed_addresses.txt)
stellar contract deploy --wasm target/wasm32v1-none/release/payout_splitter.wasm --source deployer --network testnet
stellar contract deploy --wasm target/wasm32v1-none/release/energy_registry.wasm  --source deployer --network testnet

# 3. Initialize contracts (run once after deploy)
stellar contract invoke --id <ENERGY_REGISTRY> --source deployer --network testnet -- initialize \
  --admin <ADMIN_ADDRESS> --reporter <REPORTER_ADDRESS>

stellar contract invoke --id <PAYOUT_SPLITTER> --source deployer --network testnet -- initialize \
  --admin <ADMIN_ADDRESS> --registry_address <ENERGY_REGISTRY>

# 4. Backend
cd backend
npm install
node indexer.js &    # Start event indexer
node oracle-sim.js & # Start oracle simulator
node server.js       # Start API server

# 5. Frontend
cd frontend
npm install
npm run dev
```

## Contract Addresses (Testnet)

| Contract | Address |
|---|---|
| energy-registry | `CDBAP3YS3SONYSZVG3NQ64ZAL7A2VDXGSDK6FFLU4G7I7OMY3W3MBI2F` |
| payout-splitter | `CC4HM56NIABMOTX3RF2C3PNTZI24CVJ6UXNAOT6ZKMCZX2RPZHVU3RI3` |
| Deployer | `GBQVWRKSE2LQ6GJ2VO6YMZQE45LC3SKDLXUGC2C2KCWKN65A2XH24TVI` |
| Network | Stellar Testnet |

Explorer links:
- [energy-registry on stellar.expert](https://stellar.expert/explorer/testnet/contract/CDBAP3YS3SONYSZVG3NQ64ZAL7A2VDXGSDK6FFLU4G7I7OMY3W3MBI2F)
- [payout-splitter on stellar.expert](https://stellar.expert/explorer/testnet/contract/CC4HM56NIABMOTX3RF2C3PNTZI24CVJ6UXNAOT6ZKMCZX2RPZHVU3RI3)

## Screenshots

### Mobile UI
> _[placeholder — run `npm run dev` in `frontend/` and capture screenshot]_

### CI Run
> _[placeholder — see Actions tab after pushing to `main`]_

### Test Output
```
running 5 tests
test test::test_register_success ... ok
test test::test_cross_contract_call_fires ... ok
test test::test_threshold_mint_triggers_correctly ... ok
test test::test_duplicate_invalid_reject - should panic ... ok
test test::test_non_reporter_rejected - should panic ... ok
test result: ok. 5 passed; 0 failed; 0 ignored; finished in 0.38s

running 3 tests
test test::test_split_math_70_15_15 ... ok
test test::test_split_math_100_0_0 ... ok
test test::test_non_registry_caller_rejected_on_settle - should panic ... ok
test result: ok. 3 passed; 0 failed; 0 ignored; finished in 0.29s
```
