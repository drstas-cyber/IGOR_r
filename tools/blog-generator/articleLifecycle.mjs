const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const MERGE_SHA_PATTERN = /^[0-9a-f]{40}$/i;
const APPROVAL_FIELDS = ['approved_at', 'approval_pr', 'approval_merge_sha'];

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function canonicalizeIsoUtc(value) {
  return value.includes('.') ? value : value.replace(/Z$/, '.000Z');
}

export function isValidIsoUtc(value) {
  if (typeof value !== 'string' || !ISO_UTC_PATTERN.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === canonicalizeIsoUtc(value);
}

export function validateOptionalLifecycleMetadata(article) {
  const errors = [];
  if (!article || typeof article !== 'object' || Array.isArray(article)) {
    return { valid: false, errors: ['article lifecycle metadata requires an article object'] };
  }

  const approvalPresence = APPROVAL_FIELDS.map((field) => hasOwn(article, field));
  const approvalFieldCount = approvalPresence.filter(Boolean).length;
  if (approvalFieldCount !== 0 && approvalFieldCount !== APPROVAL_FIELDS.length) {
    errors.push('approved_at, approval_pr, and approval_merge_sha must be supplied together as one atomic approval-provenance group');
  }

  if (hasOwn(article, 'approved_at') && !isValidIsoUtc(article.approved_at)) {
    errors.push(`approved_at must be a canonical ISO-8601 UTC timestamp ending in Z, got: ${JSON.stringify(article.approved_at)}`);
  }
  if (hasOwn(article, 'approval_pr') && (!Number.isInteger(article.approval_pr) || article.approval_pr <= 0)) {
    errors.push(`approval_pr must be a positive integer, got: ${JSON.stringify(article.approval_pr)}`);
  }
  if (hasOwn(article, 'approval_merge_sha') && (typeof article.approval_merge_sha !== 'string' || !MERGE_SHA_PATTERN.test(article.approval_merge_sha))) {
    errors.push(`approval_merge_sha must be a 40-character hexadecimal commit SHA, got: ${JSON.stringify(article.approval_merge_sha)}`);
  }

  const hasPublishedAt = hasOwn(article, 'published_at');
  const publishedAt = article.published_at;
  if (hasPublishedAt && publishedAt !== null && !isValidIsoUtc(publishedAt)) {
    errors.push(`published_at must be null or a canonical ISO-8601 UTC timestamp ending in Z, got: ${JSON.stringify(publishedAt)}`);
  }
  if (article.published === false && hasPublishedAt && publishedAt !== null) {
    errors.push('published:false cannot have a non-null published_at');
  }

  const hasAnyLifecycleMetadata = approvalFieldCount > 0 || hasPublishedAt;
  if (article.published === true && hasAnyLifecycleMetadata && (!hasPublishedAt || publishedAt === null || !isValidIsoUtc(publishedAt))) {
    errors.push('a future-metadata article with published:true must have a valid non-null published_at');
  }

  return { valid: errors.length === 0, errors };
}

function assertValidLifecycle(article, operation) {
  const result = validateOptionalLifecycleMetadata(article);
  if (!result.valid) {
    throw new Error(`${operation}: invalid lifecycle metadata: ${result.errors.join('; ')}`);
  }
}

function cloneArticle(article) {
  return {
    ...article,
    ...(article.jsonLd && typeof article.jsonLd === 'object' && !Array.isArray(article.jsonLd)
      ? { jsonLd: { ...article.jsonLd } }
      : {}),
  };
}

function assertPublishedJsonLdConsistent(article, operation) {
  if (!article.jsonLd || typeof article.jsonLd !== 'object' || Array.isArray(article.jsonLd)) {
    throw new Error(`${operation}: jsonLd must be a non-null object`);
  }
  if (!isValidIsoUtc(article.jsonLd.datePublished) || !isValidIsoUtc(article.jsonLd.dateModified)) {
    throw new Error(`${operation}: jsonLd.datePublished and jsonLd.dateModified must be canonical ISO-8601 UTC timestamps ending in Z`);
  }
  if (canonicalizeIsoUtc(article.jsonLd.datePublished) !== canonicalizeIsoUtc(article.published_at)) {
    throw new Error(`${operation}: jsonLd.datePublished must equal published_at`);
  }
  if (Date.parse(article.jsonLd.dateModified) < Date.parse(article.jsonLd.datePublished)) {
    throw new Error(`${operation}: jsonLd.dateModified cannot precede jsonLd.datePublished`);
  }
}

export function stampApproval(article, { approvedAt, approvalPr, approvalMergeSha } = {}) {
  assertValidLifecycle(article, 'stampApproval');
  if (article.published !== false) {
    throw new Error('stampApproval: only an unpublished article can enter the approved buffer');
  }
  if (!isValidIsoUtc(approvedAt)) {
    throw new Error(`stampApproval: approvedAt must be a canonical ISO-8601 UTC timestamp ending in Z, got: ${JSON.stringify(approvedAt)}`);
  }
  if (!Number.isInteger(approvalPr) || approvalPr <= 0) {
    throw new Error(`stampApproval: approvalPr must be a positive integer, got: ${JSON.stringify(approvalPr)}`);
  }
  if (typeof approvalMergeSha !== 'string' || !MERGE_SHA_PATTERN.test(approvalMergeSha)) {
    throw new Error(`stampApproval: approvalMergeSha must be a 40-character hexadecimal commit SHA, got: ${JSON.stringify(approvalMergeSha)}`);
  }

  const alreadyStamped = APPROVAL_FIELDS.every((field) => hasOwn(article, field));
  if (alreadyStamped) {
    const consistent = article.approved_at === approvedAt
      && article.approval_pr === approvalPr
      && article.approval_merge_sha === approvalMergeSha;
    if (!consistent) throw new Error('stampApproval: approval provenance is immutable once assigned');
    return cloneArticle(article);
  }

  return {
    ...cloneArticle(article),
    approved_at: canonicalizeIsoUtc(approvedAt),
    approval_pr: approvalPr,
    approval_merge_sha: approvalMergeSha,
    published_at: hasOwn(article, 'published_at') ? article.published_at : null,
  };
}

export function prepareFirstPublication(article, { publishedAt, substantiveModifiedAt } = {}) {
  assertValidLifecycle(article, 'prepareFirstPublication');
  if (!isValidIsoUtc(publishedAt)) {
    throw new Error(`prepareFirstPublication: publishedAt must be a canonical ISO-8601 UTC timestamp ending in Z, got: ${JSON.stringify(publishedAt)}`);
  }
  if (substantiveModifiedAt !== undefined && !isValidIsoUtc(substantiveModifiedAt)) {
    throw new Error(`prepareFirstPublication: substantiveModifiedAt must be a canonical ISO-8601 UTC timestamp ending in Z, got: ${JSON.stringify(substantiveModifiedAt)}`);
  }
  if (!article.jsonLd || typeof article.jsonLd !== 'object' || Array.isArray(article.jsonLd)) {
    throw new Error('prepareFirstPublication: jsonLd must be a non-null object');
  }

  const publicationMs = Date.parse(publishedAt);
  if (!isValidIsoUtc(article.created_at)) {
    throw new Error(`prepareFirstPublication: created_at must be a canonical ISO-8601 UTC timestamp ending in Z, got: ${JSON.stringify(article.created_at)}`);
  }
  if (publicationMs < Date.parse(article.created_at)) {
    throw new Error('prepareFirstPublication: publishedAt cannot precede created_at');
  }

  const approval = validateOptionalLifecycleMetadata(article);
  const hasCompleteApproval = APPROVAL_FIELDS.every((field) => hasOwn(article, field));
  if (!approval.valid || !hasCompleteApproval) {
    throw new Error('prepareFirstPublication: complete valid approval provenance is required');
  }
  if (publicationMs < Date.parse(article.approved_at)) {
    throw new Error('prepareFirstPublication: publishedAt cannot precede approved_at');
  }

  if (article.published === true) {
    assertPublishedJsonLdConsistent(article, 'prepareFirstPublication');
    const requestedModifiedMs = substantiveModifiedAt === undefined
      ? Date.parse(article.jsonLd.dateModified)
      : Math.max(publicationMs, Date.parse(substantiveModifiedAt));
    const expectedModified = new Date(requestedModifiedMs).toISOString();
    const consistent = article.published_at === canonicalizeIsoUtc(publishedAt)
      && article.jsonLd.datePublished === canonicalizeIsoUtc(publishedAt)
      && article.jsonLd.dateModified === expectedModified;
    if (!consistent) throw new Error('prepareFirstPublication: publication timestamp is immutable once assigned');
    return cloneArticle(article);
  }
  if (article.published !== false) {
    throw new Error('prepareFirstPublication: article.published must be false before first publication');
  }

  const modifiedMs = substantiveModifiedAt === undefined ? publicationMs : Date.parse(substantiveModifiedAt);
  const publicModifiedMs = Math.max(publicationMs, modifiedMs);
  const canonicalPublishedAt = new Date(publicationMs).toISOString();

  return {
    ...cloneArticle(article),
    published: true,
    published_at: canonicalPublishedAt,
    jsonLd: {
      ...article.jsonLd,
      datePublished: canonicalPublishedAt,
      dateModified: new Date(publicModifiedMs).toISOString(),
    },
  };
}

export function recordSubstantiveModification(article, { modifiedAt } = {}) {
  assertValidLifecycle(article, 'recordSubstantiveModification');
  if (article.published !== true || !isValidIsoUtc(article.published_at)) {
    throw new Error('recordSubstantiveModification: a future-metadata published article with published_at is required');
  }
  if (!isValidIsoUtc(modifiedAt)) {
    throw new Error(`recordSubstantiveModification: modifiedAt must be a canonical ISO-8601 UTC timestamp ending in Z, got: ${JSON.stringify(modifiedAt)}`);
  }
  if (!article.jsonLd || typeof article.jsonLd !== 'object' || Array.isArray(article.jsonLd)) {
    throw new Error('recordSubstantiveModification: jsonLd must be a non-null object');
  }
  assertPublishedJsonLdConsistent(article, 'recordSubstantiveModification');

  const modifiedMs = Date.parse(modifiedAt);
  if (modifiedMs < Date.parse(article.published_at)) {
    throw new Error('recordSubstantiveModification: modifiedAt cannot precede published_at');
  }
  if (modifiedMs < Date.parse(article.jsonLd.dateModified)) {
    throw new Error('recordSubstantiveModification: modifiedAt cannot move dateModified backwards');
  }

  return {
    ...cloneArticle(article),
    jsonLd: {
      ...article.jsonLd,
      dateModified: new Date(modifiedMs).toISOString(),
    },
  };
}
