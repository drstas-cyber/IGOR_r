// Pure decision logic for src/components/ScrollToTop.jsx (audit item 4).
// Extracted to a plain .js file specifically so it's importable by
// node --test -- Node's module loader has no registered format for
// .jsx and refuses to load one at all, regardless of whether the file
// actually contains JSX syntax (this one didn't, and still failed).
//
//   - PUSH (or REPLACE) without a hash -> scroll to top. A fresh
//     navigation to a new page should start at the top.
//   - PUSH (or REPLACE) with a hash -> false. The target page owns
//     hash-scroll behavior (see HomePage.jsx's own #home-value retry
//     effect); this must not race it.
//   - POP (browser Back/Forward) -> false, always, regardless of hash.
//     The browser's own scroll restoration is what a user expects Back
//     to honor -- overriding it here would be the naive fix that breaks
//     Back the audit specifically warned against.
export function shouldScrollToTop({ navigationType, hash }) {
  if (navigationType === 'POP') return false;
  if (hash) return false;
  return true;
}
