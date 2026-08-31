// Email notification content — the four templates (email-notifications
// batch, 2026-08-25). Pure, no I/O, exported for tests, matching this
// repo's own "pure core, thin I/O shell" split: the CLI at the bottom
// (buildNotificationEmailCli.mjs) reads JSON/env and writes GITHUB_OUTPUT;
// everything that decides WHAT the email says lives here, independently
// testable. Subjects and body labels are Russian throughout, per
// instruction ("the reader is Stan").
//
// Every function returns { subject, html }. Kept deliberately simple HTML
// (no external CSS, no images) — this rides through dawidd6/action-send-
// mail's html_body input to Gmail SMTP, and plain, inline-safe markup is
// the most portable choice across mail clients, especially mobile Gmail
// (the explicit "tap-to-merge from phone" use case named in the
// instruction).

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function htmlDecodeEntities(s) {
  return String(s ?? '')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"');
}

// extractFirstParagraphText (exported, pure) — the first <p>...</p> in a
// generated article's content_html, stripped to plain text, truncated at
// a word boundary with an ellipsis. Used for the "article PR opened"
// email's preview snippet, deliberately not the full article -- an email
// is a notification, not the review surface itself (the PR/preview link
// is that).
export function extractFirstParagraphText(contentHtml, maxLength = 280) {
  const html = String(contentHtml || '');
  const match = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(html);
  if (!match) return '';
  const text = htmlDecodeEntities(match[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return `${truncated.slice(0, lastSpace > 0 ? lastSpace : maxLength)}…`;
}

function wrapEmailHtml(bodyLines) {
  return `<div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; font-size: 15px; line-height: 1.5; color: #1a1a1a;">\n${bodyLines.join('\n')}\n</div>`;
}

function linkLine(label, url) {
  return `<p><strong>${escapeHtml(label)}:</strong> <a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`;
}

// --- Trigger 1: a real-article PR opened (generate-article.yml) ----------
export function buildArticlePrEmail({ title, firstParagraphText, previewUrl, gateSummaryLine, prUrl }) {
  const subject = `📝 Новая статья ждёт проверки: ${title}`;
  const lines = [
    `<p>${escapeHtml(firstParagraphText || '(нет текста для предпросмотра)')}</p>`,
    previewUrl
      ? linkLine('Превью', previewUrl)
      : '<p><em>Превью недоступно (проверка Cloudflare Pages не завершилась вовремя).</em></p>',
    gateSummaryLine ? `<p><strong>Статус ворот:</strong> ${escapeHtml(gateSummaryLine).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>` : '',
    linkLine('Открыть PR (можно смержить с телефона)', prUrl),
  ].filter(Boolean);
  return { subject, html: wrapEmailHtml(lines) };
}

// --- Trigger 2: a rejected-attempt PR opened (generate-article.yml) ------
export function buildRejectedPrEmail({ topic, failureClassLabel, findingsSummaryLines, prUrl }) {
  const subject = `⛔ Статья отклонена воротами: ${topic}`;
  const findingsHtml = (findingsSummaryLines && findingsSummaryLines.length > 0)
    ? `<ul>${findingsSummaryLines.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>`
    : '<p><em>Без деталей находок в отчёте.</em></p>';
  const lines = [
    `<p><strong>Причина отклонения:</strong> ${escapeHtml(failureClassLabel || '(неизвестно)')}</p>`,
    findingsHtml,
    linkLine('Открыть PR', prUrl),
  ];
  return { subject, html: wrapEmailHtml(lines) };
}

// --- Trigger 3: publish completed, BOTH paths (silent auto-publish in ----
// --- generate-article.yml, and publish-on-merge.yml) ----------------------
export function buildPublishedEmail({ title, liveUrl, verdictLabel }) {
  const subject = `✅ Опубликовано: ${title}`;
  const lines = [
    linkLine('Статья на сайте', liveUrl),
    `<p><strong>Проверка публикации:</strong> ${escapeHtml(verdictLabel || '(не проверено)')}</p>`,
  ];
  return { subject, html: wrapEmailHtml(lines) };
}

// FAILURE_CLASS_LABELS mirrors handleTrippedGate()'s own FAILURE_CLASSES
// set (generate.mjs) plus its 'gate_trip' fallback -- one small, readable
// Russian label per outcome, not a re-derivation of the classification
// logic itself (that stays generate.mjs's job; this only translates its
// already-decided answer for the email).
const FAILURE_CLASS_LABELS = {
  schema_invalid: 'Ошибка схемы (schema_invalid)',
  internal_link_invalid: 'Недействительная внутренняя ссылка (internal_link_invalid)',
  identity_incomplete: 'Неполный блок идентификации (identity_incomplete)',
  gate_trip: 'Сработали ворота комплаенса (gate_trip)',
};

// deriveFailureClassLabel (exported, pure) — report.outcome -> the Russian
// label above. Unknown/missing outcome falls back to the raw string
// itself rather than a blank line, per this file's own "never render
// blank/undefined" rule.
export function deriveFailureClassLabel(outcome) {
  return FAILURE_CLASS_LABELS[outcome] || outcome || '(неизвестно)';
}

// summarizeRejectionFindings (exported, pure) — condenses a generate.mjs
// report's layer1/layer2/layer3/schemaErrors/internalLinkErrors/
// identityErrors into short one-line strings for the rejected-PR email.
// Deliberately capped (default 8) -- an email is a notification, not the
// full gate report (that's the PR body, already there in full via
// render-report-md.mjs); a long list here just gets truncated by mobile
// mail clients anyway.
export function summarizeRejectionFindings(report, maxLines = 8) {
  const lines = [];
  for (const f of report?.layer1?.findings || []) {
    if (f.logOnly) continue; // demoted findings don't justify a real rejection email
    lines.push(`[Layer 1: ${f.category}${f.subcategory ? ':' + f.subcategory : ''}] "${f.matchedText}"`);
  }
  if (report?.layer2?.tripped) {
    const c = report.layer2.checklist || {};
    // Explicit map, not a suffix-strip regex -- CHECKLIST_TOOL's own field
    // names (llmClaimGate.mjs) don't follow one consistent pattern
    // (review_rating_claim -> review_evidence, not review_rating_evidence).
    const EVIDENCE_KEYS = {
      tenure_claim: 'tenure_evidence',
      uniqueness_claim: 'uniqueness_evidence',
      review_rating_claim: 'review_evidence',
      uncited_statistic: 'statistic_evidence',
      competitor_mention: 'competitor_evidence',
      contact_mismatch: 'contact_evidence',
      legal_duty_overstated: 'legal_duty_evidence',
    };
    for (const [key, evidenceKey] of Object.entries(EVIDENCE_KEYS)) {
      if (c[key] === true) lines.push(`[Layer 2: ${key}] ${c[evidenceKey] || ''}`.trim());
    }
  }
  for (const r of report?.layer3?.failed || []) lines.push(`[Layer 3: FAILED] ${r.url}`);
  for (const r of report?.layer3?.unsupported || []) lines.push(`[Layer 3: RESOLVED_UNSUPPORTED] ${r.url}`);
  for (const e of report?.schemaErrors || []) lines.push(`[schema] ${e}`);
  for (const e of report?.internalLinkErrors || []) lines.push(`[internal link] ${e}`);
  for (const e of report?.identityErrors || []) lines.push(`[identity] ${e}`);
  return lines.slice(0, maxLines);
}

// --- Trigger 4: a red run (queue exhausted / generic failure) ------------
// slug (2026-08-31, publish-on-merge FIX 3) -- optional, three-way:
//   undefined -- caller has no slug concept at all (generate-article.yml's
//                generic failure path); line omitted entirely, unchanged
//                behavior for every pre-existing caller.
//   null      -- caller DOES have a slug concept but the failure happened
//                before the article could be identified (e.g. the
//                2026-08-30 incident: the merge-diff itself failed) --
//                says so explicitly rather than sending a blank field.
//   string    -- the real, resolved slug of the stranded article.
export function buildFailureEmail({ reason, detailText, runUrl, slug }) {
  const subject = `🔴 Сбой генерации: ${reason}`;
  let slugLine = '';
  if (slug === null) {
    slugLine = '<p><strong>Статья:</strong> slug could not be determined; the failure occurred before the article was identified.</p>';
  } else if (slug) {
    slugLine = `<p><strong>Статья:</strong> ${escapeHtml(slug)}</p>`;
  }
  const lines = [
    slugLine,
    `<p>${escapeHtml(detailText || 'Пайплайн упал без структурированного отчёта — вероятно, отсутствует секрет, исчерпана очередь тем, или инфраструктурная ошибка. Подробности — в логе прогона.')}</p>`,
    linkLine('Открыть прогон', runUrl),
  ];
  return { subject, html: wrapEmailHtml(lines) };
}
