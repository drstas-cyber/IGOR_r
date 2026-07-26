# CLAUDE.md — Operating instructions for AI agents in this repo

This is the **canonical TVH source** repository for `temeculavalleyhomes.us`.
Read this before doing anything in this working tree.

## Identity

- **Working directory:** `C:\Users\drsta\claud_code\Igor_r`
- **Git remote:** `https://github.com/drstas-cyber/IGOR_r.git`
- **Branch:** `main`
- **Production:** Cloudflare Pages project `igor-r`, custom domain `temeculavalleyhomes.us`
- **Stack:** React 19 + Vite 4 + react-router-dom 7 + react-helmet (CSR-only meta, patched at build time by `tools/seo-prerender.js`)

## Deploy mechanism — git push only

1. Commit work to `main`.
2. Push: `git push origin main`.
3. GitHub Actions workflow `build-check` runs first — it must go green.
4. Cloudflare Pages auto-deploys from `main` via its own GitHub integration.
5. Verify by fetching `https://temeculavalleyhomes.us/version.json`:
   - `commit` matches `git rev-parse HEAD`
   - `dirty: false`
   - `buildEnv: "cf-pages"`

A healthy production deploy reports `buildEnv: "cf-pages"` and `dirty: false`. The value
`"ci"` only appears in `build-check` workflow artifacts (validation, not deployment).
`"local"` on the live site means a wrangler-from-local upload bypassed the canonical path.

**`dirty` open diagnostic, 2026-07-26:** reported `true` on every production deploy checked
that night despite two ruled-out candidate mechanisms (`version-stamp.js` computes `dirty`
before writing anything, and only ever writes into gitignored `dist/`; `public/llms.txt` is
correctly gitignored). `dirtyFiles` was added to `version-stamp.js`'s output to diagnose it
next time it appears, but the deploy at commit `790a421` came back `dirty: false` with no
code change identified across the 4 commits between that could explain the flip (confirmed:
none of them touch `.gitignore`, `package.json`, or `package-lock.json`; the one tracked file
the build writes, `src/data/blog-articles.json`, produces byte-identical output regardless of
those changes). Treat `dirty` as unreliable until it's actually diagnosed with `dirtyFiles`
data from a `true` reading — it is not yet a trustworthy gate on its own in either direction.

**Post-deploy verification of `_headers`/`_redirects` changes specifically:** `version.json`
propagating (commit matches, `buildEnv: cf-pages`) confirms the base HTML/worker deploy, but
header/redirect rules were observed to still be rolling across edge nodes for a short window
after that — a header assertion checked immediately on `version.json` matching returned a
false negative once (missing header on one URL) and passed on an identical re-check seconds
later. **Wait at least 60 seconds after `version.json` confirms before treating any single
`_headers`/`_redirects` check as authoritative.** A failed header/redirect check inside that
window is inconclusive, not a failure — do one confirmation re-check before reporting
anything as broken, and report both results if they disagree (don't silently keep polling
past that).

## Forbidden

- ❌ **`wrangler pages deploy`** from this working tree. Never. If you do, `/version.json`
  will report `dirty: true` and/or `buildEnv: "local"` and the source-of-truth becomes
  ambiguous. This is the bug that bit us in May 2026 — committed `App.jsx` imported a file
  that was not in git, but local wrangler deploys rescued every push and masked the
  divergence for weeks.
- ❌ **Netlify CLI / `netlify deploy`**. The legacy `netlify.toml` and `.netlify/` directory
  were removed. Do not reintroduce. Deploying via Netlify CLI lands on the unused project
  `monumental-pika-e9d766.netlify.app`, not the customer-facing site.
- ❌ **Editing `001_astro/`** (if present). Unrelated alternate project — not part of TVH
  production.
- ❌ **Bypassing failed CI** by deploying via wrangler "to fix it." If `build-check` fails,
  diagnose and fix the underlying issue. The whole point of this workflow is to refuse to
  let broken code reach production.

## Adding a new route

1. Add `<Route path="/your-path" element={<YourPage />} />` to `src/App.jsx`.
2. Create `src/components/YourPage.jsx` with a `<Helmet>` block (title, description, canonical,
   `og:title`, `og:description`, `og:url`, `twitter:title`, `twitter:description`).
3. **Add the route to the `ROUTES` table in `tools/seo-prerender.js`** — otherwise crawlers see
   the homepage shell on the new URL (canonical leak).
4. The `build-check` workflow asserts each ROUTES entry produces `dist/<path>/index.html`. If
   you skip step 3, CI catches it.

## Source of truth for SEO

Page components own their per-route SEO via `<Helmet>`. `tools/seo-prerender.js` reads each
component's `<Helmet>` block at build time and patches `dist/index.html` per route. Do not
maintain a separate SEO manifest — the components are the single source.

## Build chain

`npm run build` runs:
1. `node tools/generate-llms.js` — generates `dist/llms.txt` (best-effort, allowed to fail)
2. `vite build` — produces `dist/index.html` and `dist/assets/*`
3. `node tools/seo-prerender.js` — emits `dist/<route>/index.html` per route + `dist/sitemap.xml`
4. `node tools/version-stamp.js` — emits `dist/version.json` with build provenance
