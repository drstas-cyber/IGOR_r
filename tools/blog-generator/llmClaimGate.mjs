// Layer 2 of the compliance gate — an independent LLM claim review, using a
// DIFFERENT model from the writer (see generate.mjs: writer is
// claude-sonnet-5, this is claude-haiku-4-5-20251001) so it doesn't share
// the writer's blind spots. Forced tool-use for structured output — not
// prose parsing, per the build spec.
//
// WHY THIS EXISTS ALONGSIDE THE REGEX SCANNER: the scanner (tools/blog-
// compliance/, frozen pattern set 30d8154) is regex tuned on BabyLoveGrowth's
// specific output, and during the 2026-07-26 audit it missed the dominant
// claim across an entire 25-article corpus ("over a decade" — no digit, no
// "of experience" suffix) until the patterns were manually widened. A
// pattern-only gate on a NEW generator drifts into whatever the patterns
// don't happen to cover. This layer checks intent/meaning, not just lexical
// matches.

import { createMessage, extractToolInput } from './anthropicClient.mjs';

const CHECKLIST_TOOL = {
  name: 'report_compliance_check',
  description: 'Report findings from reviewing a real estate blog article against six compliance rules.',
  input_schema: {
    type: 'object',
    properties: {
      tenure_claim: { type: 'boolean', description: 'Does the article make ANY tenure/years-of-experience claim about George, in any phrasing (numbers, "a decade", "since [year]", "seasoned", "veteran", "long-time", "extensive experience", etc.)?' },
      tenure_evidence: { type: ['string', 'null'], description: 'Exact quoted sentence if tenure_claim is true, else null.' },
      uniqueness_claim: { type: 'boolean', description: 'Does the article make any uniqueness/superlative claim about George ("only", "best", "top", "leading", "premier", "unmatched", "go-to", or equivalent)?' },
      uniqueness_evidence: { type: ['string', 'null'] },
      review_rating_claim: { type: 'boolean', description: 'Does the article invent any review, star rating, client count, or satisfaction statistic?' },
      review_evidence: { type: ['string', 'null'] },
      // Redefined 2026-07-26: this used to be a pure judgment call ("does
      // this sound uncited"). Now the article carries a real citations
      // array (prompt.md rules 4-8), so this is checkable against ground
      // truth instead -- cross-reference the array directly, don't guess
      // from general knowledge of whether a number sounds plausible.
      uncited_statistic: { type: 'boolean', description: 'Does the article state a specific number, rate, percentage, dollar figure, date, or deadline that has NO corresponding entry in the citations array provided below (i.e., no inline data-cite marker + matching citations[] entry backs it up)? Cross-reference the citations array directly rather than judging from general knowledge of whether the number sounds right -- if a number is present with no matching citation, this is true regardless of whether the number happens to be accurate.' },
      statistic_evidence: { type: ['string', 'null'], description: 'Exact quoted sentence containing the uncited number, if uncited_statistic is true, else null.' },
      competitor_mention: { type: 'boolean', description: 'Does the article name or reference a competitor, competitor domain, or frame content as a comparison against another agent/brokerage?' },
      competitor_evidence: { type: ['string', 'null'] },
      contact_mismatch: { type: 'boolean', description: 'Does the article state any contact/identity detail (DRE, brokerage, phone, email) that does NOT exactly match: DRE 02034120, Allison James Estates & Homes, 619-277-2766, askgeorgek@gmail.com? (No contact info present at all is NOT a mismatch — false in that case.)' },
      contact_evidence: { type: ['string', 'null'] },
      // NEW 2026-07-26: a distinct category from uncited_statistic, not a
      // tightening of it -- this catches a claim that DOES have a citation
      // but overstates what that citation actually says (the Mello-Roos
      // disclosure gap found in article 2's independent verification:
      // "the law requires X" when the cited statute says "must make a
      // good-faith effort to" do X).
      legal_duty_overstated: { type: 'boolean', description: 'Does the article state a legal duty, requirement, or obligation more strongly or more absolutely than the cited source (in the citations array) actually states it -- for example "the law requires X" when the cited source\'s actual language is "must make a good-faith effort to" do X, or an unconditional "you must" when the source\'s duty is conditional or hedged? Compare the citation\'s own language against the article\'s phrasing; do not judge from general familiarity with the topic.' },
      legal_duty_evidence: { type: ['string', 'null'], description: 'Exact quoted sentence overstating the duty, plus a brief note on what the cited source actually says, if legal_duty_overstated is true, else null.' },
    },
    required: [
      'tenure_claim', 'tenure_evidence',
      'uniqueness_claim', 'uniqueness_evidence',
      'review_rating_claim', 'review_evidence',
      'uncited_statistic', 'statistic_evidence',
      'competitor_mention', 'competitor_evidence',
      'contact_mismatch', 'contact_evidence',
      'legal_duty_overstated', 'legal_duty_evidence',
    ],
  },
};

const REVIEWER_SYSTEM_PROMPT = `You are an independent compliance reviewer for a real estate blog. You did
not write the article you're about to review. Read it carefully and report
findings using the report_compliance_check tool — do not write prose, only
call the tool. Be strict: partial or implied phrasing counts (e.g. "he's
spent significant time helping buyers" IS a tenure claim even with no
number). If you are unsure whether something counts, err toward flagging it
true so a human reviews it.

You will also be given the article's citations array (its source of truth
for every specific claim, per the writer's own compliance rules). Use it for
two checks: (1) uncited_statistic — cross-reference every specific number,
rate, date, or deadline in the article against the array; anything with no
matching entry is uncited, regardless of whether it sounds accurate. (2)
legal_duty_overstated — for any claim about what a law "requires" or
"mandates," compare the article's phrasing against the cited source's own
language; flag it if the article states the duty more strongly or more
absolutely than the source does.`;

// Returns { tripped: boolean, checklist: {...} }. tripped is computed here,
// independently of anything the model claims about itself — never trust a
// self-reported "overall pass/fail" from the model that produced the
// findings.
export async function runLlmClaimGate({ apiKey, model, title, contentHtml, citations }) {
  const response = await createMessage({
    apiKey,
    model,
    system: REVIEWER_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Review this article.\n\nTITLE: ${title}\n\nBODY (HTML):\n${contentHtml}\n\nCITATIONS ARRAY (JSON): ${JSON.stringify(citations || [])}`,
      },
    ],
    tools: [CHECKLIST_TOOL],
    toolChoice: { type: 'tool', name: CHECKLIST_TOOL.name },
    maxTokens: 1024,
  });

  const checklist = extractToolInput(response, CHECKLIST_TOOL.name);

  const tripped = Boolean(
    checklist.tenure_claim ||
    checklist.uniqueness_claim ||
    checklist.review_rating_claim ||
    checklist.uncited_statistic ||
    checklist.competitor_mention ||
    checklist.contact_mismatch ||
    checklist.legal_duty_overstated
  );

  return { tripped, checklist };
}
