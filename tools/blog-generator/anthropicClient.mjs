// Minimal hand-rolled Anthropic API client — no SDK dependency, matching the
// existing pattern in tools/blog-compliance/babyLoveApi.js (a thin fetch
// wrapper, not a full client library). Uses the global `fetch` (Node 22+),
// so tests can stub it by overriding globalThis.fetch — no network mocking
// library needed.

const API_BASE = 'https://api.anthropic.com';
const ANTHROPIC_VERSION = '2023-06-01';
const REQUEST_TIMEOUT_MS = 120000; // article generation is slow; model-list calls are fast but share this budget

async function request(pathAndQuery, apiKey, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${pathAndQuery}`, {
      ...init,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
        ...(init.headers || {}),
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      let bodyText = '';
      try {
        bodyText = (await res.text()).slice(0, 800);
      } catch {
        // response body unreadable — fall through with just the status
      }
      const err = new Error(`HTTP ${res.status} ${res.statusText}${bodyText ? ` — ${bodyText}` : ''}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// GET /v1/models — used by modelVerify.mjs to confirm a model ID actually
// resolves before any generation run spends money against it.
export async function listModels(apiKey) {
  return request('/v1/models?limit=1000', apiKey, { method: 'GET' });
}

// POST /v1/messages. `tools`/`tool_choice` (optional) force structured
// output via Anthropic's tool-use mechanism rather than parsing prose JSON —
// see llmClaimGate.mjs and generate.mjs for callers that rely on this for
// reliability ("structured output, not prose" per the build spec).
export async function createMessage({ apiKey, model, system, messages, maxTokens = 8192, tools, toolChoice }) {
  const body = { model, max_tokens: maxTokens, messages };
  if (system) body.system = system;
  if (tools) body.tools = tools;
  if (toolChoice) body.tool_choice = toolChoice;
  return request('/v1/messages', apiKey, { method: 'POST', body: JSON.stringify(body) });
}

// Extracts the input object from a forced tool-use response. Throws a clear
// error if the model didn't return the expected tool call — callers should
// treat that as a hard failure, not attempt to guess/parse prose instead.
export function extractToolInput(response, toolName) {
  const block = (response.content || []).find((c) => c.type === 'tool_use' && c.name === toolName);
  if (!block) {
    throw new Error(
      `[anthropicClient] expected a "${toolName}" tool_use block in the response but found none. ` +
      `stop_reason=${response.stop_reason}, content types: ${(response.content || []).map((c) => c.type).join(', ')}`
    );
  }
  return block.input;
}
