// Reads the run report and answers one question for the workflow: may this
// run auto-merge its own article PR? (owner decision, 2026-10-06 --
// auto-merge-on-silent, superseding the 2026-08-31 manual-publish-only
// ruling. See README.md's decision record for the data that reopened it.)
//
// RESTORED, not resurrected unchanged: a file of this name existed from
// 2026-08-03 to 2026-08-31 and was deleted with the original auto-merge
// path. This is a new implementation of the same job, with one deliberate
// difference -- the old one trusted `report.allSilent` as written. This one
// recomputes it from the report via computeAllSilent() and requires BOTH to
// agree, because the whole point of a second reader is to disagree when
// something is wrong. A report whose stored flag and recomputed value
// differ is a corrupted or hand-edited report, and the only safe reading of
// that is "not silent."
//
// FAILS CLOSED, everywhere and always: a missing file, unreadable file,
// malformed JSON, missing flag, or any disagreement all resolve to
// all_silent=false. The cost of a false negative is that a human merges the
// PR by hand, exactly as they did before this file existed. The cost of a
// false positive is an unreviewed article going live on a real brokerage's
// site under a real DRE licence. Those are not symmetric and this file
// never treats them as if they were.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeAllSilent } from './autoPublishGate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPORT_PATH = path.join(HERE, '.last-run-report.json');

// evaluateAllSilent (exported, pure) -- takes an already-parsed report (or
// null/garbage) and returns { allSilent, reason }. `reason` is always
// populated, including on the true path, because this decision ends up in a
// workflow log that someone reads months later wondering why a given run
// did or didn't publish itself.
export function evaluateAllSilent(report) {
  if (!report || typeof report !== 'object') {
    return { allSilent: false, reason: 'no report object -- failing closed' };
  }
  if (report.outcome !== 'generated') {
    return { allSilent: false, reason: `outcome is "${report.outcome}", not "generated"` };
  }

  const stored = report.allSilent;
  const recomputed = computeAllSilent(report);

  if (stored !== true && recomputed !== true) {
    return { allSilent: false, reason: 'run was not perfectly silent -- holds for a human read' };
  }
  if (stored !== recomputed) {
    // Deliberately loud. This should be unreachable: generate.mjs writes
    // the flag using this exact function on this exact report. If it ever
    // fires, the report was edited after the fact or the two code paths
    // have drifted -- either way "merge it automatically" is the wrong
    // response to "I no longer understand this report."
    return {
      allSilent: false,
      reason: `DISAGREEMENT -- report.allSilent=${JSON.stringify(stored)} but computeAllSilent() says ${recomputed}. `
        + 'Failing closed and holding the PR for a human. This is worth investigating.',
    };
  }

  return { allSilent: true, reason: 'perfectly silent -- zero findings anywhere, all layers clean, self-review found nothing' };
}

// readReport (exported for tests) -- the one impure edge. Any read or parse
// failure returns null rather than throwing, so the caller's fail-closed
// path handles it identically to every other bad-input case.
export function readReport(reportPath) {
  try {
    return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  } catch {
    return null;
  }
}

export function main({ argv = process.argv.slice(2), env = process.env, log = console.log } = {}) {
  const reportArg = argv.find((a) => a.startsWith('--report='));
  const reportPath = reportArg ? reportArg.slice('--report='.length) : DEFAULT_REPORT_PATH;

  const { allSilent, reason } = evaluateAllSilent(readReport(reportPath));
  log(`[check-all-silent] all_silent=${allSilent} -- ${reason}`);

  if (env.GITHUB_OUTPUT) {
    fs.appendFileSync(env.GITHUB_OUTPUT, `all_silent=${allSilent}\n`);
  }
  return allSilent;
}

// Same entrypoint guard the other CLIs in this directory use -- importable
// by tests without executing.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
