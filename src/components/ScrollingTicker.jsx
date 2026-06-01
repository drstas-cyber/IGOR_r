import React from 'react';

export default function ScrollingTicker() {
  const content = "🏡 Temecula Valley homes for sale 🌟 George Khazanovskiy — Five-Star Reviewed Realtor 🗣️ Russian & Ukrainian spoken ⚡ Free home valuation & buyer consultation 📞 (619) 277-2766      |      ";

  return (
    <div
      role="complementary"
      aria-label="Highlights"
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
