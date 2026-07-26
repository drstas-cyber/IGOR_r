// Compliance pattern config for the blog sanitization filter — see
// tools/blog-compliance/README.md for what this is and (importantly) what
// it is NOT a substitute for.
//
// Every pattern here is a LAST LINE OF DEFENSE, not the fix. Keep entries
// commented with WHY they exist and what's expected to false-positive, so a
// future editor can tell "noisy but intentional" from "just wrong."

export const REFERENCE = {
  dre: '02034120',
  brokerage: 'Allison James',
  phoneDigits: '6192772766', // 619-277-2766, digits only, for normalized comparison
  email: 'askgeorgek@gmail.com',
};

// --- (a) Exclusivity claims ("the only agent...") ------------------------
// Window-based, not a single regex: "only" is common in harmless usage
// ("not only", "the only way to know is an appraisal"). We only care about
// "only" co-occurring near an agent/professional descriptor within a short
// word window, and explicitly exclude the two idioms named during design.
export const EXCLUSIVITY_CONTEXT_WORDS = [
  'agent', 'agents', 'realtor', 'realtors', 'broker', 'brokers',
  'professional', 'professionals', 'expert', 'experts', 'provider', 'providers',
  'choice', 'option', 'person', 'one who', 'specialist', 'specialists',
];
export const EXCLUSIVITY_WINDOW_WORDS = 8; // words either side of "only" to search for a context word
export const EXCLUSIVITY_EXCLUDE_PATTERNS = [
  /\bnot\s+only\b/i,          // "not only... but also" — the classic false positive
  /\bonly\s+way\s+to\b/i,     // "the only way to know is an appraisal"
  /\bif\s+not\s+the\s+only\b/i,
];

// --- (b) Years-of-experience / tenure claims ------------------------------
// Expect real false-positive risk here: "since 2020" and similar phrasing
// shows up constantly in market-trend sentences that have nothing to do
// with George's tenure. Flagging in the report, not silently excluding
// this category — see the README note on tuning after the report-only run.
export const TENURE_PATTERNS = [
  { id: 'years-experience', re: /\b\d{1,2}\+?\s*years?\s+(of\s+)?experience\b/gi },
  { id: 'over-n-years', re: /\b(over|more than)\s+\d{1,2}\s+years?\b/gi },
  { id: 'decades-experience', re: /\bdecades?\s+of\s+experience\b/gi },
  { id: 'veteran-agent', re: /\bveteran\s+(agent|realtor)\b/gi },
  { id: 'seasoned-agent', re: /\bseasoned\s+(agent|realtor|professional)\b/gi },
  { id: 'since-year', re: /\bsince\s+(19|20)\d{2}\b/gi }, // high false-positive risk, see README
];

// --- (c) Review counts / ratings / star claims ----------------------------
export const REVIEW_PATTERNS = [
  { id: 'star-rating', re: /\b\d(\.\d)?[\s-]*stars?\b/gi },
  { id: 'five-star', re: /\bfive[\s-]star\b/gi },
  { id: 'n-reviews', re: /\b\d{1,4}\+?\s+reviews?\b/gi },
  { id: 'rated-n', re: /\brated\s+\d(\.\d)?\b/gi },
  { id: 'x-of-5', re: /\b\d(\.\d)?\s*\/\s*5\b/gi },
  { id: 'satisfaction-pct', re: /\b\d{1,3}%\s+(satisfaction|positive|happy)\b/gi },
];

// --- (d) Unverifiable urgency stats ---------------------------------------
export const URGENCY_STAT_PATTERNS = [
  { id: 'pct-homes-sell', re: /\b\d{1,3}%\s+of\s+homes?\s+(sell|sold|close)/gi },
  { id: 'sell-in-n-days', re: /\bsells?\s+in\s+(just\s+)?\d{1,3}\s+days?\b/gi },
  { id: 'sold-in-n-days', re: /\bsold\s+in\s+(an\s+average\s+of\s+)?\d{1,3}\s+days?\b/gi },
  { id: 'pct-faster', re: /\b\d{1,3}%\s+(faster|higher|more|above)\b/gi },
  { id: 'homes-selling-above-asking', re: /\b\d{1,3}%\s+of\s+homes?\s+sell(ing)?\s+(above|over)\s+asking/gi },
];

// --- (e) Named-competitor disparagement -----------------------------------
// Least precise category by nature — disparagement is a sentiment judgment,
// not a lexical one. This catches a domain-like token near negative-sentiment
// words within a window; it will NOT catch subtle disparagement and MAY flag
// neutral competitor mentions that happen to share a sentence with an
// unrelated negative word. Treat this category's results as "needs a human
// read," not as a reliable automatic verdict, more than the others.
export const COMPETITOR_DOMAIN_PATTERN = /\b[\w-]+\.(com|net|org|io)\b/gi;
export const DISPARAGEMENT_WORDS = [
  'worse', 'inferior', 'outdated', 'overpriced', 'avoid', 'beware',
  "don't trust", 'do not trust', 'poor service', 'poor reviews', 'bad reviews',
  'scam', 'unreliable', 'subpar', 'mediocre', 'lacking', 'falls short',
  'inexperienced', 'unprofessional',
];
export const DISPARAGEMENT_WINDOW_WORDS = 12;

// --- (f) Wrong DRE / brokerage / phone / email ----------------------------
export const DRE_PATTERN = /\bDRE\s*#?\s*(\d{6,8})\b/gi;
export const BROKERAGE_MENTION_PATTERN = /\b(brokerage|broker(?:ed)?\s+(?:with|by|through)|licensed\s+(?:with|under)|affiliated\s+with)\s+([A-Z][\w&,.'’ -]{3,50})/g;
export const PHONE_PATTERN = /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
export const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/gi;
