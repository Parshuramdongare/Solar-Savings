# Solar Savings dApp

## Live Demo

🚀 **Live URL**: [https://frontend-alpha-murex-33.vercel.app](https://frontend-alpha-murex-33.vercel.app)

Solar Savings is a decentralized application on the Stellar blockchain that tracks solar energy production, mints carbon credits, and distributes payouts to producers, maintenance funds, and buyers — all via auditable on-chain logic.

The system combines two Soroban smart contracts, an oracle simulator, an event indexer, and a Next.js web interface to form a complete end-to-end renewable energy incentive platform.

## Architecture

```text
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

## Contract Addresses & Transactions (Testnet)

| Contract / Entity | Address / Value | Explorer Link / Tx Hash |
|---|---|---|
| **energy-registry** | `CDBAP3YS3SONYSZVG3NQ64ZAL7A2VDXGSDK6FFLU4G7I7OMY3W3MBI2F` | [Contract Page](https://stellar.expert/explorer/testnet/contract/CDBAP3YS3SONYSZVG3NQ64ZAL7A2VDXGSDK6FFLU4G7I7OMY3W3MBI2F) |
| energy-registry Deployment | Tx: `a9a10f2d9d26f4a872e9593b7b0740784bbd7522a7206801957759f63a57cf20` | [Stellar Expert Tx](https://stellar.expert/explorer/testnet/tx/a9a10f2d9d26f4a872e9593b7b0740784bbd7522a7206801957759f63a57cf20) |
| **payout-splitter** | `CC4HM56NIABMOTX3RF2C3PNTZI24CVJ6UXNAOT6ZKMCZX2RPZHVU3RI3` | [Contract Page](https://stellar.expert/explorer/testnet/contract/CC4HM56NIABMOTX3RF2C3PNTZI24CVJ6UXNAOT6ZKMCZX2RPZHVU3RI3) |
| payout-splitter Deployment | Tx: `5fcaf0e0d589e71f9c3b6f39632a0cc97dae5c95288e30e7fe81b8453969c7ce` | [Stellar Expert Tx](https://stellar.expert/explorer/testnet/tx/5fcaf0e0d589e71f9c3b6f39632a0cc97dae5c95288e30e7fe81b8453969c7ce) |
| **Oracle report_production** | Tx: `142e950e86143ec371b39069f262c5f4d08b101ac10505178fe4f1be853aa7d8` | [Stellar Expert Tx](https://stellar.expert/explorer/testnet/tx/142e950e86143ec371b39069f262c5f4d08b101ac10505178fe4f1be853aa7d8) |
| Deployer Address | `GBQVWRKSE2LQ6GJ2VO6YMZQE45LC3SKDLXUGC2C2KCWKN65A2XH24TVI` | [Stellar Expert Account](https://stellar.expert/explorer/testnet/account/GBQVWRKSE2LQ6GJ2VO6YMZQE45LC3SKDLXUGC2C2KCWKN65A2XH24TVI) |
| Network | Stellar Testnet | |

## Screenshots

### Mobile UI

![Mobile UI](https://github.com/Parshuramdongare/Solar-Savings/blob/c12635c4e2b4384731f71845986dd0d6d6f77f7c/Screenshot%202026-07-24%20234435.png)

### CI Status

[![CI](https://github.com/Parshuramdongare/Solar-Savings/actions/workflows/ci.yml/badge.svg)](https://github.com/Parshuramdongare/Solar-Savings/actions)


### Test Output

```text
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
