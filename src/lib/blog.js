// Shared by BlogPostPage.jsx (client render) and tools/seo-prerender.js (Node
// build step) — plain ESM, no Vite-only syntax, so both can import it.

export function formatArticleDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Adds loading="lazy"/decoding="async" to <img> tags in raw API HTML that
// don't already declare a loading attribute.
export function addLazyLoading(html) {
  if (!html) return html;
  return html.replace(/<img((?:(?!loading=)[^>])*)>/gi, (_match, attrs) => {
    return `<img${attrs} loading="lazy" decoding="async">`;
  });
}

// Serializes jsonLd/faqJsonLd (object or already-stringified) for embedding via
// dangerouslySetInnerHTML / raw HTML injection. Escapes "<" so a value
// containing a literal "</script>" can't break out of the script tag.
export function toJsonLdScript(value) {
  if (!value) return null;
  const json = typeof value === 'string' ? value : JSON.stringify(value);
  return json.replace(/</g, '\\u003c');
}
