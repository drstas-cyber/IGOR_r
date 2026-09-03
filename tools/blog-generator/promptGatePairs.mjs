// PROMPT ↔ GATE CONSISTENCY PAIRS.
//
// Created 2026-09-03 under the "no unfired paths" hardening order, item 3,
// directly out of the rule-10 incident earlier the same day.
//
// THE BUG CLASS THIS EXISTS TO PREVENT, stated once: a gate is fail-closed
// on a condition, and prompt.md states the same rule CONDITIONALLY — or
// does not state it at all. The writer follows the prompt, the gate
// discards the result, and the pipeline burns a topic per occurrence while
// looking like a model-quality problem. Rule 10 ran this way from
// 2026-08-25 (when identityCompletenessGate.mjs landed, fail-closed on all
// four identity elements) to 2026-09-03, while prompt.md said "use these
// exact details IF ANY ARE INCLUDED" and "if the article doesn't need a
// contact block, don't invent one." Two rejections (PR #39, PR #42) before
// anyone looked at the pair rather than at the drafts.
//
// Nothing about that failure was specific to the identity block. Any gate
// can drift out of agreement with the prompt that is supposed to produce
// gate-passing output, and the drift is invisible from either side alone:
// the gate's tests pass (it correctly rejects bad input), the prompt reads
// sensibly (it says something reasonable), and only the PAIR is wrong.
//
// Each pair below names:
//   gate         — the fail-closed check, by module and what it enforces
//   promptAnchor — an exact string that must be present in prompt.md,
//                  chosen to be the part that makes the rule UNCONDITIONAL
//   forbidden    — optional: text that must NOT appear, freezing a
//                  specific retired formulation so it cannot come back
//   consistent   — the verdict as of the audit date, with reasoning where
//                  it is not obvious
//
// promptGatePairs.test.mjs enforces every anchor and every forbidden
// string against the real prompt.md. A prompt edit that reintroduces a
// conditional formulation is a red test, not a future incident.

export const AUDIT_DATE = '2026-09-03';

export const PROMPT_GATE_PAIRS = [
  {
    id: 'PGP-01',
    gate: 'identityCompletenessGate.mjs — all four identity elements (DRE, brokerage, phone, email) present in content_html',
    promptRule: 'Rule 10 — closing identity block',
    promptAnchor: 'UNCONDITIONAL',
    forbidden: [
      'use these exact details if any are',
      "if the article doesn't need a contact block, don't invent one",
    ],
    consistent: true,
    note: 'THE ORIGINAL DEFECT, fixed 2026-09-03. The gate has been fail-closed since 2026-08-25; the prompt made the block optional until this pass. Both retired sentences are frozen as `forbidden` so the exact regression cannot recur.',
  },
  {
    id: 'PGP-02',
    gate: 'identityCompletenessGate.mjs — the block must be COMPLETE, not partial (all four, any three fails)',
    promptRule: 'Rule 10 — "All four, not a subset"',
    promptAnchor: 'All four, not a subset',
    consistent: true,
    note: 'A separate pair from PGP-01 on purpose: PR #39 carried phone and email but not DRE or brokerage, so "the block is required" and "the block must be complete" are two distinct claims the prompt has to make, and only one of them was missing before.',
  },
  {
    id: 'PGP-03',
    gate: 'internalLinkGate.mjs — every internal href must exactly match a Known live route',
    promptRule: 'Internal linking — "Rules for these links, no exceptions"',
    promptAnchor: 'Rules for these links, no exceptions',
    consistent: true,
    note: 'Consistent in the direction that matters. The gate only validates links that are PRESENT; it never requires a link to exist. So the prompt is free to say links are optional ("only when a link is genuinely useful") without contradicting a fail-closed gate — this is a conditional prompt rule paired with a conditional gate, which is agreement, not drift. Contrast rule 10, where a conditional prompt was paired with an unconditional gate.',
  },
  {
    id: 'PGP-04',
    gate: 'schema.js getCitationHostPolicyErrors — citation host must be on the closed allowlist',
    promptRule: 'Rule 6 — closed host list',
    promptAnchor: 'Cite only from this exact, closed list of hosts — nothing else, ever',
    consistent: true,
    note: '"nothing else, ever" is the unconditional formulation the fail-closed gate requires.',
  },
  {
    id: 'PGP-05',
    gate: 'schema.js getCitationHostPolicyErrors — sourceType must be valid FOR that host',
    promptRule: 'Rule 6 — sourceType/host pairing',
    promptAnchor: 'pairing and will reject a mismatch even when the host itself is on the',
    consistent: true,
    note: 'The prompt names the gate and its consequence explicitly, which is the strongest form of agreement: the writer is told not just the rule but that it is machine-enforced.',
  },
  {
    id: 'PGP-06',
    gate: 'schema.js — a citation URL that is a bare host root is rejected',
    promptRule: 'Rule 6 — cite the specific page, never a homepage',
    promptAnchor: 'Cite the specific page that carries the fact, never a site',
    consistent: true,
  },
  {
    id: 'PGP-07',
    gate: 'schema.js — citation URL must never be the competitor domain',
    promptRule: 'Rule 7 — never cite temeculavalleyhomes.com',
    promptAnchor: 'under any\n   circumstances.**',
    consistent: true,
    note: 'Stated unconditionally in the prompt AND enforced in two independent places (schema.js citation check, and Layer 1 scanning citation URLs as text). Defense in depth on the one string that is a single character away from the real domain.',
  },
  {
    id: 'PGP-08',
    gate: 'schema.js getCitationConsistencyErrors — every data-cite marker has an entry and vice versa',
    promptRule: 'Rule 5 — marker/entry pairing',
    promptAnchor: 'place an inline marker immediately after the claim',
    consistent: true,
  },
  {
    id: 'PGP-09',
    gate: 'schema.js — citations may be empty, but never a placeholder/invented entry',
    promptRule: 'Rule 5 — zero citations is a valid output',
    promptAnchor: 'never a placeholder or invented entry with nothing to back',
    consistent: true,
    note: 'Worth an explicit pair because the failure mode here is the writer inventing citations to avoid an empty array — the opposite direction from most gate pressure, and one the prompt has to actively counteract rather than merely permit.',
  },
  {
    id: 'PGP-10',
    gate: 'schema.js — meta_description length bounds (70-160)',
    promptRule: 'Output contract',
    promptAnchor: 'a meta\ndescription between 70 and 160 characters',
    consistent: true,
  },
  {
    id: 'PGP-11',
    gate: 'schema.js — sourceTopic must be present (topicAvailability ground truth depends on it)',
    promptRule: '(none — assembled by generate.mjs, never by the model)',
    promptAnchor: null,
    consistent: true,
    note: 'DELIBERATELY UNPAIRED, and safe. sourceTopic is written by assembleArticle() from the selected topic, never produced by the model, so there is no prompt rule for it to contradict. Recorded rather than omitted so a future audit does not have to re-derive that this gap is intentional.',
  },
  {
    id: 'PGP-12',
    gate: 'llmClaimGate.mjs (Layer 2) tenure_claim + Layer 1 tenure category',
    promptRule: 'Rule 1 — never a tenure claim',
    promptAnchor: 'Never make any tenure or years-of-experience claim about George, in any',
    consistent: true,
  },
  {
    id: 'PGP-13',
    gate: 'llmClaimGate.mjs uniqueness_claim (Layer 1 exclusivity is DEMOTED to log-only for this writer)',
    promptRule: 'Rule 2 — never a uniqueness/superlative claim',
    promptAnchor: 'Never make any uniqueness or superlative claim about George',
    consistent: true,
    note: 'The Layer 1 demotion (2026-07-27, five FP shapes across four draws) does NOT weaken this pair: the prompt rule stays unconditional and Layer 2 still enforces it. Only the regex subcategory was demoted, and only for this writer. A demoted LAYER is not a relaxed RULE — that distinction is the whole reason this row exists.',
  },
  {
    id: 'PGP-14',
    gate: 'llmClaimGate.mjs review_rating_claim + Layer 1 reviews-ratings category',
    promptRule: 'Rule 3 — never invent a review/rating/client count',
    promptAnchor: 'Never invent a review, rating, star count, client count',
    consistent: true,
  },
  {
    id: 'PGP-15',
    gate: 'llmClaimGate.mjs uncited_statistic',
    promptRule: 'Rule 4 — cite the number or omit it, never hedge',
    promptAnchor: 'must EITHER carry a citation OR be omitted entirely — never hedged',
    consistent: true,
    note: 'This is the check that produced the 2026-09-01 Prop 19 false positive (entry 2 in the Layer 2 FP tally). The PAIR is consistent — the prompt states the rule exactly as the gate enforces it; the FP was the reviewer model misjudging whether a citation was present, not a prompt/gate disagreement. Logged here so a future reader does not mistake a model-judgment FP for a consistency defect.',
  },
  {
    id: 'PGP-16',
    gate: 'llmClaimGate.mjs competitor_mention (rescoped 2026-08-03)',
    promptRule: 'Rule 9 — never name or reference a competitor',
    promptAnchor: 'Never name or reference a competitor',
    consistent: true,
  },
  {
    id: 'PGP-17',
    gate: 'llmClaimGate.mjs legal_duty_overstated',
    promptRule: 'Rule 8 — state a legal duty no more strongly than the source does',
    promptAnchor: 'State a legal duty, requirement, or obligation no more strongly than',
    consistent: true,
  },
  {
    id: 'PGP-18',
    gate: 'llmClaimGate.mjs contact_mismatch + Layer 1 wrong-dre/brokerage/phone/email categories',
    promptRule: 'Rule 10 — the four values are fixed and verbatim',
    promptAnchor: 'and never any other\n   identity information',
    consistent: true,
    note: 'The COMPLEMENT of PGP-01: that pair is "the block must be present," this one is "when present, the values must be exactly these and nothing else." Both were always in rule 10; only the presence half was broken.',
  },
  {
    id: 'PGP-19',
    gate: 'citationResolver.mjs (Layer 3) — every citation URL must resolve, and its page must actually support the claim',
    promptRule: 'Rule 6 — a page that actually exists and actually discusses the claim',
    promptAnchor: 'it must be a page that\n   actually exists and actually discusses the claim',
    consistent: true,
    note: 'Also carries the rivcoacr.org-specific narrowing (two verified-live URLs only, after three invented paths 404ed across three runs) — a case where the prompt is STRICTER than the gate on purpose. Prompt-stricter-than-gate is safe; gate-stricter-than-prompt is the rule-10 defect.',
  },
  {
    id: 'PGP-20',
    gate: 'selfReviewSchema.mjs / self-review pass — must not strip internal links, must restore a missing identity block',
    promptRule: 'Self-review pass instructions',
    promptAnchor: 'closing identity block is not yours to remove',
    consistent: true,
    note: 'Added 2026-09-03. The self-review pass is not a fail-closed gate, but it is the one component that can DELETE gate-required content after the draft pass produced it correctly — proven twice on internal links (PR #32: six, PR #38: nine). It is audited here because "what can silently remove gate-required output" belongs in the same table as "what requires it".',
  },
];

export function inconsistentPairs() {
  return PROMPT_GATE_PAIRS.filter((p) => !p.consistent);
}

export function unpairedGates() {
  return PROMPT_GATE_PAIRS.filter((p) => p.promptAnchor === null);
}
