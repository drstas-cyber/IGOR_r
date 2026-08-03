import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Phone } from 'lucide-react';
import { trackSearchHomesClick } from '@/lib/tracking';
import { apexAdvancedSearchUrl } from '@/lib/apexSearch';

// Outbound MLS search (ApexIDX). New tab; rel="noopener noreferrer" — the site's
// Referrer-Policy (strict-origin-when-cross-origin) already caps any cross-origin
// referrer to the bare origin, so dropping the path/query via noreferrer loses no
// attribution ApexIDX didn't already lack; utm_content on the URL is the real signal.
const APEX_SEARCH_NAV_URL = apexAdvancedSearchUrl('nav');

export default function StickyNavigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
  // #home-value only exists on the homepage (HomeValueForm isn't rendered on
  // every page). On the homepage, plain "#home-value" scrolls in place. On
  // any other page, "/#home-value" is a full <a> page navigation that lands
  // on the homepage with the hash already set; HomePage's own effect handles
  // the actual scroll once React has rendered the target (see HomePage.jsx).
  const homeValueHref = location.pathname === '/' ? '#home-value' : '/#home-value';

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Search Homes', href: APEX_SEARCH_NAV_URL, external: true },
    { label: 'Home Value', href: homeValueHref },
    { label: 'About George', href: '#about-george' },
    { label: 'Blog', href: '/blog/' },
    { label: 'Contact', href: '#contact' }
  ];

  const linkClass =
    'text-[14px] text-foreground font-medium hover:text-accent relative after:absolute after:bottom-[-4px] after:left-0 after:w-full after:h-[2px] after:bg-accent after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:origin-left transition-colors';

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
            {navLinks.map((link) => (
              link.external ? (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackSearchHomesClick('nav')}
                  className={linkClass}
                >
                  {link.label} ↗
                </a>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  className={linkClass}
                >
                  {link.label}
                </a>
              )
            ))}
          </div>

          <div className="flex items-center gap-5">
            <a href={homeValueHref}>
              <Button className="bg-accent hover:bg-accent/90 text-white rounded text-[14px] px-5 py-2 h-auto transition-transform hover:scale-105">
                Free Home Value
              </Button>
            </a>
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
          {navLinks.map((link) => (
            link.external ? (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackSearchHomesClick('nav')}
                className="text-[13px] whitespace-nowrap text-foreground font-medium hover:text-accent"
              >
                {link.label} ↗
              </a>
            ) : (
              <a
                key={link.label}
                href={link.href}
                className="text-[13px] whitespace-nowrap text-foreground font-medium hover:text-accent"
              >
                {link.label}
              </a>
            )
          ))}
        </div>
      </div>
    </nav>
  );
}
