// Verifies a model ID actually resolves against the live Anthropic API
// before any generation run spends money against it — per the build spec:
// "verify the string against the API before hard-coding... fail loudly with
// a clear error rather than guessing if it ever stops resolving."
//
// This runs at the START of every generate.mjs invocation (not just once at
// build time), so a future model deprecation fails the very next run with a
// clear message instead of silently erroring deep inside a generation call
// or — worse — silently succeeding against a wrong/renamed model.

import { listModels } from './anthropicClient.mjs';

export async function verifyModel(apiKey, modelId) {
  let response;
  try {
    response = await listModels(apiKey);
  } catch (err) {
    throw new Error(
      `[modelVerify] could not verify model "${modelId}" — the Anthropic /v1/models call failed: ${err.message}. ` +
      `Refusing to guess; fix the API key or connectivity issue and re-run.`
    );
  }
  const available = (response.data || []).map((m) => m.id);
  if (!available.includes(modelId)) {
    throw new Error(
      `[modelVerify] model "${modelId}" was not found in the live /v1/models list. ` +
      `This model ID may be deprecated or renamed. Available models: ${available.join(', ') || '(none returned)'}. ` +
      `Update the WRITER_MODEL/REVIEWER_MODEL constants in generate.mjs — do not guess a replacement string.`
    );
  }
  return true;
}
