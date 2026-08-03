// Single source of truth for the homepage FAQ — both the visible section
// (HomepageFAQSection.jsx) and the FAQPage JSON-LD (emitted via Helmet in
// HomePage.jsx, and injected into the static prerendered build by
// tools/seo-prerender.js) read from this same array. Text cannot drift
// between what a visitor sees and what the schema claims, because there is
// only one place it's written.
//
// Approved 2026-08-05 (docs/homepage-faq-draft.md, Stage A) — 11 questions,
// zero edits from the draft. Replaces the previous sitewide (every-route)
// hardcoded FAQPage block in index.html, which had no matching visible
// content anywhere on the page and carried two unverifiable claims
// ("five-star reviewed", an uncited "~80% buyer-side" stat) that are not
// carried forward here.
export const HOMEPAGE_FAQ = [
  {
    question: 'Is Temecula a good place to live?',
    answer:
      "Temecula is a Southern California wine country community known for its master-planned neighborhoods, local schools, and proximity to Los Angeles, San Diego, and Orange County. Many buyers are drawn to the area for its family-friendly communities, newer housing stock, and easy access to Temecula Valley's wineries and outdoor recreation. Whether it's a good fit depends on your own priorities — commute, school district, budget, and lifestyle are all worth weighing for your specific situation.",
  },
  {
    question: 'What are the best neighborhoods in Temecula for families?',
    answer:
      'The right neighborhood depends on what a family is looking for. Wolf Creek and Paloma Del Sol are both master-planned communities with parks, pools, and sports courts that many families consider family-friendly. Redhawk is built around a golf course with walking trails, and Morgan Hill offers larger lots with mountain views. Each neighborhood has its own character, and George Khazanovskiy can help you tour a few to see which fits your family best.',
  },
  {
    question: 'How do I get a free home valuation in Temecula?',
    answer:
      "George Khazanovskiy offers a free, no-obligation home valuation for properties in Temecula, Murrieta, Menifee, and the surrounding area. Rather than an automated online estimate, it's a comparative market analysis (CMA) based on recent comparable sales in your specific neighborhood. Request one by calling 619-277-2766, emailing askgeorgek@gmail.com, or visiting temeculavalleyhomes.us.",
  },
  {
    question: 'What should first-time buyers know about working with an agent?',
    answer:
      'First-time buyers often have the most questions about the process — financing, inspections, contingencies, and closing costs can all be unfamiliar. George Khazanovskiy works with first-time buyers throughout Temecula, Murrieta, and Menifee and can walk through each step of a purchase, answer questions as they come up, and help you understand what to expect before you’re under contract.',
  },
  {
    question: 'What languages does George Khazanovskiy speak?',
    answer:
      "George is fluent in English, Russian, and Ukrainian. Contracts, negotiations, and consultations are available in whichever language you're most comfortable with.",
  },
  {
    question: 'How far is Temecula from Los Angeles, San Diego, and Orange County?',
    answer:
      "Temecula is located in Southern California's Inland Empire, within driving distance of Los Angeles, San Diego, and Orange County. Many residents commute to or regularly visit those areas; exact drive times vary with traffic and your specific destination, so it's worth checking a map for your particular commute before deciding how the location fits your routine.",
  },
  {
    question: 'How do I start the process of buying a home in Temecula?',
    answer:
      "A good starting point is a conversation about what you're looking for — budget, timeline, and the neighborhoods or features that matter most to you. George Khazanovskiy offers a free, no-obligation buyer consultation and can help you understand financing options, connect you with lenders, and begin touring homes that match your criteria. Reach out at 619-277-2766 or askgeorgek@gmail.com to get started.",
  },
  {
    question: 'How do I start the process of selling my home in Temecula?',
    answer:
      'Selling typically starts with understanding what your home is likely worth in the current market — George Khazanovskiy provides a free comparative market analysis to help with that. From there, next steps usually include preparing the home for listing, professional photography, and setting a pricing and marketing strategy. Call 619-277-2766 or email askgeorgek@gmail.com to discuss your specific property.',
  },
  {
    question: 'What areas does George Khazanovskiy serve?',
    answer:
      'George Khazanovskiy serves Temecula (92590, 92591, 92592), Murrieta (92562, 92563), Menifee (92584, 92585, 92586), Winchester (92596), Lake Elsinore (92530, 92532), Wildomar (92595), and Fallbrook (92028).',
  },
  {
    question: 'Who is George Khazanovskiy?',
    answer:
      'George Khazanovskiy is a licensed California Realtor® (DRE #02034120) with Allison James Estates & Homes, serving buyers and sellers throughout Temecula, Murrieta, and Menifee. He is fluent in English, Russian, and Ukrainian.',
  },
  {
    question: "How can I verify George Khazanovskiy's real estate license?",
    answer:
      "Every real estate agent in California must hold a license issued by the California Department of Real Estate (DRE). You can verify George Khazanovskiy's license status directly through the DRE's public license lookup tool using DRE #02034120.",
  },
];

// Pure transform, no I/O — usable identically from a React component (via
// Helmet, for live browsers) and from tools/seo-prerender.js (at build
// time, for the static HTML crawlers see). Mirrors
// tools/blog-generator/generate.mjs's buildFaqJsonLd() shape exactly, so
// the pattern already established for blog-article FAQ schema doesn't
// diverge for the homepage's own FAQ.
export function buildHomepageFaqJsonLd(faq = HOMEPAGE_FAQ) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': 'https://temeculavalleyhomes.us/#faq',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}
