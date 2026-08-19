import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Phone } from 'lucide-react';
import { trackSearchHomesClick } from '@/lib/tracking';
import { homeHashHref } from '@/lib/homeSectionScroll';
import { STICKY_NAV_ITEMS } from '@/lib/navItems';

export default function StickyNavigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
  const homeValueHref = homeHashHref('home-value', location.pathname);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const linkClass =
    'text-[14px] text-foreground font-medium hover:text-accent relative after:absolute after:bottom-[-4px] after:left-0 after:w-full after:h-[2px] after:bg-accent after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:origin-left transition-colors';

  // renderNavItem — one render function shared by the desktop and mobile
  // blocks below (previously two independently-hand-maintained <a> lists
  // rendering the same navLinks array — now genuinely one code path).
  function renderNavItem(item, className) {
    if (item.external) {
      return (
        <a
          key={item.label}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackSearchHomesClick('nav')}
          className={className}
        >
          {item.label} ↗
        </a>
      );
    }
    const to = item.to ?? homeHashHref(item.sectionId, location.pathname);
    return (
      <Link key={item.label} to={to} className={className}>
        {item.label}
      </Link>
    );
  }

  return (
    <nav
      className={`sticky top-0 z-40 bg-background transition-all duration-300 ${
        isScrolled ? 'py-2 shadow-lg' : 'py-5 shadow-sm'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="hidden md:flex items-center justify-between">

          <div className="flex flex-col cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className={`font-serif text-[#12202A] transition-all duration-300 ${isScrolled ? 'text-xl' : 'text-2xl'}`}>
              Temecula Valley Homes
            </div>
            <p className={`text-muted-foreground transition-all duration-300 ${isScrolled ? 'text-[10px]' : 'text-[12px]'}`}>
              George Khazanovskiy · Realtor® · DRE #02034120
            </p>
          </div>

          <div className="flex items-center gap-6">
            {STICKY_NAV_ITEMS.map((item) => renderNavItem(item, linkClass))}
          </div>

          <div className="flex items-center gap-5">
            <Link to={homeValueHref}>
              <Button className="bg-accent hover:bg-accent/90 text-white rounded text-[14px] px-5 py-2 h-auto transition-transform hover:scale-105">
                Free Home Value
              </Button>
            </Link>
            <a
              href="tel:+16192772766"
              className="flex items-center gap-2 text-[#12202A] hover:text-accent font-semibold text-[14px] transition-colors"
            >
              <Phone className="w-4 h-4" />
              (619) 277-2766
            </a>
          </div>

        </div>

        {/* Mobile: compact, always-visible primary links */}
        <div className="flex md:hidden items-center justify-between gap-2 overflow-x-auto">
          {STICKY_NAV_ITEMS.map((item) => renderNavItem(item, 'text-[13px] whitespace-nowrap text-foreground font-medium hover:text-accent'))}
        </div>
      </div>
    </nav>
  );
}
