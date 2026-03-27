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
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-secondary border-t border-accent/20" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
      <div className="flex items-stretch min-h-[48px]">
        <a
          href="tel:6192772766"
          onClick={trackPhoneClick}
          className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-medium text-[14px] transition-colors"
        >
          <Phone className="w-4 h-4" />
          Call George
        </a>
        <button
          onClick={handleHomeValueClick}
          className="flex-1 flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 text-secondary font-medium text-[14px] transition-colors"
        >
          <Home className="w-4 h-4" />
          Home Value
        </button>
      </div>
    </div>
  );
}
