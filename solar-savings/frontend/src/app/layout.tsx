import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Solar Savings dApp",
  description: "Track solar energy production, mint carbon credits, and earn payouts on Stellar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <nav className="nav px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span style={{ fontSize: "1.5rem" }}>☀️</span>
              <span style={{ fontWeight: 800, fontSize: "1.1rem", letterSpacing: "-0.02em" }}>
                Solar<span style={{ color: "var(--accent)" }}>Savings</span>
              </span>
            </Link>
            <div className="flex items-center gap-6" style={{ fontSize: "0.9rem", fontWeight: 600 }}>
              <Link href="/" style={{ color: "var(--muted)", transition: "color 0.2s" }}
                className="hover:text-white">Assets</Link>
              <Link href="/buyer" style={{ color: "var(--muted)", transition: "color 0.2s" }}
                className="hover:text-white">Buyer Pool</Link>
              <span className="badge badge-green">
                <span className="live-dot" style={{ width: 6, height: 6 }}></span>Testnet
              </span>
            </div>
          </div>
        </nav>
        <main className="max-w-5xl mx-auto px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
