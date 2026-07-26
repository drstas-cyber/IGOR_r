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
  domain: 'temeculavalleyhomes.us', // George's own site -- see scan.js's isReferenceDomain()
};

// Named threshold, not just "100% tripped = fatal". A build that silently
// ships 1 of 24 articles because 23 tripped is barely different from
// shipping 0 — both mean the blog is effectively empty and something is
// badly wrong (the filter is broken, or the upstream content generation
// is), but only an exact 100%-tripped case was failing loudly before this
// was added. 0.5 is a conservative starting point: losing more than half a
// batch is treated as abnormal, not ordinary editorial variance. Revisit
// after the real report-only run shows an actual baseline trip rate —
// this number was chosen before any real data existed to calibrate it.
export const MAX_TRIP_RATE = 0.5; // fraction tripped, ABOVE which enforce mode fails the build loudly

// --- (a) Exclusivity / unsubstantiated-superlative claims -----------------
// Window-based, not a single regex: "only" is common in harmless usage
// ("not only", "the only way to know is an appraisal"). We only care about
// a trigger word co-occurring near an agent/professional/comparison
// descriptor within a short word window, and explicitly exclude the two
// "only" idioms named during design.
//
// Trigger words widened 2026-07-26 after the real titles
// "Best Meekerrealtygroup.com Alternatives...", "Top 4 debonisteam.com
// Alternatives...", "Top 5 yukomiyata.com Alternatives..." proved "only"
// alone missed exactly the unsubstantiated-superlative class the original
// audit named. "best"/"top N" are NOT scoped to "not only"-style exclusions
// (no equivalent idiom exists) but ARE scoped to the same context-word
// window, specifically so this doesn't trip on every "best time to sell" /
// "top 5 neighborhoods" sentence in ordinary real-estate content — those
// have no agent/comparison context word nearby and won't match. Expect some
// noise here regardless; report-only mode exists to measure it before
// enforcement, same as every other category.
export const SUPERLATIVE_TRIGGER_PATTERN = /\bonly\b|\bbest\b|\btop\s*\d+\b/gi;
export const EXCLUSIVITY_CONTEXT_WORDS = [
  'agent', 'agents', 'realtor', 'realtors', 'broker', 'brokers',
  'professional', 'professionals', 'expert', 'experts', 'provider', 'providers',
  'choice', 'option', 'person', 'one who', 'specialist', 'specialists',
  'alternative', 'alternatives', // added with the "best/top N ... alternatives" widening
];
export const EXCLUSIVITY_WINDOW_WORDS = 8; // words either side of the trigger to search for a context word
export const EXCLUSIVITY_EXCLUDE_PATTERNS = [
  // Only apply to the word "only" specifically — "best"/"top N" have no
  // equivalent false-positive idiom to exclude.
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
  // Widened 2026-07-26: a real ground-truth claim from the open-house
  // article — "has spent over a decade guiding first-time buyers" — matched
  // NONE of the patterns above (no digit, no "of experience" suffix). It
  // only tripped tenure by coincidence, via an unrelated sentence elsewhere
  // in the same article ("Realtors with more than a decade of experience").
  // These cover word-form durations with no digit and no "of experience".
  { id: 'word-decade', re: /\b(over|more than|nearly|almost)?\s*(a|an)\s+decade\b/gi },              // "a decade", "over a decade"
  { id: 'word-decades', re: /\b(over|more than|nearly|almost)?\s*(two|three|four|five|six|seven|eight|nine|ten)\s+decades?\b/gi }, // "two decades", "nearly three decades"
  { id: 'word-years', re: /\b(over|more than|nearly|almost)\s+(ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty)\s+years?\b/gi }, // "over ten years", "nearly twenty years"
  { id: 'spent-years', re: /\bspent\s+years\b/gi },                                                   // "spent years" (no number at all)
  { id: 'years-serving-verb', re: /\byears\s+(guiding|serving|helping|working\s+with)\b/gi },          // "years guiding/serving/helping/working with"
];

// --- (c) Review counts / ratings / star claims ----------------------------
export const REVIEW_PATTERNS = [
  { id: 'star-rating', re: /\b\d(\.\d)?[\s-]*stars?\b/gi },
  { id: 'five-star', re: /\bfive[\s-]star\b/gi },
  { id: 'n-reviews', re: /\b\d{1,4}\+?\s+reviews?\b/gi },
  { id: 'x-of-5', re: /\b\d(\.\d)?\s*\/\s*5\b/gi },
  { id: 'satisfaction-pct', re: /\b\d{1,3}%\s+(satisfaction|positive|happy)\b/gi },
];

// "rated N" moved out of REVIEW_PATTERNS 2026-07-26: a bare regex fired on
// "neighborhood rated 7 for walkability" (a scoring scale, nothing to do
// with George's reviews) just as readily as "rated 5 stars by 40 clients".
// Window-based like exclusivity/disparagement — only counts if a review/
// client/testimonial word is nearby, same false-positive-avoidance pattern
// already used elsewhere in this file.
export const RATED_N_PATTERN = /\brated\s+\d(\.\d)?\b/gi;
export const RATED_N_CONTEXT_WORDS = [
  'review', 'reviews', 'star', 'stars', 'client', 'clients',
  'testimonial', 'testimonials', 'rating', 'ratings', 'customer', 'customers',
];
export const RATED_N_WINDOW_WORDS = 8;

// --- (d) Unverifiable urgency stats ---------------------------------------
export const URGENCY_STAT_PATTERNS = [
  { id: 'pct-homes-sell', re: /\b\d{1,3}%\s+of\s+homes?\s+(sell|sold|close)/gi },
  { id: 'sell-in-n-days', re: /\bsells?\s+in\s+(just\s+)?\d{1,3}\s+days?\b/gi },
  { id: 'sold-in-n-days', re: /\bsold\s+in\s+(an\s+average\s+of\s+)?\d{1,3}\s+days?\b/gi },
  { id: 'pct-faster', re: /\b\d{1,3}%\s+(faster|higher|more|above)\b/gi },
  { id: 'homes-selling-above-asking', re: /\b\d{1,3}%\s+of\s+homes?\s+sell(ing)?\s+(above|over)\s+asking/gi },
];

// --- (e) Named-competitor disparagement / comparison content --------------
// Least precise category by nature — disparagement is a sentiment judgment,
// not a lexical one. This catches a domain-like token near either (a)
// negative-sentiment words, or (b) comparison-framing words ("alternatives",
// "vs", "compared to") within a window. It will NOT catch subtle
// disparagement and MAY flag neutral competitor mentions that happen to
// share a sentence with an unrelated negative word. Treat this category's
// results as "needs a human read," not as a reliable automatic verdict,
// more than the others.
//
// Comparison-framing trigger added 2026-07-26: "Best Meekerrealtygroup.com
// Alternatives...", "Top 4 debonisteam.com Alternatives...", "Top 5
// yukomiyata.com Alternatives..." are all neutral in tone (no disparagement
// word present) but name a specific competitor domain in direct comparison
// framing — exactly the class of content the original audit flagged as
// worth a human read regardless of whether the tone is negative. Sentiment
// alone was too narrow a definition of "worth reviewing" for this category.
// BACKLOG (recorded, not fixed 2026-07-26): this TLD list is not exhaustive.
// A competitor on .us, .co, .realtor, or .homes is invisible to this pattern
// today -- a real gap, not hypothetical (confirmed temeculavalleyhomes.com,
// a real competitor, sits on .com so it's caught; a hypothetical competitor
// on .us would not be, and George's own site is ALSO .us, which is exactly
// why REFERENCE.domain / isReferenceDomain() below exists ahead of any TLD
// widening rather than after one). Widening this list is a deliberate future
// decision, not an accident to be discovered later -- when it happens, the
// allowlist carve-out is already in place.
export const COMPETITOR_DOMAIN_PATTERN = /\b[\w-]+\.(com|net|org|io)\b/gi;
export const DISPARAGEMENT_WORDS = [
  'worse', 'inferior', 'outdated', 'overpriced', 'avoid', 'beware',
  "don't trust", 'do not trust', 'poor service', 'poor reviews', 'bad reviews',
  'scam', 'unreliable', 'subpar', 'mediocre', 'lacking', 'falls short',
  'inexperienced', 'unprofessional',
];
export const COMPARISON_FRAMING_WORDS = [
  'alternative', 'alternatives', 'vs', 'versus', 'compare', 'compared',
  'comparison', 'competitor', 'competitors',
];
export const DISPARAGEMENT_WINDOW_WORDS = 12;

// --- (f) Wrong DRE / brokerage / phone / email ----------------------------
export const DRE_PATTERN = /\bDRE\s*#?\s*(\d{6,8})\b/gi;
export const BROKERAGE_MENTION_PATTERN = /\b(brokerage|broker(?:ed)?\s+(?:with|by|through)|licensed\s+(?:with|under)|affiliated\s+with)\s+([A-Z][\w&,.'’ -]{3,50})/g;
export const PHONE_PATTERN = /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
export const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/gi;
