const BLOCKED_DOMAINS = [
  'voiceaiupsave.com',
  'voiceai',
  'upsave',
  'tempmail',
  'guerrillamail',
  'mailinator',
  'yopmail',
  'throwaway',
  'fakeinbox',
  'sharklasers',
  'grr.la',
  'guerrillamailblock',
  'dispostable',
  'trashmail',
  'maildrop',
  '10minutemail',
  'tempail',
];

const BLOCKED_PATTERNS = [
  /voiceai/i,
  /upsave/i,
  /test@test/i,
  /spam/i,
  // Removed 2026-05-19 (TVH EmailJS migration PR):
  //   /\.ru$/i  — was blunt-instrument blocking the exact Russian-speaking
  //               audience George targets (mail.ru / yandex.ru / rambler.ru
  //               are ubiquitous and legitimate).
  //   /\.cn$/i  — same blunt-instrument problem; removed for consistency.
  // Honeypot, 2-second timer, tempmail-domain blocklist, and spam-content
  // patterns carry the anti-spam load now.
];

export function isSpamEmail(email) {
  if (!email) return false;
  const lower = email.toLowerCase().trim();
  const domain = lower.split('@')[1] || '';
  if (BLOCKED_DOMAINS.some(d => domain.includes(d))) return true;
  if (BLOCKED_PATTERNS.some(p => p.test(lower))) return true;
  return false;
}

export function isSpamContent(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  const spamPhrases = ['buy followers', 'crypto', 'bitcoin', 'casino', 'viagra', 'cbd oil', 'forex', 'make money fast', 'click here now'];
  return spamPhrases.some(p => lower.includes(p));
}

let formLoadTime = Date.now();
export function resetFormTimer() { formLoadTime = Date.now(); }

export function isBot() {
  const elapsed = Date.now() - formLoadTime;
  if (elapsed < 2000) return true;
  return false;
}

export function validateSubmission(data) {
  const email = data.email || data.get?.('email') || '';
  const name = data.name || data.get?.('name') || '';
  const message = data.message || data.get?.('message') || '';
  const phone = data.phone || data.get?.('phone') || '';

  if (data.website_url) return { blocked: true, reason: 'honeypot' };
  if (isBot()) return { blocked: true, reason: 'too_fast' };
  if (isSpamEmail(email)) return { blocked: true, reason: 'blocked_email' };
  if (isSpamContent(name) || isSpamContent(message)) return { blocked: true, reason: 'spam_content' };

  return { blocked: false };
}
