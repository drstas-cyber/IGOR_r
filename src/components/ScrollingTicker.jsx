import React from 'react';

export default function ScrollingTicker() {
  const content = "🏡 Temecula Median: $740,000 📈 176 Homes Sold Jan 2026 — Up 12.1% YoY ⚡ Hot Homes Sell in 25 Days 📊 Sale-to-List: 100.1% of Asking 🌟 George: Five-Star Reviewed 🏠 Inventory: 1.27 Months — Seller's Market \u00A0\u00A0\u00A0\u00A0\u00A0|\u00A0\u00A0\u00A0\u00A0\u00A0 ";

  return (
    <div 
      style={{ backgroundColor: '#0D2E3A', color: '#C8920A' }}
      className="py-3 overflow-hidden whitespace-nowrap font-sans text-[14px] z-50 relative border-b border-accent/20"
    >
      <div className="ticker-track inline-block">
        {/* Duplicate content to create the seamless infinite scroll effect */}
        <span>{content}</span>
        <span>{content}</span>
        <span>{content}</span>
        <span>{content}</span>
      </div>
    </div>
  );
}