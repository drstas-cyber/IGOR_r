import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateIdentityCompleteness } from './identityCompletenessGate.mjs';

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
