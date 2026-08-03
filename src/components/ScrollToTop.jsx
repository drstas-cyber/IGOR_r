import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { shouldScrollToTop } from '@/lib/scrollToTop';

// Router-level scroll-reset (audit item 4) -- replaces four separate,
// inconsistent per-component `window.scrollTo(0, 0)` effects
// (AboutGeorgePage, ContactPage, SellMyHousePage, RussianRealtorPage)
// that only covered 4 of 10 page components, leaving the other 6
// (including the homepage and every blog page) to silently retain
// whatever scroll offset the previous page left behind. Branch logic
// lives in src/lib/scrollToTop.js (unit-tested there) -- this component
// is just the thin React/effect wrapper.
//
// Renders nothing -- mount this once, inside <Router>, above <Routes>.
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (shouldScrollToTop({ navigationType, hash })) {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash, navigationType]);

  return null;
}
