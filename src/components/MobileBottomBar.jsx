import React from 'react';
import { Phone, Home } from 'lucide-react';
import { trackPhoneClick } from '@/lib/tracking';

export default function MobileBottomBar() {
  const handleHomeValueClick = () => {
    const el = document.getElementById('home-value');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-accent/20" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
      <div className="flex items-stretch min-h-[56px]">
        <a
          href="tel:6192772766"
          onClick={trackPhoneClick}
          className="flex-1 flex items-center justify-center gap-2 bg-[#8B3018] hover:bg-[#702613] text-white font-bold text-[16px] transition-colors"
        >
          <Phone className="w-5 h-5" />
          Call George Now
        </a>
        <button
          onClick={handleHomeValueClick}
          className="flex-1 flex items-center justify-center gap-2 bg-[#C8920A] hover:bg-[#B38209] text-[#12202A] font-bold text-[16px] transition-colors"
        >
          <Home className="w-5 h-5" />
          Free Home Value
        </button>
      </div>
    </div>
  );
}
