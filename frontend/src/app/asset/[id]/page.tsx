"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Event = {
  id: number;
  contract_id: string;
  event_type: string;
  topic: string;
  value: string;
  ledger: number;
  created_at: string;
};

export default function AssetPage() {
  const params = useParams();
  const assetId = params?.id as string;
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [cumulativeProd, setCumulativeProd] = useState(0);
  const [creditsMinted, setCreditsMinted] = useState(0);
  const [lastUpdated, setLastUpdated] = useState("");

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`${API}/events?limit=100`);
      const data = await res.json();
      const all: Event[] = data.events || [];

      // Filter to asset-relevant events
      const relevant = all.filter(e =>
        e.event_type === "production_reported" ||
        e.event_type === "credits_minted" ||
        e.event_type === "payout_settled"
      );
      setEvents(relevant);

      // Calculate cumulative production from events
      let prod = 0, credits = 0;
      all.forEach(e => {
        if (e.event_type === "production_reported") {
          try { prod += parseInt(JSON.parse(e.value)?.u64 || e.value || 0); } catch { prod += 0; }
        }
        if (e.event_type === "credits_minted") {
          try { credits += parseInt(JSON.parse(e.value)?.u64 || e.value || 0); } catch { credits += 0; }
        }
      });
      setCumulativeProd(prod);
      setCreditsMinted(credits);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 5000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  const eventTypeColor = (t: string) => {
    if (t === "production_reported") return "badge-blue";
    if (t === "credits_minted") return "badge-amber";
    if (t === "payout_settled") return "badge-green";
    return "badge-blue";
  };

  const eventTypeIcon = (t: string) => {
    if (t === "production_reported") return "⚡";
    if (t === "credits_minted") return "🪙";
    if (t === "payout_settled") return "💸";
    if (t === "asset_registered") return "🌱";
    return "📋";
  };

  return (
    <div>
      <div style={{ marginBottom: "1.5rem" }}>
        <Link href="/" style={{ color: "var(--muted)", fontSize: "0.9rem", textDecoration: "none" }}>
          ← Back to Assets
        </Link>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.75rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
          Asset #{assetId}
        </h1>
        <span className="badge badge-green">Active</span>
      </div>
      <p style={{ color: "var(--muted)", marginBottom: "2rem" }}>
        Live production tracking and credit minting events for this solar asset.
      </p>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        <div className="stat-card">
          <span className="stat-value">{cumulativeProd.toLocaleString()}</span>
          <span className="stat-label">kWh Produced</span>
        </div>
        <div className="stat-card">
          <span className="stat-value" style={{ color: "var(--green)" }}>{creditsMinted}</span>
          <span className="stat-label">Credits Minted</span>
        </div>
        <div className="stat-card">
          <span className="stat-value" style={{ color: "var(--accent2)" }}>{events.length}</span>
          <span className="stat-label">Total Events</span>
        </div>
        <div className="stat-card">
          <span className="stat-value" style={{ fontSize: "1.1rem", color: "var(--muted)", marginTop: "0.2rem" }}>
            {cumulativeProd > 0 ? ((cumulativeProd / 1000) * 0.45).toFixed(2) : "0.00"}
          </span>
          <span className="stat-label">CO₂ Offset (kg)</span>
        </div>
      </div>

      {/* Live event feed */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={{ fontWeight: 700, fontSize: "1.1rem" }}>
          <span className="live-dot" style={{ marginRight: 8 }}></span>
          Live Event Feed
        </h2>
        <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
          Updated: {lastUpdated || "—"} · auto-refresh every 5s
        </span>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", color: "var(--muted)", padding: "3rem" }}>Loading events…</div>
      ) : events.length === 0 ? (
        <div className="glass" style={{ textAlign: "center", padding: "3rem", color: "var(--muted)" }}>
          <div style={{ fontSize: "2rem" }}>📡</div>
          <p>No events yet. The oracle simulator will report production every 30 seconds.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {events.map(ev => (
            <div key={ev.id} id={`event-${ev.id}`} className="card slide-in"
              style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "flex-start", gap: "1rem" }}>
              <span style={{ fontSize: "1.3rem", flexShrink: 0 }}>{eventTypeIcon(ev.event_type)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.3rem", flexWrap: "wrap" }}>
                  <span className={`badge ${eventTypeColor(ev.event_type)}`}>{ev.event_type}</span>
                  <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>Ledger #{ev.ledger}</span>
                </div>
                <p style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "var(--muted)", wordBreak: "break-all" }}>
                  {ev.value?.slice(0, 120)}{ev.value?.length > 120 ? "…" : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
