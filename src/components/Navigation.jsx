import React from 'react';
import { Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { trackSearchHomesClick } from '@/lib/tracking';
import { SUBPAGE_NAV_ITEMS } from '@/lib/navItems';

export default function Navigation() {
  const ruLinkStyles = {
    backgroundColor: '#3A5420',
    color: 'white',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '600',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'opacity 0.2s ease',
  };

  const linkClass =
    'text-sm font-medium text-secondary-foreground hover:text-accent transition-colors relative after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-accent after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:origin-left';

  // Every SUBPAGE_NAV_ITEMS `sectionId` item resolves unconditionally to
  // "/#id" — this component is never rendered on the homepage itself (see
  // navItems.js's header comment), so there's no in-page/cross-page branch
  // to make, unlike StickyNavigation.
  function renderNavItem(item) {
    if (item.external) {
      return (
        <a
          key={item.label}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackSearchHomesClick('nav_subpage')}
          className={linkClass}
        >
          {item.label} ↗
        </a>
      );
    }
    const to = item.to ?? `/#${item.sectionId}`;
    return (
      <Link key={item.label} to={to} className={linkClass}>
        {item.label}
      </Link>
    );
  }

  return (
    <nav className="sticky top-0 z-50 bg-secondary/95 backdrop-blur-md shadow-md border-b border-accent/20 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="flex items-center justify-between py-5">
          <Link to="/" className="flex flex-col">
            <div className="text-2xl font-bold text-accent font-serif tracking-wide">George Khazanovskiy</div>
            <p className="text-xs text-secondary-foreground/70 uppercase tracking-widest mt-1">Temecula Valley</p>
          </Link>
          
          <div className="hidden md:flex items-center gap-6">
            {SUBPAGE_NAV_ITEMS.map((item) => renderNavItem(item))}
          </div>
          
          <div className="flex items-center gap-3">
            <Link 
              to="/russian-speaking-realtor-temecula" 
              style={ruLinkStyles}
              className="hover:opacity-90 whitespace-nowrap"
            >
              🇷🇺 RU
            </Link>

            <a href="tel:+16192772766">
              <Button className="bg-accent hover:bg-accent/90 text-secondary font-semibold uppercase tracking-wider text-xs px-6 py-5 rounded-none border border-accent">
                <span className="hidden sm:inline">Inquire Now</span>
                <span className="sm:hidden">Call</span>
              </Button>
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}