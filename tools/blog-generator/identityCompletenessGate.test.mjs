import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateIdentityCompleteness } from './identityCompletenessGate.mjs';

const PROMPT_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'prompt.md');

const COMPLETE_HTML = '<h2>About George Khazanovskiy</h2><p>George Khazanovskiy is a Temecula Valley real estate agent (DRE #02034120) with Allison James Estates &amp; Homes. Reach George at 619-277-2766 or askgeorgek@gmail.com.</p>';

describe('validateIdentityCompleteness — plumbing (judgment already proven at findIdentityCompletenessErrors, scan.test.mjs)', () => {
  test('a complete identity block -> valid: true, errors: []', () => {
    const result = validateIdentityCompleteness({ content_html: COMPLETE_HTML });
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  // REGRESSION FIXTURE — this module's whole reason to exist: PR #35's exact
  // real omission (names George, links to /contact/, carries no DRE/
  // brokerage/phone/email) must come back invalid through THIS gate's own
  // entry point, not just through the underlying scan.js function directly.
  test('REGRESSION (PR #35, 2026-08-23): the exact real omission fails through this gate', () => {
    const html = `
      <h2>Buying a Home in Vail Ranch</h2>
      <p>George Khazanovskiy, a Temecula Valley real estate agent, can help you evaluate specific listings in Vail Ranch. Reach out through the <a href="https://temeculavalleyhomes.us/contact/">contact page</a> to get started.</p>
    `;
    const result = validateIdentityCompleteness({ content_html: html });
    assert.equal(result.valid, false);
    assert.equal(result.errors.length, 4, `expected all four elements flagged, got: ${JSON.stringify(result.errors)}`);
  });

  test('missing just the phone number -> valid: false, exactly one error', () => {
    const html = '<p>George Khazanovskiy, DRE #02034120, Allison James Estates &amp; Homes. Email askgeorgek@gmail.com.</p>';
    const result = validateIdentityCompleteness({ content_html: html });
    assert.equal(result.valid, false);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /phone/i);
  });

  test('missing content_html entirely -> valid: false, all four flagged, does not throw', () => {
    assert.doesNotThrow(() => validateIdentityCompleteness({}));
    const result = validateIdentityCompleteness({});
    assert.equal(result.valid, false);
    assert.equal(result.errors.length, 4);
  });
});


// PROMPT/GATE AGREEMENT (2026-09-03, after two identity_incomplete
// rejections in three runs -- PR #39 partial block, PR #42 no block at
// all). Root cause was not the writer and not the topic: prompt.md rule
// 10 said "use these exact details IF ANY ARE INCLUDED" and "if the
// article doesn't need a contact block, don't invent one", while this
// gate has been fail-closed on all four elements since 2026-08-25. The
// writer followed the prompt; the gate rejected it for doing so. These
// tests freeze the agreement so the conditional wording cannot come back
// without a failing test. They assert the CONTRACT, not prose style --
// each pattern below is the specific thing whose absence reintroduces the
// defect.
describe('prompt.md states the identity block as unconditional (the contract this gate enforces)', () => {
  // Normalised to LF -- see promptGatePairs.test.mjs for why.
  const prompt = fs.readFileSync(PROMPT_PATH, 'utf8').replace(/\r\n/g, '\n');

  test('rule 10 states the block is unconditional, not conditional on the article "needing" one', () => {
    assert.match(prompt, /UNCONDITIONAL/, 'rule 10 must state the block is unconditional');
    assert.doesNotMatch(
      prompt,
      /use these exact details if any are\s+included/i,
      'the retired conditional framing ("if any are included") must not come back',
    );
    assert.doesNotMatch(
      prompt,
      /if the article doesn't need a contact block, don't invent one/i,
      'the retired opt-out ("do not invent one") must not come back — it is what produced PR #42',
    );
  });

  test('rule 10 requires all four elements, naming each one the gate checks', () => {
    for (const needle of ['02034120', 'Allison James Estates', '619-277-2766', 'askgeorgek@gmail.com']) {
      assert.ok(prompt.includes(needle), `prompt.md must carry the exact value ${needle}`);
    }
    assert.match(prompt, /All four, not a subset/i, 'the partial-block failure (PR #39) must be called out explicitly');
  });

  test('self-review is told to restore a missing block and never to remove a complete one', () => {
    assert.match(
      prompt,
      /closing identity block is not yours to remove/i,
      'self-review must be instructed not to strip the block (same discipline as internal links)',
    );
  });
});
