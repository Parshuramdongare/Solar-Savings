"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const REGISTRY = process.env.NEXT_PUBLIC_ENERGY_REGISTRY || "CDBAP3YS3SONYSZVG3NQ64ZAL7A2VDXGSDK6FFLU4G7I7OMY3W3MBI2F";

type Asset = {
  asset_id: number;
  owner: string;
  event_ledger: number;
  created_at?: string;
};

type TxState = "idle" | "submitting" | "confirmed" | "failed";

export default function HomePage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [txState, setTxState] = useState<TxState>("idle");
  const [error, setError] = useState("");

  async function fetchAssets() {
    try {
      const res = await fetch(`${API}/assets`);
      const data = await res.json();
      setAssets(data.assets || []);
    } catch (_) {}
    setLoading(false);
  }

  useEffect(() => { fetchAssets(); }, []);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !capacity) { setError("Name and capacity are required."); return; }
    setError("");
    setTxState("submitting");
    try {
      // In a real dApp this would invoke the contract via Freighter wallet
      // For demo purposes we simulate a 2-second transaction
      await new Promise(r => setTimeout(r, 2000));
      setTxState("confirmed");
      setShowForm(false);
      setName(""); setCapacity("");
      setTimeout(() => { setTxState("idle"); fetchAssets(); }, 2500);
    } catch {
      setTxState("failed");
      setTimeout(() => setTxState("idle"), 3000);
    }
  }

  return (
    <div>
      {/* Hero */}
      <div className="mb-10" style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "2.5rem", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "0.5rem" }}>
          ☀️ Solar Energy Registry
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "1.05rem", maxWidth: 520, margin: "0 auto" }}>
          Register solar assets, track production on-chain, and earn carbon credits automatically.
        </p>
        <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
          <span className="badge badge-amber">Soroban Smart Contracts</span>
          <span className="badge badge-blue">Stellar Testnet</span>
          <span className="badge badge-green">Live Oracle</span>
        </div>
      </div>

      {/* Contract address */}
      <div className="glass p-4 mb-6" style={{ fontSize: "0.8rem" }}>
        <span style={{ color: "var(--muted)" }}>Registry Contract: </span>
        <a href={`https://stellar.expert/explorer/testnet/contract/${REGISTRY}`}
          target="_blank" rel="noreferrer"
          style={{ color: "var(--accent2)", fontFamily: "monospace", wordBreak: "break-all" }}>
          {REGISTRY}
        </a>
      </div>

      {/* Register button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h2 style={{ fontWeight: 700, fontSize: "1.2rem" }}>
          Registered Assets <span style={{ color: "var(--muted)", fontWeight: 400 }}>({assets.length})</span>
        </h2>
        <button id="btn-register-new" className="btn-primary" onClick={() => setShowForm(f => !f)}>
          {showForm ? "Cancel" : "+ Register Asset"}
        </button>
      </div>

      {/* Register form */}
      {showForm && (
        <div className="card slide-in mb-6" style={{ borderColor: "var(--accent)" }}>
          <h3 style={{ fontWeight: 700, marginBottom: "1rem" }}>New Solar Asset</h3>
          <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ fontSize: "0.85rem", color: "var(--muted)", display: "block", marginBottom: 6 }}>
                Asset Name
              </label>
              <input id="input-asset-name" className="input" placeholder="e.g. Rooftop Array A"
                value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: "0.85rem", color: "var(--muted)", display: "block", marginBottom: 6 }}>
                Capacity (kW)
              </label>
              <input id="input-asset-capacity" className="input" type="number" placeholder="e.g. 500"
                value={capacity} onChange={e => setCapacity(e.target.value)} />
            </div>
            {error && <p style={{ color: "var(--red)", fontSize: "0.85rem" }}>{error}</p>}
            <button id="btn-submit-register" className="btn-primary" type="submit"
              disabled={txState === "submitting"} style={{ alignSelf: "flex-start" }}>
              {txState === "idle" && "Register Asset"}
              {txState === "submitting" && "⏳ Submitting..."}
              {txState === "confirmed" && "✅ Confirmed ✅"}
              {txState === "failed" && "❌ Failed ❌"}
            </button>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
              ⚠️ In production this triggers a Freighter wallet signature. Demo mode simulates the transaction.
            </p>
          </form>
        </div>
      )}

      {/* Transaction status banner */}
      {txState === "confirmed" && (
        <div className="slide-in" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid var(--green)",
          borderRadius: 12, padding: "0.75rem 1.25rem", marginBottom: "1rem", color: "var(--green)", fontWeight: 600 }}>
          ✅ Asset registered on-chain! Confirmed.
        </div>
      )}
      {txState === "failed" && (
        <div className="slide-in" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid var(--red)",
          borderRadius: 12, padding: "0.75rem 1.25rem", marginBottom: "1rem", color: "var(--red)", fontWeight: 600 }}>
          ❌ Transaction failed. Please try again.
        </div>
      )}

      {/* Assets list */}
      {loading ? (
        <div style={{ textAlign: "center", color: "var(--muted)", padding: "3rem" }}>Loading assets…</div>
      ) : assets.length === 0 ? (
        <div className="glass" style={{ textAlign: "center", padding: "3rem", color: "var(--muted)" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🌤️</div>
          <p>No assets registered yet. Start by registering your first solar asset.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
          {assets.map(asset => (
            <Link key={asset.asset_id} href={`/asset/${asset.asset_id}`} style={{ textDecoration: "none" }}>
              <div id={`asset-card-${asset.asset_id}`} className="card" style={{ cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                  <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>Asset #{asset.asset_id}</span>
                  <span className="badge badge-green">Active</span>
                </div>
                <p style={{ fontSize: "0.8rem", color: "var(--muted)", fontFamily: "monospace", wordBreak: "break-all", marginBottom: "0.75rem" }}>
                  {typeof asset.owner === "string" ? asset.owner.slice(0, 40) + "…" : JSON.stringify(asset.owner).slice(0, 40)}
                </p>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                  <span style={{ color: "var(--muted)" }}>Ledger #{asset.event_ledger}</span>
                  <span style={{ color: "var(--accent2)" }}>View details →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
