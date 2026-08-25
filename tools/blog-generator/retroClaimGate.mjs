// The two retrospective-audit categories that genuinely need judgment, not
// a regex: fabricated speech and misattributed quotes. Everything else the
// weekly retro checks (prohibited claims, identity block, stats-vs-
// citations, quality/rendering) is deterministic and reuses existing,
// already-tested infrastructure — see retroAudit.mjs. These two are not:
// "does this read as a real utterance nobody actually said" and "does this
// attribute language to a source that doesn't actually say it" are the same
// class of judgment call llmClaimGate.mjs's Layer 2 already exists to make
// for pre-publish review, just pointed at a different pair of questions and
// run AFTER publish instead of before.
//
// Independent from the writer AND from Layer 2's own reviewer call — same
// model (REVIEWER_MODEL, see generate.mjs), same "structured tool-use, not
// prose" discipline, but never reuses Layer 2's own tripped verdict: an
// article already cleared pre-publish still gets asked this fresh, because
// this is a different question than anything asked before publish.
import { createMessage, extractToolInput } from './anthropicClient.mjs';

export const RETRO_CHECKLIST_TOOL = {
  name: 'report_retro_check',
  description: 'Report findings from an independent retrospective read of an already-published real estate blog article, focused specifically on fabricated speech and misattributed quotes.',
  input_schema: {
    type: 'object',
    properties: {
      fabricated_speech: {
        type: 'boolean',
        description: 'Does the article present words as a specific, real utterance -- a direct or paraphrased quote or statement attributed to George, a client, an official, or a generic group ("buyers often say...", "as one client put it...") -- rather than the writer\'s own general description or explanation? A general statement of fact or advice in the writer\'s own voice is NOT fabricated speech; anything phrased as someone\'s actual words, spoken or written, when no such statement is on record, is.',
      },
      fabricated_speech_evidence: { type: ['string', 'null'], description: 'Exact quoted sentence if fabricated_speech is true, else null.' },
      misattributed_quote: {
        type: 'boolean',
        description: 'Does the article attribute a specific quote, statistic, or statement to a named source (a statute, a government office, a person) in a way that does not match what that source actually says, or attach real language to the wrong source entirely?',
      },
      misattributed_quote_evidence: { type: ['string', 'null'], description: 'Exact quoted sentence plus a brief note on the actual mismatch, if misattributed_quote is true, else null.' },
    },
    required: ['fabricated_speech', 'fabricated_speech_evidence', 'misattributed_quote', 'misattributed_quote_evidence'],
  },
};

export const RETRO_REVIEWER_SYSTEM_PROMPT = `You are an independent retrospective auditor reviewing a real estate blog
article that is ALREADY LIVE on the site. You did not write it and were not
involved in its original pre-publish review. Report findings using the
report_retro_check tool only -- do not write prose.

You are checking for exactly two things, both narrow and specific:

1. FABRICATED SPEECH -- language presented as someone's actual words (a
   direct or paraphrased quote, "he said," "clients tell us," "as one buyer
   put it") when the article gives no indication this is a real, sourced
   statement. The writer's own explanatory prose in its own voice is NOT
   fabricated speech, even if confident or informal in tone -- only text
   framed as someone else's specific utterance counts.
2. MISATTRIBUTED QUOTES -- a quote, statistic, or statement credited to a
   specific named source (a statute, a government office, a person) that
   does not actually match what that source says, or that attaches real
   language to the wrong source.

If you are unsure whether something counts, err toward flagging it true so
a human reviews it. Do not flag ordinary attributed citations to a statute
or agency by name alone -- only flag if the ATTRIBUTED CONTENT itself looks
wrong or invented.`;

// Returns { tripped: boolean, checklist: {...} }. tripped computed here
// independently of any self-reported summary from the model, same
// discipline as llmClaimGate.mjs's runLlmClaimGate.
export async function runRetroClaimGate({ apiKey, model, title, contentHtml }) {
  const response = await createMessage({
    apiKey,
    model,
    system: RETRO_REVIEWER_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Review this already-published article for fabricated speech and misattributed quotes only.\n\nTITLE: ${title}\n\nBODY (HTML):\n${contentHtml}`,
      },
    ],
    tools: [RETRO_CHECKLIST_TOOL],
    toolChoice: { type: 'tool', name: RETRO_CHECKLIST_TOOL.name },
    maxTokens: 1024,
  });

  const checklist = extractToolInput(response, RETRO_CHECKLIST_TOOL.name);
  const tripped = Boolean(checklist.fabricated_speech || checklist.misattributed_quote);
  return { tripped, checklist };
}
