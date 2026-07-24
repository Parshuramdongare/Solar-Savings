"use client";
import { useState, useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const SPLITTER = process.env.NEXT_PUBLIC_PAYOUT_SPLITTER || "CC4HM56NIABMOTX3RF2C3PNTZI24CVJ6UXNAOT6ZKMCZX2RPZHVU3RI3";

type TxState = "idle" | "submitting" | "confirmed" | "failed";

export default function BuyerPage() {
  const [depositAmount, setDepositAmount] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [txState, setTxState] = useState<TxState>("idle");
  const [poolBalance, setPoolBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchPoolBalance() {
    setBalanceLoading(true);
    try {
      const res = await fetch(`${API}/balances/${SPLITTER}`);
      const data = await res.json();
      setPoolBalance(data.balance_estimate ?? 0);
    } catch (_) {
      setPoolBalance(null);
    }
    setBalanceLoading(false);
  }

  useEffect(() => { fetchPoolBalance(); }, []);

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      setError("Please enter a valid deposit amount.");
      return;
    }
    if (!buyerAddress) {
      setError("Please enter your Stellar address.");
      return;
    }
    setError("");
    setTxState("submitting");
    try {
      // In production: invoke payout-splitter::buyer_deposit via Freighter
      await new Promise(r => setTimeout(r, 2000));
      setTxState("confirmed");
      setDepositAmount("");
      setTimeout(() => { setTxState("idle"); fetchPoolBalance(); }, 3000);
    } catch {
      setTxState("failed");
      setTimeout(() => setTxState("idle"), 3000);
    }
  }

  const buttonLabel = () => {
    if (txState === "submitting") return "⏳ Submitting...";
    if (txState === "confirmed") return "✅ Confirmed ✅";
    if (txState === "failed") return "❌ Failed ❌";
    return "Deposit to Buyer Pool";
  };

  const buttonStyle = () => {
    if (txState === "confirmed") return { background: "var(--green)", color: "#fff" };
    if (txState === "failed") return { background: "var(--red)", color: "#fff" };
    return {};
  };

  return (
    <div>
      <h1 style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "0.5rem" }}>
        💧 Buyer Pool
      </h1>
      <p style={{ color: "var(--muted)", marginBottom: "2rem", maxWidth: 520 }}>
        Deposit funds into the solar credits buyer pool. Your deposit will be split 70/15/15
        between producers, maintenance, and the pool when credits are settled.
      </p>

      {/* Contract reference */}
      <div className="glass p-4 mb-6" style={{ fontSize: "0.8rem" }}>
        <span style={{ color: "var(--muted)" }}>Payout Splitter Contract: </span>
        <a href={`https://stellar.expert/explorer/testnet/contract/${SPLITTER}`}
          target="_blank" rel="noreferrer"
          style={{ color: "var(--accent2)", fontFamily: "monospace", wordBreak: "break-all" }}>
          {SPLITTER}
        </a>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", alignItems: "start" }}
        className="responsive-grid">

        {/* Deposit form */}
        <div className="card" style={{ borderColor: "var(--accent2)" }}>
          <h2 style={{ fontWeight: 700, marginBottom: "1.25rem", fontSize: "1.1rem" }}>Make a Deposit</h2>
          <form onSubmit={handleDeposit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ fontSize: "0.85rem", color: "var(--muted)", display: "block", marginBottom: 6 }}>
                Your Stellar Address
              </label>
              <input id="input-buyer-address" className="input" placeholder="G..."
                value={buyerAddress} onChange={e => setBuyerAddress(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: "0.85rem", color: "var(--muted)", display: "block", marginBottom: 6 }}>
                Deposit Amount (XLM)
              </label>
              <input id="input-deposit-amount" className="input" type="number" min="0.01" step="0.01"
                placeholder="e.g. 100"
                value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
            </div>
            {error && <p style={{ color: "var(--red)", fontSize: "0.85rem" }}>{error}</p>}
            <button id="btn-deposit" className="btn-primary" type="submit"
              disabled={txState === "submitting"}
              style={{ ...buttonStyle() }}>
              {buttonLabel()}
            </button>
            {txState === "confirmed" && (
              <div className="slide-in" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid var(--green)",
                borderRadius: 10, padding: "0.6rem 1rem", color: "var(--green)", fontSize: "0.85rem", fontWeight: 600 }}>
                ✅ Deposit confirmed on Stellar testnet!
              </div>
            )}
            {txState === "failed" && (
              <div className="slide-in" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid var(--red)",
                borderRadius: 10, padding: "0.6rem 1rem", color: "var(--red)", fontSize: "0.85rem", fontWeight: 600 }}>
                ❌ Transaction failed. Please try again.
              </div>
            )}
            <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
              ⚠️ Demo mode — sign with Freighter in production to submit a real transaction.
            </p>
          </form>
        </div>

        {/* Pool stats */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="stat-card" style={{ cursor: "pointer" }} onClick={fetchPoolBalance}>
            <span className="stat-label">Buyer Pool Balance</span>
            <span className="stat-value">
              {balanceLoading ? "…" : poolBalance !== null ? poolBalance.toLocaleString() : "—"}
            </span>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 4 }}>
              Estimated from indexed events · click to refresh
            </span>
          </div>

          <div className="card">
            <h3 style={{ fontWeight: 700, marginBottom: "1rem", fontSize: "0.95rem" }}>Split Allocation</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {[
                { label: "⚡ Producers", pct: 70, color: "var(--accent)" },
                { label: "🔧 Maintenance", pct: 15, color: "var(--accent2)" },
                { label: "💧 Buyer Pool", pct: 15, color: "var(--green)" },
              ].map(({ label, pct, color }) => (
                <div key={label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: "0.85rem" }}>
                    <span style={{ color: "var(--muted)" }}>{label}</span>
                    <span style={{ fontWeight: 700, color }}>{pct}%</span>
                  </div>
                  <div style={{ background: "var(--surface2)", borderRadius: 6, height: 6, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 6 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: "1rem 1.25rem" }}>
            <p style={{ fontSize: "0.82rem", color: "var(--muted)", lineHeight: 1.6 }}>
              <strong style={{ color: "var(--text)" }}>How it works:</strong> Every time an energy asset crosses 
              1,000 kWh of cumulative production, credits are minted and <code>settle()</code> is called 
              automatically via cross-contract call. The payout splits are enforced on-chain.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .responsive-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
