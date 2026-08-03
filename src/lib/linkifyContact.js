// Turns the fixed phone/email strings inside a plain-text answer into
// link descriptors a React component can render as real <a href="tel:">/
// <a href="mailto:"> elements -- WITHOUT touching the source string
// itself. Pure, no JSX (matches src/lib/blog.js's plain-ESM convention),
// so it stays independently testable and never risks the schema builder
// (buildHomepageFaqJsonLd in src/data/homepage-faq.js) picking up any
// markup -- that function still reads HOMEPAGE_FAQ's raw strings
// directly and is untouched by this file.
//
// Exact-literal matching (not a generic phone/email regex) deliberately:
// the site has exactly one phone number and one email in its identity
// block (619-277-2766 / askgeorgek@gmail.com), so matching those two
// literals is safer and more predictable than a general-purpose regex
// that could misfire on formatting variants that don't exist here.
const PHONE_DISPLAY = '619-277-2766';
const PHONE_HREF = 'tel:+16192772766';
const EMAIL_DISPLAY = 'askgeorgek@gmail.com';
const EMAIL_HREF = 'mailto:askgeorgek@gmail.com';

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const SPLIT_PATTERN = new RegExp(`(${escapeRegex(PHONE_DISPLAY)}|${escapeRegex(EMAIL_DISPLAY)})`, 'g');

// Returns an array where each element is either a plain string segment or
// a { type: 'tel' | 'mailto', href, text } link descriptor. Joining every
// element's text (segment itself for strings, .text for link
// descriptors) reproduces the original input exactly -- see
// linkifyContact.test.mjs's round-trip test.
export function linkifyContact(text) {
  return text
    .split(SPLIT_PATTERN)
    .filter((part) => part.length > 0)
    .map((part) => {
      if (part === PHONE_DISPLAY) return { type: 'tel', href: PHONE_HREF, text: PHONE_DISPLAY };
      if (part === EMAIL_DISPLAY) return { type: 'mailto', href: EMAIL_HREF, text: EMAIL_DISPLAY };
      return part;
    });
}

// Plain-text reconstruction of a linkifyContact() result -- used by tests
// (and available to any caller) to prove the transform never changes the
// underlying character content, only which characters are wrapped in a
// link.
export function plainTextOf(segments) {
  return segments.map((s) => (typeof s === 'string' ? s : s.text)).join('');
}
