import path from 'node:path';
import { validateOptionalLifecycleMetadata } from './articleLifecycle.mjs';
import { validateArticleSchema } from './schema.js';

const NORMAL_ARTICLE_PATH = /^src\/data\/generated-articles\/([^/]+)\.json$/i;
const REJECTED_PATH = /^src\/data\/generated-articles\/\.rejected(?:\/|$)/i;
const APPROVAL_FIELDS = ['approved_at', 'approval_pr', 'approval_merge_sha'];

function normalizeRepoPath(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('approved buffer: record.path must be a non-empty repository-relative path');
  }
  return value.replace(/\\/g, '/').replace(/^\.\//, '');
}

export function validateApprovalProvenance(article) {
  const lifecycle = validateOptionalLifecycleMetadata(article);
  const presentCount = article && typeof article === 'object'
    ? APPROVAL_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(article, field)).length
    : 0;
  const complete = presentCount === APPROVAL_FIELDS.length;
  const provenanceErrors = lifecycle.errors.filter((error) => error.includes('approved_') || error.includes('approval_'));
  return {
    present: presentCount > 0,
    complete,
    valid: complete && provenanceErrors.length === 0,
    errors: provenanceErrors,
  };
}

export function classifyApprovedBufferRecord({ path: recordPath, article } = {}) {
  const normalizedPath = normalizeRepoPath(recordPath);
  if (REJECTED_PATH.test(normalizedPath)) {
    return { classification: 'excluded', reason: 'rejected-path', path: normalizedPath, article };
  }
  const match = normalizedPath.match(NORMAL_ARTICLE_PATH);
  if (!match) {
    return { classification: 'excluded', reason: 'not-normal-generated-article-path', path: normalizedPath, article };
  }

  const schema = validateArticleSchema(article);
  if (!schema.valid) {
    throw new Error(`approved buffer: invalid article at ${normalizedPath}: ${schema.errors.join('; ')}`);
  }
  const filenameSlug = path.posix.basename(normalizedPath, '.json');
  if (filenameSlug !== article.slug) {
    throw new Error(`approved buffer: conflicting identity at ${normalizedPath}: filename slug ${JSON.stringify(filenameSlug)} does not equal article.slug ${JSON.stringify(article.slug)}`);
  }

  if (article.published === true) {
    return { classification: 'excluded', reason: 'already-published', path: normalizedPath, article };
  }

  const provenance = validateApprovalProvenance(article);
  if (!provenance.present) {
    return { classification: 'unapproved', reason: 'approval-provenance-absent', path: normalizedPath, article };
  }
  if (!provenance.valid) {
    throw new Error(`approved buffer: invalid approval provenance at ${normalizedPath}: ${provenance.errors.join('; ')}`);
  }

  return { classification: 'eligible', reason: 'approved-unpublished', path: normalizedPath, article };
}

export function sortApprovedBuffer(articles) {
  if (!Array.isArray(articles)) throw new Error('approved buffer: sort input must be an array');
  return [...articles].sort((left, right) => {
    const leftArticle = left?.article ?? left;
    const rightArticle = right?.article ?? right;
    const byApproval = String(leftArticle?.approved_at).localeCompare(String(rightArticle?.approved_at));
    if (byApproval !== 0) return byApproval;
    return String(leftArticle?.slug).localeCompare(String(rightArticle?.slug));
  });
}

export function classifyBufferDepth(depth) {
  if (!Number.isInteger(depth) || depth < 0) {
    throw new Error(`approved buffer: depth must be a non-negative integer, got: ${JSON.stringify(depth)}`);
  }
  if (depth === 0) return 'broken';
  if (depth <= 3) return 'critical';
  if (depth <= 6) return 'warning';
  if (depth <= 13) return 'watch';
  return 'healthy';
}

export function scanApprovedBuffer(records) {
  if (!Array.isArray(records)) throw new Error('approved buffer: records must be an array');
  const normalizedPaths = new Map();
  const slugs = new Map();
  const classified = [];

  for (const record of records) {
    const normalizedPath = normalizeRepoPath(record?.path);
    if (!REJECTED_PATH.test(normalizedPath) && NORMAL_ARTICLE_PATH.test(normalizedPath)) {
      const pathKey = normalizedPath.toLocaleLowerCase('en-US');
      if (normalizedPaths.has(pathKey)) {
        throw new Error(`approved buffer: duplicate/conflicting path identity ${JSON.stringify(normalizedPath)} and ${JSON.stringify(normalizedPaths.get(pathKey))}`);
      }
      normalizedPaths.set(pathKey, normalizedPath);

      const slug = record?.article?.slug;
      if (typeof slug === 'string' && slugs.has(slug)) {
        throw new Error(`approved buffer: duplicate slug ${JSON.stringify(slug)} at ${JSON.stringify(slugs.get(slug))} and ${JSON.stringify(normalizedPath)}`);
      }
      if (typeof slug === 'string') slugs.set(slug, normalizedPath);
    }

    const result = classifyApprovedBufferRecord(record);
    classified.push(result);
  }

  const eligible = sortApprovedBuffer(classified.filter((record) => record.classification === 'eligible'));
  const unapproved = classified.filter((record) => record.classification === 'unapproved');
  const excluded = classified.filter((record) => record.classification === 'excluded');
  return {
    eligible,
    unapproved,
    excluded,
    depth: eligible.length,
    health: classifyBufferDepth(eligible.length),
  };
}
