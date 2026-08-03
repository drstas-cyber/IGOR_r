// Single source of truth for George's real Google review testimonials --
// both the visible section (GoogleReviews.jsx, used on the homepage, About
// George, and Buyer Homes pages) and the static crawler-visible fallback
// (injected homepage-only by tools/seo-prerender.js) read from this same
// array, so the text a visitor sees and the text a crawler sees without
// executing JS can never drift.
//
// Text is VERBATIM as supplied by George from his live Google Business
// Profile (captured 2026-08-04, see ~/tvh-ads/google-reviews-data.md for
// the source capture) -- typos included ("made is so easy", "I m happy
// homeowner"). We do not edit other people's words; verbatim accuracy is
// the entire defensibility of this section. displayDate uses month+year
// for reviews with an absolute date as shown by Google, and year-only for
// the two reviews Google displayed as a relative age ("14 weeks ago", "36
// weeks ago") at capture time, per George's confirmation.
//
// Deliberately NO AggregateRating / Review JSON-LD schema anywhere in this
// project. Self-serving review markup -- structured data authored by the
// business itself rather than supplied by Google or a verified third-party
// aggregator -- is ineligible for rich-result treatment under Google's
// review-snippet guidelines and has been rejected for this site on that
// basis, permanently, not just for this batch. This file drives visible
// page content and a plain-HTML crawler-visible fallback only, never a
// <script type="application/ld+json"> block.
//
// RETIRED, not deleted (2026-08-04): three previously-displayed reviewers
// -- Rogelio Camp, Susan Hancock, and NaSh Appliance Group -- are not in
// this array. They presumably correspond to real reviews on George's
// listing; they were dropped only because we do not have their verbatim
// text on file (the prior copy was a paraphrased summary, not a verbatim
// capture), not because they're suspect. Re-add them the day George
// supplies their exact wording, date, rating, and sourceUrl in the same
// shape as the entries below. If either the writer or a later reviewer of
// this file confirms any of the three is NOT actually on the live listing,
// that's a separate, older data-integrity problem worth surfacing on its
// own, independent of this retirement.
export const TESTIMONIALS = [
  {
    reviewerName: 'Olena Fedorov',
    displayDate: 'Feb 2020',
    rating: 5,
    sourceUrl: 'https://www.google.com/maps/contrib/114159684750544070155/reviews?hl=en',
    text: `We were first time home buyers and had no idea about the process. Plus we were out of the area and had no knowledge about anything local. George made is so easy for us.
He introduced us to the area and guided us through the entire process. He recommended great people to work with every step of the way.
He was available 24/7 to answer any questions we had.
With his high standards and expertise in the industry and patience we would recommend George as a realtor to anyone looking to sell or buy! He was amazing!`,
  },
  {
    reviewerName: 'David M',
    displayDate: 'Feb 2021',
    rating: 5,
    sourceUrl: 'https://www.google.com/maps/contrib/104885542564421942956/reviews?hl=en',
    text: `George is very knowledgeable and responsible person. He helped us to find a home in a very short timeframe. He has very good communication skills, always ready to explain any details of a topic without a rush. Even after completing the purchase he was ready to help with all related questions or issues. I strongly recommend him as a great expert in real estate.`,
  },
  {
    reviewerName: 'N. B.',
    displayDate: '2026',
    rating: 5,
    sourceUrl: 'https://www.google.com/maps/contrib/117695991504388147497/reviews?hl=en',
    text: `Professionalism and dedication!!!
George Khazanovskiy helped me to find my first home.He is very knowledgeable,honest, patient, was available any time I needed. He guided me through every step of process, answered all my questions and truly listened to what I needed.
George made what could have been stressful feel smooth and manageable.I felt supported every step of the way.
Thank you George,now I m happy homeowner!
I highly recommend George Khazanovskiy to anyone looking to buy/ sell home`,
  },
  {
    reviewerName: 'Viacheslav',
    displayDate: '2025',
    rating: 5,
    sourceUrl: 'https://www.google.com/maps/contrib/111770977269804467146/reviews?hl=en',
    text: `I would like to express my sincere gratitude to George Khazanovskiy for the outstanding work he did as our realtor during the search and purchase of our home. George was always available at any time of day, and we truly appreciated his constant communication and reliability.

From the very beginning, there was complete understanding between us. Everything we needed, wanted, or asked for — George made it happen. Thanks to his expertise, professionalism, and dedication, we were able to purchase our home quickly, smoothly, and without any issues.

George went above and beyond in every step of the process, and his support made the entire experience stress-free.
Thank you so much, George. We are incredibly grateful, and we highly recommend you to anyone looking to buy or sell a home.`,
  },
  {
    reviewerName: 'Alina Kompaniyets',
    displayDate: 'Nov 2021',
    rating: 5,
    sourceUrl: 'https://www.google.com/maps/contrib/105647818372681974157/reviews?hl=en',
    // Google's own "Positive — Responsiveness, Professionalism" tag on this
    // review is listing metadata, not reviewer-authored text -- intentionally
    // excluded from `text` below, per George's explicit instruction.
    text: `George helped my Husband and I buy our first home in Temecula, the market was very crazy at the time and it took us a little bit longer but George helped us achieve our goals. he was very patient and kind, never pushy like many agents are. He suggested an awesome lender. All in all very pleasant experience. Helped us every step of the way and made sure we were happy with our purchase!!! Thank you.`,
  },
];
