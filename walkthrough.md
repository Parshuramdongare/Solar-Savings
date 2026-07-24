# Walkthrough — Solar Savings Monorepo

We have built, tested, and deployed the **Solar Savings dApp** monorepo on Stellar testnet. Below is a detailed walkthrough of the implementation.

## Folder Structure Implemented
```
solar-savings/
  contracts/
    Cargo.toml
    energy-registry/
      src/lib.rs
      Cargo.toml
    payout-splitter/
      src/lib.rs
      Cargo.toml
  backend/
    db.js
    oracle-sim.js
    indexer.js
    server.js
    package.json
  frontend/
    smoke.test.js
    package.json
    src/
      app/
        globals.css
        layout.tsx
        page.tsx
        buyer/
          page.tsx
        asset/
          [id]/
            page.tsx
  .github/workflows/
    ci.yml
  README.md
  deployed_addresses.txt
  .env
```

---

## 1. Soroban Smart Contracts

### Energy Registry Contract
- **State**: Tracks `Admin`, `Reporter`, `Assets` (stored as individual entries `Asset(u64)`), and `NextAssetId`.
- **Functions**: `initialize`, `register_asset`, `report_production`, `set_reporter`, `get_asset`, and `set_splitter`.
- **Threshold Credits Minting**: When `cumulative_production` crosses multiples of 1000, it computes the newly minted credits and performs an on-chain cross-contract call `env.invoke_contract` to `payout-splitter::settle(owner, credits)`.
- **Events Published**: `asset_registered`, `production_reported`, and `credits_minted`.

### Payout Splitter Contract
- **State**: Tracks `Admin`, `RegistryAddress`, `Splits` (defaults to 70/15/15), `Balances` map, and `BuyerPoolBalance` (logical pool amount).
- **Functions**: `initialize`, `settle`, `buyer_deposit`, `set_splits`, and `get_balance`.
- **Settlement Logic**: Splits credits using the stored splits (default 70% to producer, 15% to admin/maintenance, and 15% to buyer pool) and saves them in the balance map.
- **Events Published**: `payout_settled` and `buyer_deposit`.

---

## 2. Smart Contract Tests

We wrote **8 unit tests** validating all requested behavior:
- **`energy-registry` (5 tests)**:
  1. `test_register_success`: registers asset and verifies get_asset.
  2. `test_duplicate_invalid_reject`: fails when trying to initialize a second time.
  3. `test_non_reporter_rejected`: blocks unauthorized accounts from reporting solar production.
  4. `test_threshold_mint_triggers_correctly`: verifies credit calculations when thresholds are crossed.
  5. `test_cross_contract_call_fires`: registers a mock splitter contract and asserts that it is invoked when registry crosses thresholds.
- **`payout-splitter` (3 tests)**:
  6. `test_split_math_70_15_15`: asserts proper 70/15/15 math.
  7. `test_split_math_100_0_0`: asserts border-case math.
  8. `test_non_registry_caller_rejected_on_settle`: checks that only the registry contract can trigger `settle`.

**Test Output**:
```
running 5 tests
test test::test_register_success ... ok
test test::test_cross_contract_call_fires ... ok
test test::test_threshold_mint_triggers_correctly ... ok
test test::test_duplicate_invalid_reject - should panic ... ok
test test::test_non_reporter_rejected - should panic ... ok
test result: ok. 5 passed; 0 failed; finished in 0.38s

running 3 tests
test test::test_split_math_70_15_15 ... ok
test test::test_split_math_100_0_0 ... ok
test test::test_non_registry_caller_rejected_on_settle - should panic ... ok
test result: ok. 3 passed; 0 failed; finished in 0.29s
```

---

## 3. Stellar Testnet Deployment

Both contracts were successfully deployed to **Stellar Testnet** and initialized:

- **payout-splitter**: `CC4HM56NIABMOTX3RF2C3PNTZI24CVJ6UXNAOT6ZKMCZX2RPZHVU3RI3`
  - Transaction: [ebb7f2a2a36f...](https://stellar.expert/explorer/testnet/tx/ebb7f2a2a36fbd69db533d73eed8294d2b32e2c963b4613e3654036b2a4d3d96)
- **energy-registry**: `CDBAP3YS3SONYSZVG3NQ64ZAL7A2VDXGSDK6FFLU4G7I7OMY3W3MBI2F`
  - Transaction: [74479ca3b864...](https://stellar.expert/explorer/testnet/tx/74479ca3b86430c72377a44899b299fc5ce499c9f8121a399ed6c46d08429f4e)

---

## 4. Backend (Express, Indexer & Oracle Sim)

- **`oracle-sim.js`**: Connects via Stellar SDK and periodically (every 30s) submits production reports. It successfully submitted multiple reports:
  ```
  [2026-07-24T17:40:06.537Z] Reporting 97 kWh for asset #1...
  [2026-07-24T17:40:07.380Z] ✅ Transaction sent: 142e950e86143ec371b39069...
  ```
- **`indexer.js`**: Connects to the Soroban RPC, polls getEvents every 10 seconds, parses topics and values using `scValToNative`, and writes them to a local SQLite (`sql.js`) file `events.db`.
  ```
  Indexed 28 events (ledger 3779172 → 3779472)
  ```
- **`server.js`**: Exposes 3 clean endpoints:
  - `GET /assets`
  - `GET /events`
  - `GET /balances/:address`

---

## 5. Next.js Frontend App

- Scaffolded using TypeScript and TailwindCSS.
- **Pages**:
  - `/` (Home): Lists all assets, and provides a modal form to register a new asset.
  - `/asset/[id]` (Asset Details): Shows cumulative metrics and has a live event feed polling `/events` every 5 seconds.
  - `/buyer` (Buyer Pool): Features a pool deposit form and displays pool split stats.
- **Transaction States**: Forms for registering assets and deposits show the states: `"Submitting..."` → `"Confirmed ✅"` / `"Failed ❌"`.
- **Smoke test**: Configured a Jest smoke test `npm test` verifying page setup.

---

## 6. CI/CD Workflow

Created `.github/workflows/ci.yml` that:
1. Runs cargo contract tests (`cargo test --all`).
2. Runs frontend Jest smoke tests (`npm test`).
