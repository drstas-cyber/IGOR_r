import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { resolveHashRedirect } from '@/lib/homeSectionScroll';

// Cold-load safety net (2026-08-19 nav-hash audit) — the concrete repro
// that motivated this: cold-loading (or a bookmarked/shared link landing
// on) /blog/<any-article>/#contact, or the legacy /blog/<any-article>/
// #search, must never dead-end silently on the article page. Every nav
// component's own links are fixed to be route-aware (see StickyNavigation.
// jsx / Navigation.jsx), but a hash can also arrive via direct URL entry,
// bypassing the nav entirely -- this component is the app-wide backstop
// for that path.
//
// Pure decision logic lives in resolveHashRedirect() (src/lib/
// homeSectionScroll.js, unit-tested there); this is just the thin React/
// effect wrapper, same split as ScrollToTop.jsx/scrollToTop.js.
//
// Renders nothing -- mount this once, inside <Router>, above <Routes>,
// alongside <ScrollToTop />.
export default function HashSectionRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const decision = resolveHashRedirect({ pathname: location.pathname, hash: location.hash });
    if (decision.redirect) {
      navigate(decision.to, { replace: true });
    }
  }, [location.pathname, location.hash, navigate]);

  return null;
}
